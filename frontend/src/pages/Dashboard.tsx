import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, FileText, Clock, Inbox, Check, X, Settings } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../utils/api';
import { Schedule } from '../types';
import { formatDate, getWeekRange } from '../utils/date';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardCustomizeModal } from '../components/dashboard/DashboardCustomizeModal';
import { SNSHistoryWidget } from '../components/dashboard/SNSHistoryWidget';
import { TaskRequestsWidget } from '../components/dashboard/TaskRequestsWidget';
import { ProjectsWidget } from '../components/dashboard/ProjectsWidget';
import { GoalsWidget } from '../components/dashboard/GoalsWidget';
import { TasksWidget } from '../components/dashboard/TasksWidget';
import { EventsWidget } from '../components/dashboard/EventsWidget';
import { SNSLinksWidget } from '../components/dashboard/SNSLinksWidget';
import { TaskRequestModal } from '../components/taskRequest/TaskRequestModal';
import { SNSPostDetailModal } from '../components/sns/SNSPostDetailModal';
import { ContactsWidget } from '../components/dashboard/ContactsWidget';
import { EventParticipationWidget } from '../components/dashboard/EventParticipationWidget';
import { ContactModal } from '../components/contact/ContactModal';

interface InboxData {
  scheduleInvites: Array<{
    participantId: string;
    scheduleId: string;
    fromUser: { id: string; name: string; avatarColor: string };
    title: string;
    date: string;
    startTime: string;
    endTime: string;
    status: string;
    createdAt: string;
  }>;
  scheduleResponses: Array<{
    scheduleId: string;
    scheduleTitle: string;
    toUser: { id: string; name: string; avatarColor: string };
    decision: 'APPROVED' | 'REJECTED';
    respondedAt: string;
  }>;
  taskRequests: Array<{ // 後方互換性のため残す（実際はrequests）
    id: string;
    requester: { id: string; name: string; avatarColor: string };
    requestTitle: string;
    requestDescription: string;
    deadline?: string;
    project?: { id: string; projectName: string };
    approvalStatus: string;
    createdAt: string;
  }>;
}

type DisplayMode = 'view-only' | 'view-with-add' | 'add-only';
type ColumnSpan = 1 | 2;

interface WidgetConfig {
  key: string;
  enabled: boolean;
  displayMode?: DisplayMode;
  showAddButton?: boolean; // 後方互換性のため残す
  size?: 'S' | 'M' | 'L';
  columnSpan?: ColumnSpan;
  order: number;
}

interface DashboardConfig {
  widgets: WidgetConfig[];
}

