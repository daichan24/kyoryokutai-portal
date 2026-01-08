import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { DashboardWidget } from '@/types';
import { Settings, GripVertical } from 'lucide-react';

interface CustomizableDashboardProps {
  userId: string;
  children: React.ReactNode[];
}

const defaultWidgets: DashboardWidget[] = [
  { id: 'alerts', name: 'アラート', isVisible: true, order: 0, isFixed: true },
  { id: 'weekly-schedule', name: '今週のスケジュール', isVisible: true, order: 1, isFixed: true },
  { id: 'goal-progress', name: '起業準備進捗', isVisible: true, order: 2, isFixed: true },
  { id: 'tasks', name: 'タスク一覧', isVisible: true, order: 3, isFixed: true },
  { id: 'event-points', name: 'イベントポイント', isVisible: true, order: 4 },
  { id: 'sns-posts', name: 'SNS投稿状況', isVisible: true, order: 5 },
  { id: 'team-schedule', name: 'チーム全体のスケジュール', isVisible: false, order: 6 },
  { id: 'projects', name: 'プロジェクト一覧', isVisible: false, order: 7 },
];

export function CustomizableDashboard({ userId, children }: CustomizableDashboardProps) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>(defaultWidgets);
  const [isCustomizing, setIsCustomizing] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [userId]);

  const loadSettings = () => {
    const saved = localStorage.getItem(`dashboardSettings_${userId}`);
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        setWidgets(settings.widgets);
      } catch (error) {
        console.error('Failed to load dashboard settings:', error);
      }
    }
  };

  const saveSettings = (newWidgets: DashboardWidget[]) => {
    localStorage.setItem(
      `dashboardSettings_${userId}`,
      JSON.stringify({ userId, widgets: newWidgets })
    );
    setWidgets(newWidgets);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(widgets);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    const updatedWidgets = items.map((item, index) => ({
      ...item,
      order: index,
    }));

    saveSettings(updatedWidgets);
  };

  const handleToggleVisibility = (id: string) => {
    const updatedWidgets = widgets.map((w) =>
      w.id === id ? { ...w, isVisible: !w.isVisible } : w
    );
    saveSettings(updatedWidgets);
  };

  const handleReset = () => {
    if (confirm('ダッシュボードをデフォルト設定にリセットしますか?')) {
      saveSettings(defaultWidgets);
      setIsCustomizing(false);
    }
  };

  const visibleWidgets = widgets.filter((w) => w.isVisible).sort((a, b) => a.order - b.order);

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <div className="flex gap-2">
          {isCustomizing && (
            <Button variant="outline" onClick={handleReset} size="sm">
              リセット
            </Button>
          )}
          <Button
            variant={isCustomizing ? 'default' : 'outline'}
            onClick={() => setIsCustomizing(!isCustomizing)}
            size="sm"
            className="flex items-center gap-2"
          >
            <Settings className="w-4 h-4" />
            {isCustomizing ? '完了' : 'カスタマイズ'}
          </Button>
        </div>
      </div>

      {isCustomizing ? (
        <Card className="p-4 mb-6">
          <h3 className="font-semibold mb-4">ウィジェット設定</h3>
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="widgets">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                  {widgets.map((widget, index) => (
                    <Draggable
                      key={widget.id}
                      draggableId={widget.id}
                      index={index}
                      isDragDisabled={widget.isFixed}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`flex items-center gap-3 p-3 bg-white border rounded ${
                            snapshot.isDragging ? 'shadow-lg' : ''
                          } ${widget.isFixed ? 'opacity-60' : ''}`}
                        >
                          <div {...provided.dragHandleProps}>
                            <GripVertical
                              className={`w-5 h-5 ${
                                widget.isFixed ? 'text-gray-300' : 'text-gray-400'
                              }`}
                            />
                          </div>
                          <div className="flex-1 flex items-center justify-between">
                            <div>
                              <span className="font-medium">{widget.name}</span>
                              {widget.isFixed && (
                                <span className="text-xs text-gray-500 ml-2">(固定)</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`toggle-${widget.id}`} className="text-sm">
                                表示
                              </Label>
                              <Switch
                                id={`toggle-${widget.id}`}
                                checked={widget.isVisible}
                                onCheckedChange={() => handleToggleVisibility(widget.id)}
                                disabled={widget.isFixed}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {visibleWidgets.map((widget, index) => (
          <div key={widget.id}>{children[index] || null}</div>
        ))}
      </div>
    </div>
  );
}
