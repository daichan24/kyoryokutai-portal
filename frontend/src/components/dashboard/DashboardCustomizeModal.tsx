import React, { useState, useEffect } from 'react';
import { X, ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
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
  contactCount?: number; // 町民データベースの表示人数（1〜3名）
  order: number;
}

interface DashboardConfig {
  widgets: WidgetConfig[];
  weeklyScheduleCount?: 3 | 5 | 10; // 今週のスケジュールの表示数
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
  'goals-personal': 'ミッション（個人）',
  'goals-view': 'ミッション（閲覧）',
  tasks: 'タスク',
  events: 'イベント',
  contacts: '町民データベース',
  eventParticipation: 'イベント参加状況',
  nextWish: '次にやる1つ',
};

// カスタマイズ画面に必ず表示する全ウィジェットのテンプレート
// メンバー以外の場合はgoals-personalとgoals-viewを分離
const getFullWidgetTemplate = (role: string): Omit<WidgetConfig, 'order'>[] => {
  const base = [
    { key: 'snsHistory', enabled: true, displayMode: 'view-with-add' as const, showAddButton: true, size: 'M' as const, columnSpan: 2 as const },
    { key: 'taskRequests', enabled: true, displayMode: 'view-only' as const, showAddButton: false, size: 'L' as const, columnSpan: 2 as const },
    { key: 'projects', enabled: false, displayMode: 'view-only' as const, showAddButton: false, size: 'M' as const, columnSpan: 2 as const },
    { key: 'tasks', enabled: false, displayMode: 'view-with-add' as const, showAddButton: true, size: 'M' as const, columnSpan: 2 as const },
    { key: 'events', enabled: false, displayMode: 'view-with-add' as const, showAddButton: true, size: 'M' as const, columnSpan: 2 as const },
    { key: 'contacts', enabled: false, displayMode: 'add-only' as const, showAddButton: false, size: 'M' as const, columnSpan: 2 as const, contactCount: 3 },
    { key: 'eventParticipation', enabled: false, displayMode: 'view-only' as const, showAddButton: false, size: 'L' as const, columnSpan: 1 as const },
    { key: 'nextWish', enabled: false, displayMode: 'view-only' as const, showAddButton: false, size: 'M' as const, columnSpan: 2 as const },
  ];
  
  // メンバー以外の場合はgoals-personalとgoals-viewを追加
  if (role !== 'MEMBER') {
    return [
      ...base.slice(0, 3),
      { key: 'goals-personal', enabled: false, displayMode: 'view-only' as const, showAddButton: false, size: 'M' as const, columnSpan: 1 as const },
      { key: 'goals-view', enabled: false, displayMode: 'view-only' as const, showAddButton: false, size: 'M' as const, columnSpan: 1 as const },
      ...base.slice(3),
    ];
  }
  
  // メンバーの場合は従来通りgoalsのみ
  return [
    ...base.slice(0, 3),
    { key: 'goals', enabled: false, displayMode: 'view-only' as const, showAddButton: false, size: 'M' as const, columnSpan: 1 as const },
    ...base.slice(3),
  ];
};

// APIレスポンスとテンプレートをマージし、常に全ウィジェットを返す（APIが古い・空・不正でも選択肢を表示）
function mergeWithTemplate(apiConfig: DashboardConfig | null | undefined, role: string): DashboardConfig {
  const raw = apiConfig?.widgets;
  if (!raw || !Array.isArray(raw) || raw.length === 0) {
    return getDefaultConfig(role);
  }
  const byKey = new Map<string, any>();
  raw.forEach((w) => byKey.set(w.key, w));
  
  // 古いgoalsウィジェットをgoals-personalとgoals-viewに変換（メンバー以外の場合）
  if (role !== 'MEMBER' && byKey.has('goals') && !byKey.has('goals-personal') && !byKey.has('goals-view')) {
    const oldGoals = byKey.get('goals');
    byKey.set('goals-personal', { ...oldGoals, key: 'goals-personal', order: oldGoals.order });
    byKey.set('goals-view', { ...oldGoals, key: 'goals-view', order: (oldGoals.order || 0) + 0.5, enabled: false });
    byKey.delete('goals');
  }
  
  const template = getFullWidgetTemplate(role);
  const merged = template.map((t, i) => {
    const saved = byKey.get(t.key);
    if (saved) {
      return { ...t, ...saved, key: t.key, order: typeof saved.order === 'number' ? saved.order : i + 1 } as WidgetConfig;
    }
    return { ...t, order: i + 1 } as WidgetConfig;
  });
  return { widgets: merged.sort((a, b) => a.order - b.order) };
}

