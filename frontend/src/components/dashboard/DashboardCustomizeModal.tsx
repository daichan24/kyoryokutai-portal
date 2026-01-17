import React, { useState, useEffect } from 'react';
import { X, ChevronUp, ChevronDown } from 'lucide-react';
import { api } from '../../utils/api';
import { Button } from '../common/Button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';

type DisplayMode = 'view-only' | 'view-with-add' | 'add-only';
type ColumnSpan = 1 | 2;

interface WidgetConfig {
  key: string;
  enabled: boolean;
  displayMode?: DisplayMode; // 表示モード: 表示のみ、表示+追加ボタン、追加ボタンのみ
  showAddButton?: boolean; // 後方互換性のため残す
  size?: 'S' | 'M' | 'L';
  columnSpan?: ColumnSpan; // カラム幅: 1カラム or 2カラム
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
  snsQuickAdd: 'SNS投稿追加',
  taskRequests: '依頼',
  projects: 'プロジェクト',
  goals: 'ミッション',
  tasks: 'タスク',
  events: 'イベント',
  contacts: '町民データベース',
  eventParticipation: 'イベント参加状況',
};

// カスタマイズ画面に必ず表示する全8ウィジェットのテンプレート
const FULL_WIDGET_TEMPLATE: Omit<WidgetConfig, 'order'>[] = [
  { key: 'snsHistory', enabled: true, displayMode: 'view-with-add', showAddButton: true, size: 'M', columnSpan: 2 },
  { key: 'taskRequests', enabled: true, displayMode: 'view-only', showAddButton: false, size: 'L', columnSpan: 2 },
  { key: 'projects', enabled: false, displayMode: 'view-only', showAddButton: false, size: 'M', columnSpan: 2 },
  { key: 'goals', enabled: false, displayMode: 'view-only', showAddButton: false, size: 'M', columnSpan: 1 },
  { key: 'tasks', enabled: false, displayMode: 'view-with-add', showAddButton: true, size: 'M', columnSpan: 2 },
  { key: 'events', enabled: false, displayMode: 'view-with-add', showAddButton: true, size: 'M', columnSpan: 2 },
  { key: 'contacts', enabled: false, displayMode: 'add-only', showAddButton: false, size: 'M', columnSpan: 2 },
  { key: 'eventParticipation', enabled: false, displayMode: 'view-only', showAddButton: false, size: 'L', columnSpan: 1 },
];

// APIレスポンスとテンプレートをマージし、常に全8件を返す（APIが古い・空・不正でも選択肢を表示）
function mergeWithTemplate(apiConfig: DashboardConfig | null | undefined, role: string): DashboardConfig {
  const raw = apiConfig?.widgets;
  if (!raw || !Array.isArray(raw) || raw.length === 0) {
    return getDefaultConfig(role);
  }
  const byKey = new Map<string, any>();
  raw.forEach((w) => byKey.set(w.key, w));
  const merged = FULL_WIDGET_TEMPLATE.map((t, i) => {
    const saved = byKey.get(t.key);
    if (saved) {
      return { ...t, ...saved, key: t.key, order: typeof saved.order === 'number' ? saved.order : i + 1 } as WidgetConfig;
    }
    return { ...t, order: i + 1 } as WidgetConfig;
  });
  return { widgets: merged.sort((a, b) => a.order - b.order) };
}

// デフォルト設定（role別）※常に8件
function getDefaultConfig(role: string = 'MEMBER'): DashboardConfig {
  const base = FULL_WIDGET_TEMPLATE.map((w, i) => ({ ...w, order: i + 1 } as WidgetConfig));
  if (role === 'MEMBER') {
    return { widgets: [base[0], { ...base[1], enabled: false }, base[2], base[3], base[4], base[5], base[6], base[7]].map((w, i) => ({ ...w, order: i + 1 })) };
  }
  if (role === 'SUPPORT' || role === 'GOVERNMENT') {
    return { widgets: [base[0], base[1], base[2], base[3], base[4], base[5], base[6], base[7]].map((w, i) => ({ ...w, enabled: [0, 3].includes(i) ? false : true, order: i + 1 })) };
  }
  if (role === 'MASTER') {
    return { widgets: base.map((w, i) => ({ ...w, enabled: true, order: i + 1 })) };
  }
  return { widgets: base };
}

export const DashboardCustomizeModal: React.FC<DashboardCustomizeModalProps> = ({
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<DashboardConfig | null>(null);

  const { data: currentConfig, isLoading } = useQuery<DashboardConfig>({
    queryKey: ['dashboard-config'],
    queryFn: async () => {
      try {
        const response = await api.get('/api/me/dashboard-config');
        const data = response?.data;
        if (!data || !Array.isArray(data?.widgets)) {
          const { user } = useAuthStore.getState();
          return getDefaultConfig(user?.role || 'MEMBER');
        }
        return data;
      } catch (error: any) {
        console.error('[DashboardCustomizeModal] Failed to fetch dashboard config:', error);
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
    if (currentConfig !== undefined && isOpen) {
      const { user } = useAuthStore.getState();
      setConfig(mergeWithTemplate(currentConfig, user?.role || 'MEMBER'));
    }
  }, [currentConfig, isOpen]);

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

  const handleChangeDisplayMode = (key: string, mode: DisplayMode) => {
    if (!config) return;
    setConfig({
      ...config,
      widgets: config.widgets.map((w) =>
        w.key === key ? { ...w, displayMode: mode } : w
      ),
    });
  };

  const handleChangeColumnSpan = (key: string, span: ColumnSpan) => {
    if (!config) return;
    setConfig({
      ...config,
      widgets: config.widgets.map((w) =>
        w.key === key ? { ...w, columnSpan: span } : w
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
            {(config?.widgets ?? [])
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
                    <div className="pl-8 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          表示モード
                        </label>
                        <select
                          value={widget.displayMode || 'view-only'}
                          onChange={(e) => handleChangeDisplayMode(widget.key, e.target.value as DisplayMode)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                          <option value="view-only">表示のみ</option>
                          <option value="view-with-add">表示+追加ボタン</option>
                          <option value="add-only">追加ボタンのみ</option>
                        </select>
                      </div>
                      {(widget.key === 'goals' || widget.key === 'eventParticipation') && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            カラム幅
                          </label>
                          <select
                            value={widget.columnSpan || 1}
                            onChange={(e) => handleChangeColumnSpan(widget.key, parseInt(e.target.value) as ColumnSpan)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                          >
                            <option value="1">1カラム</option>
                            <option value="2">2カラム</option>
                          </select>
                        </div>
                      )}
                      {/* 後方互換性のため残す */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={widget.showAddButton || false}
                          onChange={() => handleToggleAddButton(widget.key)}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                        />
                        <span className="text-sm text-gray-700">追加ボタンを表示（後方互換）</span>
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

