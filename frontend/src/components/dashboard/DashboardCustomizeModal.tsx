import React, { useState, useEffect } from 'react';
import { X, ChevronUp, ChevronDown } from 'lucide-react';
import { api } from '../../utils/api';
import { Button } from '../common/Button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';

interface WidgetConfig {
  key: string;
  enabled: boolean;
  showAddButton?: boolean;
  size?: 'S' | 'M' | 'L';
  order: number;
}

interface DashboardConfig {
  widgets: WidgetConfig[];
}

interface DashboardCustomizeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const widgetLabels: Record<string, string> = {
  snsHistory: 'SNS投稿履歴',
  taskRequests: 'タスク依頼',
  projects: 'プロジェクト',
  goals: '目標',
};

export const DashboardCustomizeModal: React.FC<DashboardCustomizeModalProps> = ({
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<DashboardConfig | null>(null);

  // デフォルト設定（role別）
  const getDefaultConfig = (role: string = 'MEMBER'): DashboardConfig => {
    const baseWidgets = [
      { key: 'snsHistory', enabled: true, showAddButton: true, size: 'M' as const, order: 1 },
      { key: 'taskRequests', enabled: true, showAddButton: false, size: 'L' as const, order: 2 },
      { key: 'projects', enabled: false, showAddButton: false, size: 'M' as const, order: 3 },
      { key: 'goals', enabled: false, showAddButton: false, size: 'M' as const, order: 4 },
    ];

    if (role === 'MEMBER') {
      return {
        widgets: [
          { ...baseWidgets[0], enabled: true, showAddButton: true },
          { ...baseWidgets[1], enabled: false },
          { ...baseWidgets[2], enabled: true },
          { ...baseWidgets[3], enabled: true },
        ],
      };
    } else if (role === 'SUPPORT' || role === 'GOVERNMENT') {
      return {
        widgets: [
          { ...baseWidgets[0], enabled: false },
          { ...baseWidgets[1], enabled: true, showAddButton: true },
          { ...baseWidgets[2], enabled: true },
          { ...baseWidgets[3], enabled: false },
        ],
      };
    } else if (role === 'MASTER') {
      return {
        widgets: baseWidgets.map((w, i) => ({ ...w, enabled: true, order: i + 1 })),
      };
    }

    return { widgets: baseWidgets };
  };

  const { data: currentConfig, isLoading } = useQuery<DashboardConfig>({
    queryKey: ['dashboard-config'],
    queryFn: async () => {
      try {
        const response = await api.get('/api/me/dashboard-config');
        return response.data;
      } catch (error: any) {
        console.error('[Dashboard] Failed to fetch dashboard config:', error);
        // エラー時はデフォルト設定を返す（無限ローディングを防ぐ）
        const { user } = useAuthStore.getState();
        return getDefaultConfig(user?.role || 'MEMBER');
      }
    },
    enabled: isOpen,
    retry: 1, // リトライは1回のみ
    staleTime: 30000, // 30秒間キャッシュ
  });

  const saveMutation = useMutation({
    mutationFn: async (newConfig: DashboardConfig) => {
      return api.put('/api/me/dashboard-config', newConfig);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard-config'] });
      onClose();
    },
  });

  useEffect(() => {
    if (currentConfig) {
      setConfig(currentConfig);
    }
  }, [currentConfig]);

  if (!isOpen) return null;

  const handleToggleEnabled = (key: string) => {
    if (!config) return;
    setConfig({
      ...config,
      widgets: config.widgets.map((w) =>
        w.key === key ? { ...w, enabled: !w.enabled } : w
      ),
    });
  };

  const handleToggleAddButton = (key: string) => {
    if (!config) return;
    setConfig({
      ...config,
      widgets: config.widgets.map((w) =>
        w.key === key ? { ...w, showAddButton: !w.showAddButton } : w
      ),
    });
  };

  const handleMoveOrder = (key: string, direction: 'up' | 'down') => {
    if (!config) return;
    const widgets = [...config.widgets];
    const index = widgets.findIndex((w) => w.key === key);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= widgets.length) return;

    [widgets[index], widgets[newIndex]] = [widgets[newIndex], widgets[index]];
    widgets[index].order = index + 1;
    widgets[newIndex].order = newIndex + 1;

    setConfig({ ...config, widgets });
  };

  const handleSave = () => {
    if (!config) return;
    saveMutation.mutate(config);
  };

  if (isLoading || !config) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full m-4 p-6">
          <p>読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold">ダッシュボードをカスタマイズ</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            ウィジェットの表示/非表示、追加ボタンの表示、並び順を設定できます。
          </p>

          <div className="space-y-3">
            {config.widgets
              .sort((a, b) => a.order - b.order)
              .map((widget) => (
                <div
                  key={widget.key}
                  className="border border-gray-200 rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleMoveOrder(widget.key, 'up')}
                          disabled={widget.order === 1}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMoveOrder(widget.key, 'down')}
                          disabled={widget.order === config.widgets.length}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {widgetLabels[widget.key] || widget.key}
                        </h3>
                        <p className="text-xs text-gray-500">順序: {widget.order}</p>
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={widget.enabled}
                        onChange={() => handleToggleEnabled(widget.key)}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700">表示</span>
                    </label>
                  </div>

                  {widget.enabled && (
                    <div className="pl-8 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={widget.showAddButton || false}
                          onChange={() => handleToggleAddButton(widget.key)}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">追加ボタンを表示</span>
                      </label>
                    </div>
                  )}
                </div>
              ))}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