// デフォルト設定（role別）
function getDefaultConfig(role: string = 'MEMBER'): DashboardConfig {
  const template = getFullWidgetTemplate(role);
  const base = template.map((w, i) => ({ ...w, order: i + 1 } as WidgetConfig));
  
  if (role === 'MEMBER') {
    return { widgets: [base[0], { ...base[1], enabled: false }, base[2], base[3], base[4], base[5], base[6], base[7]].map((w, i) => ({ ...w, order: i + 1 })) };
  }
  if (role === 'SUPPORT' || role === 'GOVERNMENT') {
    // goals-personalとgoals-viewのインデックスを考慮
    const goalsPersonalIndex = base.findIndex(w => w.key === 'goals-personal');
    const goalsViewIndex = base.findIndex(w => w.key === 'goals-view');
    return { 
      widgets: base.map((w, i) => ({ 
        ...w, 
        enabled: (goalsPersonalIndex !== -1 && i === goalsPersonalIndex) ? false : (goalsViewIndex !== -1 && i === goalsViewIndex) ? false : [0, 3].includes(i) ? false : true, 
        order: i + 1 
      })) 
    };
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
      // 町民データベースのクエリも無効化（contactCountが変更された場合に再取得されるように）
      queryClient.invalidateQueries({ queryKey: ['contacts-recent'] });
      onClose();
    },
  });

  useEffect(() => {
    if (currentConfig !== undefined && isOpen) {
      const { user } = useAuthStore.getState();
      const merged = mergeWithTemplate(currentConfig, user?.role || 'MEMBER');
      // weeklyScheduleCountも設定に含める
      setConfig({
        ...merged,
        weeklyScheduleCount: currentConfig?.weeklyScheduleCount || 5,
      });
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

  const handleChangeContactCount = (key: string, count: number) => {
    if (!config) return;
    setConfig({
      ...config,
      widgets: config.widgets.map((w) =>
        w.key === key ? { ...w, contactCount: count } : w
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

  const handleDragEnd = (result: DropResult) => {
    if (!config || !result.destination) return;
    
    const widgets = Array.from(config.widgets);
    const sortedWidgets = widgets.sort((a, b) => a.order - b.order);
    const [reorderedItem] = sortedWidgets.splice(result.source.index, 1);
    sortedWidgets.splice(result.destination.index, 0, reorderedItem);
    
    // orderを更新
    const updatedWidgets = sortedWidgets.map((widget, index) => ({
      ...widget,
      order: index + 1,
    }));
    
    setConfig({ ...config, widgets: updatedWidgets });
  };

  const handleSave = () => {
    if (!config) return;
    saveMutation.mutate(config);
  };

  if (isLoading || !config) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full m-4 p-6">
          <p className="dark:text-gray-300">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700 flex-shrink-0">
          <h2 className="text-2xl font-bold dark:text-gray-100">ダッシュボードをカスタマイズ</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
          {/* 今週のスケジュール表示数設定 */}
          <div className="border-b dark:border-gray-700 pb-4 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              今週のスケジュール表示数
            </h3>
            <div className="flex gap-3">
              {[3, 5, 10].map((count) => (
                <button
                  key={count}
                  onClick={() => {
                    if (!config) return;
                    setConfig({
                      ...config,
                      weeklyScheduleCount: count as 3 | 5 | 10,
                    });
                  }}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    config?.weeklyScheduleCount === count
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {count}件
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {config?.weeklyScheduleCount === 10
                ? '10件の場合は5件分のサイズで表示し、6件目以降は横スクロールで表示されます。'
                : `${config?.weeklyScheduleCount || 5}件の場合は画面幅一杯に表示されます。`}
            </p>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400">
            ウィジェットの表示/非表示、追加ボタンの表示、並び順を設定できます。ドラッグ&ドロップで順序を変更できます。
          </p>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="widgets">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                  {(config?.widgets ?? [])
                    .sort((a, b) => a.order - b.order)
                    .map((widget, index) => (
                      <Draggable key={widget.key} draggableId={widget.key} index={index}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3 ${
                              snapshot.isDragging ? 'bg-blue-50 dark:bg-blue-900/20 shadow-lg' : 'bg-white dark:bg-gray-800'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div {...provided.dragHandleProps} className="cursor-grab active:cursor-grabbing">
                                  <GripVertical className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                                </div>
                                <div>
                                  <h3 className="font-medium text-gray-900 dark:text-gray-100">
                                    {widgetLabels[widget.key] || widget.key}
                                  </h3>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">順序: {widget.order}</p>
                                </div>
                              </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={widget.enabled}
                        onChange={() => handleToggleEnabled(widget.key)}
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600 rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">表示</span>
                    </label>
                  </div>

                  {widget.enabled && (
                    <div className="pl-8 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          表示モード
                        </label>
                        <select
                          value={widget.displayMode || 'view-only'}
                          onChange={(e) => handleChangeDisplayMode(widget.key, e.target.value as DisplayMode)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent"
                        >
                          <option value="view-only">表示のみ</option>
                          <option value="view-with-add">表示+追加ボタン</option>
                          <option value="add-only">追加ボタンのみ</option>
                        </select>
                      </div>
                      {(widget.key === 'goals' || widget.key === 'eventParticipation') && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            カラム幅
                          </label>
                          <select
                            value={widget.columnSpan || 1}
                            onChange={(e) => handleChangeColumnSpan(widget.key, parseInt(e.target.value) as ColumnSpan)}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent"
                          >
                            <option value="1">1カラム</option>
                            <option value="2">2カラム</option>
                          </select>
                        </div>
                      )}
                      {widget.key === 'contacts' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            表示人数
                          </label>
                          <select
                            value={widget.contactCount || 3}
                            onChange={(e) => handleChangeContactCount(widget.key, parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary focus:border-transparent"
                          >
                            <option value="1">1名</option>
                            <option value="2">2名</option>
                            <option value="3">3名</option>
                          </select>
                        </div>
                      )}
                      {/* 後方互換性のため残す */}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={widget.showAddButton || false}
                          onChange={() => handleToggleAddButton(widget.key)}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600 rounded"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">追加ボタンを表示（後方互換）</span>
                      </label>
                    </div>
                  )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>

        <div className="flex justify-end gap-3 p-6 border-t dark:border-gray-700 flex-shrink-0">
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  );
};