export const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
  const [isTaskRequestModalOpen, setIsTaskRequestModalOpen] = useState(false);
  const [isSNSPostModalOpen, setIsSNSPostModalOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  // 受信箱データ取得
  const { data: inboxData, isLoading: inboxLoading } = useQuery<InboxData>({
    queryKey: ['inbox'],
    queryFn: async () => {
      const response = await api.get('/api/inbox');
      return response.data;
    },
    refetchInterval: 30000, // 30秒ごとに更新
  });

  // デフォルト設定（role別）※API失敗時のフォールバック。通常はAPIが全8件を返す
  const getDefaultConfig = (role: string = 'MEMBER'): DashboardConfig => {
    const baseWidgets = [
      { key: 'snsHistory', enabled: true, displayMode: 'view-with-add' as const, showAddButton: true, size: 'M' as const, columnSpan: 2 as const, order: 1 },
      { key: 'taskRequests', enabled: true, displayMode: 'view-only' as const, showAddButton: false, size: 'L' as const, columnSpan: 2 as const, order: 2 },
      { key: 'projects', enabled: false, displayMode: 'view-only' as const, showAddButton: false, size: 'M' as const, columnSpan: 2 as const, order: 3 },
      { key: 'goals', enabled: false, displayMode: 'view-only' as const, showAddButton: false, size: 'M' as const, columnSpan: 1 as const, order: 4 },
      { key: 'tasks', enabled: false, displayMode: 'view-with-add' as const, showAddButton: true, size: 'M' as const, columnSpan: 2 as const, order: 5 },
      { key: 'events', enabled: false, displayMode: 'view-with-add' as const, showAddButton: true, size: 'M' as const, columnSpan: 2 as const, order: 6 },
      { key: 'contacts', enabled: false, displayMode: 'add-only' as const, showAddButton: false, size: 'M' as const, columnSpan: 2 as const, order: 7 },
      { key: 'eventParticipation', enabled: false, displayMode: 'view-only' as const, showAddButton: false, size: 'L' as const, columnSpan: 1 as const, order: 8 },
    ];

    if (role === 'MEMBER') {
      return {
        widgets: [
          { ...baseWidgets[0], enabled: true },
          { ...baseWidgets[1], enabled: false },
          { ...baseWidgets[2], enabled: true },
          { ...baseWidgets[3], enabled: true },
          { ...baseWidgets[4], enabled: true },
          { ...baseWidgets[5], enabled: true },
        ],
      };
    } else if (role === 'SUPPORT' || role === 'GOVERNMENT') {
      return {
        widgets: [
          { ...baseWidgets[0], enabled: false },
          { ...baseWidgets[1], enabled: true },
          { ...baseWidgets[2], enabled: true },
          { ...baseWidgets[3], enabled: false },
          { ...baseWidgets[4], enabled: true },
          { ...baseWidgets[5], enabled: true },
          { ...baseWidgets[6], enabled: true },
          { ...baseWidgets[7], enabled: true },
        ],
      };
    } else if (role === 'MASTER') {
      return { widgets: baseWidgets.map((w, i) => ({ ...w, enabled: true, order: i + 1 })) };
    }

    return { widgets: baseWidgets };
  };

  // ダッシュボード設定取得（エラー時はデフォルト設定でフォールバック）
  const { data: dashboardConfig } = useQuery<DashboardConfig>({
    queryKey: ['dashboard-config'],
    queryFn: async () => {
      try {
        const response = await api.get('/api/me/dashboard-config');
        return response.data;
      } catch (error: any) {
        console.error('[Dashboard] Failed to fetch dashboard config:', error);
        // エラー時はデフォルト設定を返す（無限ローディングを防ぐ）
        return getDefaultConfig(user?.role || 'MEMBER');
      }
    },
    retry: 1, // リトライは1回のみ
    staleTime: 30000, // 30秒間キャッシュ
  });

  useEffect(() => {
    fetchThisWeekSchedules();
  }, [user]);

  const fetchThisWeekSchedules = async () => {
    try {
      const { start, end } = getWeekRange();
      const params = new URLSearchParams({
        startDate: formatDate(start),
        endDate: formatDate(end),
      });

      // MEMBERの場合は自分のスケジュールのみ、他は全員のスケジュール
      if (user?.role === 'MEMBER') {
        params.append('userId', user.id);
      }

      const response = await api.get<Schedule[]>(`/api/schedules?${params}`);
      const data = response.data;
      // 配列であることを確認
      setSchedules(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch schedules:', error);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  };

  // スケジュール招待への応答
  const handleScheduleInviteResponse = async (scheduleId: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      await api.post(`/api/schedules/${scheduleId}/respond`, { decision });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      window.dispatchEvent(new CustomEvent('schedule-updated'));
    } catch (error) {
      console.error('Failed to respond to schedule invite:', error);
      alert('応答に失敗しました');
    }
  };

  // 依頼への応答
  const handleRequestResponse = async (requestId: string, decision: 'APPROVED' | 'REJECTED') => {
    try {
      await api.post(`/api/requests/${requestId}/respond`, {
        approvalStatus: decision,
      });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    } catch (error) {
      console.error('Failed to respond to task request:', error);
      alert('応答に失敗しました');
    }
  };

  const totalInboxCount = (inboxData?.scheduleInvites?.length || 0) + (inboxData?.taskRequests?.length || 0); // taskRequestsは後方互換性のため残す

  const renderWidget = (widget: WidgetConfig) => {
    const displayMode = widget.displayMode || (widget.showAddButton ? 'view-with-add' : 'view-only');
    
    const commonProps = {
      displayMode,
      showAddButton: displayMode === 'view-with-add' || displayMode === 'add-only',
      onAddClick:
        widget.key === 'taskRequests'
          ? () => setIsTaskRequestModalOpen(true)
          : widget.key === 'contacts'
          ? () => setIsContactModalOpen(true)
          : undefined,
    };

    const widgetElement = (() => {
      switch (widget.key) {
        case 'snsHistory':
          return <SNSHistoryWidget key={widget.key} {...commonProps} />;
        case 'taskRequests':
          return <TaskRequestsWidget key={widget.key} {...commonProps} />;
        case 'projects':
          return <ProjectsWidget key={widget.key} {...commonProps} />;
        case 'goals':
          return <GoalsWidget key={widget.key} {...commonProps} />;
        case 'tasks':
          return <TasksWidget key={widget.key} {...commonProps} />;
        case 'events':
          return <EventsWidget key={widget.key} {...commonProps} />;
        case 'contacts':
          return <ContactsWidget key={widget.key} {...commonProps} />;
        case 'eventParticipation':
          return <EventParticipationWidget key={widget.key} {...commonProps} />;
        default:
          return null;
      }
    })();

    if (!widgetElement) return null;

    // 1カラム(columnSpan=1) = 幅広 = md:col-span-2 / 2カラム(2) = 通常 = 1ブロック
    const isFullWidth = (widget.columnSpan ?? 2) === 1;
    return (
      <div key={widget.key} className={isFullWidth ? 'md:col-span-2' : ''}>
        {widgetElement}
      </div>
    );
  };

  let enabledWidgets = (dashboardConfig?.widgets
    .filter((w) => w.enabled)
    .sort((a, b) => a.order - b.order) || []).slice();

  // 1カラム(幅広)ウィジェットが偶数番目(右側)になる場合、はみ出しを防ぐため前のウィジェットと入れ替え
  for (let i = 1; i < enabledWidgets.length; i++) {
    const isEvenPosition = (i + 1) % 2 === 0;
    const isFullWidth = (enabledWidgets[i].columnSpan ?? 2) === 1;
    if (isEvenPosition && isFullWidth) {
      [enabledWidgets[i], enabledWidgets[i - 1]] = [enabledWidgets[i - 1], enabledWidgets[i]];
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">ダッシュボード</h1>
          <p className="mt-2 text-gray-600">ようこそ、{user?.name}さん</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsCustomizeModalOpen(true)}
          className="flex items-center gap-2"
        >
          <Settings className="w-4 h-4" />
          カスタマイズ
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Link
          to="/schedule"
          className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow border border-border"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-gray-600">スケジュール</p>
              <p className="text-2xl font-bold text-gray-900">
                {schedules.length}件
              </p>
            </div>
          </div>
        </Link>

        <Link
          to="/reports/weekly"
          className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow border border-border"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-secondary/10 rounded-lg">
              <FileText className="h-6 w-6 text-secondary" />
            </div>
            <div>
              <p className="text-sm text-gray-600">週次報告</p>
              <p className="text-2xl font-bold text-gray-900">今週</p>
            </div>
          </div>
        </Link>

        <div className="bg-white p-6 rounded-lg shadow border border-border">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-accent/10 rounded-lg">
              <Clock className="h-6 w-6 text-accent" />
            </div>
            <div>
              <p className="text-sm text-gray-600">今週の活動時間</p>
              <p className="text-2xl font-bold text-gray-900">
                {schedules.length * 8}h
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border border-border">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Inbox className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">受信箱</p>
              <p className="text-2xl font-bold text-gray-900">
                {totalInboxCount}件
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 受信箱セクション */}
      {totalInboxCount > 0 && (
        <div className="bg-white rounded-lg shadow border border-border p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">受信箱</h2>
          
          {inboxLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="space-y-4">
              {/* スケジュール招待 */}
              {inboxData?.scheduleInvites && inboxData.scheduleInvites.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">スケジュール招待</h3>
                  <div className="space-y-3">
                    {inboxData.scheduleInvites.map((invite) => (
                      <div
                        key={invite.participantId}
                        className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                                style={{ backgroundColor: invite.fromUser.avatarColor }}
                              >
                                {invite.fromUser.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">{invite.fromUser.name}さんからの招待</p>
                                <p className="text-sm text-gray-600">{invite.title}</p>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 ml-10">
                              {formatDate(invite.date, 'M月d日(E)')} {invite.startTime} - {invite.endTime}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleScheduleInviteResponse(invite.scheduleId, 'APPROVED')}
                              className="flex items-center gap-1"
                            >
                              <Check className="w-4 h-4" />
                              承認
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleScheduleInviteResponse(invite.scheduleId, 'REJECTED')}
                              className="flex items-center gap-1"
                            >
                              <X className="w-4 h-4" />
                              却下
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* スケジュール承認結果 */}
              {inboxData?.scheduleResponses && inboxData.scheduleResponses.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">承認結果</h3>
                  <div className="space-y-2">
                    {inboxData.scheduleResponses.map((response, index) => (
                      <div
                        key={`${response.scheduleId}-${response.toUser.id}-${index}`}
                        className="p-3 border border-gray-200 rounded-lg bg-gray-50"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                            style={{ backgroundColor: response.toUser.avatarColor }}
                          >
                            {response.toUser.name.charAt(0)}
                          </div>
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">{response.toUser.name}</span>さんが
                            <span className="font-medium">{response.scheduleTitle}</span>への参加を
                            <span className={response.decision === 'APPROVED' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                              {response.decision === 'APPROVED' ? '承認' : '却下'}
                            </span>
                            しました
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* タスクボックス（メンバー向け） */}
              {inboxData?.taskRequests && inboxData.taskRequests.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">
                    {user?.role === 'MEMBER' ? '依頼ボックス' : '依頼'}
                  </h3>
                  <div className="space-y-3">
                    {inboxData.taskRequests.map((request) => (
                      <div
                        key={request.id}
                        className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                                style={{ backgroundColor: request.requester.avatarColor }}
                              >
                                {request.requester.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900">
                                  {user?.role === 'MEMBER' 
                                    ? `${request.requester.name}さんからのタスク`
                                    : `${request.requester.name}さんからの依頼`}
                                </p>
                                <p className="text-sm text-gray-600">{request.requestTitle}</p>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 ml-10">{request.requestDescription}</p>
                            {request.deadline && (
                              <p className="text-xs text-gray-500 ml-10 mt-1">
                                期限: {formatDate(request.deadline, 'M月d日')}
                              </p>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleRequestResponse(request.id, 'APPROVED')}
                              className="flex items-center gap-1"
                            >
                              <Check className="w-4 h-4" />
                              承認
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRequestResponse(request.id, 'REJECTED')}
                              className="flex items-center gap-1"
                            >
                              <X className="w-4 h-4" />
                              却下
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg shadow border border-border p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">今週のスケジュール</h2>
          <Link to="/schedule">
            <Button variant="outline" size="sm">
              すべて見る
            </Button>
          </Link>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : schedules.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            今週のスケジュールはありません
          </p>
        ) : (
          <div className="space-y-3">
            {Array.isArray(schedules) && schedules.slice(0, 5).map((schedule) => {
              const participantCount = schedule.scheduleParticipants?.filter(p => p.status === 'APPROVED').length || 0;
              return (
                <div
                  key={schedule.id}
                  className="flex items-start space-x-4 p-4 border border-border rounded-lg hover:bg-gray-50"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: schedule.user?.avatarColor || '#6B7280' }}
                  >
                    {schedule.user?.name?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900">
                        {schedule.activityDescription}
                      </p>
                      {participantCount > 0 && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          +{participantCount}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {formatDate(schedule.date, 'M月d日(E)')} {schedule.startTime} -{' '}
                      {schedule.endTime}
                    </p>
                    {schedule.locationText && (
                      <p className="text-sm text-gray-500">{schedule.locationText}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SNSリンク（固定表示） */}
      <SNSLinksWidget />

      {/* カスタムウィジェットエリア */}
      {enabledWidgets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {enabledWidgets.map((widget) => renderWidget(widget))}
        </div>
      )}

      {/* カスタマイズモーダル */}
      <DashboardCustomizeModal
        isOpen={isCustomizeModalOpen}
        onClose={() => setIsCustomizeModalOpen(false)}
      />

      {/* 依頼追加モーダル */}
      {isTaskRequestModalOpen && (
        <TaskRequestModal
          onClose={() => setIsTaskRequestModalOpen(false)}
          onSaved={() => {
            setIsTaskRequestModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['requests'] });
          }}
        />
      )}

      {/* SNS投稿追加モーダル */}
      {isSNSPostModalOpen && (
        <SNSPostDetailModal
          isOpen={isSNSPostModalOpen}
          onClose={() => setIsSNSPostModalOpen(false)}
          onSaved={() => {
            setIsSNSPostModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['sns-posts'] });
            queryClient.invalidateQueries({ queryKey: ['sns-weekly-status'] });
          }}
        />
      )}

      {/* 町民データベース追加モーダル */}
      {isContactModalOpen && (
        <ContactModal
          contact={null}
          onClose={() => setIsContactModalOpen(false)}
          onSaved={() => {
            setIsContactModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
          }}
        />
      )}
    </div>
  );
};
