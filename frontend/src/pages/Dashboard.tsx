import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Megaphone, Clock, Inbox, Check, X, Settings } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useStaffWorkspace, type StaffWorkspaceMode } from '../stores/workspaceStore';
import { api } from '../utils/api';
import { Schedule } from '../types';
import { formatDate, getWeekRange } from '../utils/date';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardCustomizeModal } from '../components/dashboard/DashboardCustomizeModal';
import { SNSHistoryWidget } from '../components/dashboard/SNSHistoryWidget';
import { ProjectsWidget } from '../components/dashboard/ProjectsWidget';
import { GoalsWidget } from '../components/dashboard/GoalsWidget';
import { TasksWidget } from '../components/dashboard/TasksWidget';
import { EventsWidget } from '../components/dashboard/EventsWidget';
import { SNSLinksWidget } from '../components/dashboard/SNSLinksWidget';
import { SNSPostDetailModal } from '../components/sns/SNSPostDetailModal';
import { ContactsWidget } from '../components/dashboard/ContactsWidget';
import { EventParticipationWidget } from '../components/dashboard/EventParticipationWidget';
import { NextWishWidget } from '../components/dashboard/NextWishWidget';
import { WeeklyScheduleWidget } from '../components/dashboard/WeeklyScheduleWidget';
import { ContactModal } from '../components/contact/ContactModal';

interface InboxData {
  scheduleInvites: Array<{
    participantId: string;
    scheduleId: string;
    fromUser: { id: string; name: string; avatarColor: string; avatarLetter?: string | null };
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
    toUser: { id: string; name: string; avatarColor: string; avatarLetter?: string | null };
    decision: 'APPROVED' | 'REJECTED';
    respondedAt: string;
  }>;
  taskRequests: Array<{ // 後方互換性のため残す（実際はrequests）
    id: string;
    requester: { id: string; name: string; avatarColor: string; avatarLetter?: string | null };
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
  weeklyScheduleCount?: 3 | 5 | 10; // 今週のスケジュールの表示数
}

export const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { isStaff, workspaceMode, setWorkspaceMode } = useStaffWorkspace();

  const invalidateDataScopeQueries = useCallback(() => {
    const keys: (string | string[])[] = [
      'missions',
      'projects',
      'tasks',
      'schedules',
      'goals-widget',
      'projects-widget',
      'tasks-widget',
      'wishes',
      'requests',
      'sns-posts',
      'sns-weekly-status',
      'inbox',
    ];
    keys.forEach((k) => queryClient.invalidateQueries({ queryKey: Array.isArray(k) ? k : [k] }));
  }, [queryClient]);

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [weeklyScheduleCount, setWeeklyScheduleCount] = useState<3 | 5 | 10>(5);
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
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

  const { data: announcementUnread } = useQuery({
    queryKey: ['announcements', 'unread-count'],
    queryFn: async () => {
      const r = await api.get<{ count: number }>('/api/announcements/unread-count');
      return r.data;
    },
    enabled: user?.role === 'MEMBER',
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: staffAnnouncements = [] } = useQuery({
    queryKey: ['announcements', 'list', 'staff'],
    queryFn: async () => {
      const r = await api.get<{ id: string }[]>('/api/announcements');
      return r.data || [];
    },
    enabled: !!user && user.role !== 'MEMBER',
    staleTime: 60_000,
  });

  // デフォルト設定（role別）※API失敗時のフォールバック。通常はAPIが全8件を返す
  const getDefaultConfig = (role: string = 'MEMBER'): DashboardConfig => {
    const tail = [
      { key: 'projects', enabled: false, displayMode: 'view-only' as const, showAddButton: false, size: 'M' as const, columnSpan: 2 as const, order: 3 },
      { key: 'tasks', enabled: false, displayMode: 'view-with-add' as const, showAddButton: true, size: 'M' as const, columnSpan: 2 as const, order: 5 },
      { key: 'events', enabled: false, displayMode: 'view-with-add' as const, showAddButton: true, size: 'M' as const, columnSpan: 2 as const, order: 6 },
      { key: 'contacts', enabled: false, displayMode: 'add-only' as const, showAddButton: false, size: 'M' as const, columnSpan: 2 as const, order: 7 },
      { key: 'eventParticipation', enabled: false, displayMode: 'view-only' as const, showAddButton: false, size: 'L' as const, columnSpan: 1 as const, order: 8 },
      { key: 'nextWish', enabled: false, displayMode: 'view-only' as const, showAddButton: false, size: 'M' as const, columnSpan: 2 as const, order: 9 },
    ];
    const sns = { key: 'snsHistory', enabled: true, displayMode: 'view-with-add' as const, showAddButton: true, size: 'M' as const, columnSpan: 2 as const, order: 1 };

    let baseWidgets: typeof tail & { key: string }[];
    if (role !== 'MEMBER') {
      baseWidgets = [
        sns,
        { key: 'goals-personal', enabled: false, displayMode: 'view-only' as const, showAddButton: false, size: 'M' as const, columnSpan: 1 as const, order: 4 },
        { key: 'goals-view', enabled: false, displayMode: 'view-only' as const, showAddButton: false, size: 'M' as const, columnSpan: 1 as const, order: 4.5 },
        ...tail,
      ] as any;
    } else {
      baseWidgets = [
        sns,
        { key: 'goals', enabled: false, displayMode: 'view-only' as const, showAddButton: false, size: 'M' as const, columnSpan: 1 as const, order: 4 },
        ...tail,
      ] as any;
    }

    if (role === 'MEMBER') {
      return {
        widgets: [
          { ...baseWidgets[0], enabled: true },
          { ...baseWidgets[1], enabled: true },
          { ...baseWidgets[2], enabled: true },
          { ...baseWidgets[3], enabled: true },
          { ...baseWidgets[4], enabled: true },
          { ...baseWidgets[5], enabled: true },
          { ...baseWidgets[6], enabled: false },
          { ...baseWidgets[7], enabled: false },
        ].map((w, i) => ({ ...w, order: i + 1 })),
      };
    } else if (role === 'SUPPORT' || role === 'GOVERNMENT') {
      return {
        widgets: baseWidgets.map((w: any, i: number) => {
          let enabled = true;
          if (w.key === 'snsHistory') enabled = false;
          if (w.key === 'goals-personal' || w.key === 'goals-view') enabled = false;
          if (w.key === 'nextWish') enabled = false;
          return { ...w, enabled, order: i + 1 };
        }),
      };
    } else if (role === 'MASTER') {
      return { widgets: baseWidgets.map((w: any, i: number) => ({ ...w, enabled: true, order: i + 1 })) };
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

  const fetchThisWeekSchedules = useCallback(async () => {
    if (!user) {
      setSchedules([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const { start, end } = getWeekRange();
      const params = new URLSearchParams({
        startDate: formatDate(start),
        endDate: formatDate(end),
      });

      if (user.role === 'MEMBER') {
        params.append('userId', user.id);
      } else if (
        isStaff &&
        workspaceMode === 'browse'
      ) {
        params.append('allMembers', 'true');
      }

      const response = await api.get<Schedule[]>(`/api/schedules?${params}`);
      const data = response.data;
      setSchedules(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch schedules:', error);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [user, isStaff, workspaceMode]);

  const applyWorkspaceMode = useCallback(
    (mode: StaffWorkspaceMode) => {
      setWorkspaceMode(mode);
      invalidateDataScopeQueries();
    },
    [setWorkspaceMode, invalidateDataScopeQueries]
  );

  useEffect(() => {
    fetchThisWeekSchedules();
  }, [fetchThisWeekSchedules]);

  // 週次スケジュール表示数の設定を反映
  useEffect(() => {
    if (dashboardConfig?.weeklyScheduleCount) {
      setWeeklyScheduleCount(dashboardConfig.weeklyScheduleCount);
    }
  }, [dashboardConfig]);


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

  const totalInboxCount = inboxData?.scheduleInvites?.length || 0;

  const renderWidget = (widget: WidgetConfig) => {
    const displayMode = widget.displayMode || (widget.showAddButton ? 'view-with-add' : 'view-only');
    
    const commonProps = {
      displayMode,
      showAddButton: displayMode === 'view-with-add' || displayMode === 'add-only',
      onAddClick: widget.key === 'contacts' ? () => setIsContactModalOpen(true) : undefined,
      ...(widget.key === 'contacts' && { contactCount: (widget as any).contactCount || 3 }),
    };

    const widgetElement = (() => {
      switch (widget.key) {
        case 'snsHistory':
          return <SNSHistoryWidget key={widget.key} {...commonProps} />;
        case 'projects':
          return <ProjectsWidget key={widget.key} {...commonProps} />;
        case 'goals':
          return <GoalsWidget key={widget.key} {...commonProps} viewMode="personal" />;
        case 'goals-personal':
          return <GoalsWidget key={widget.key} {...commonProps} viewMode="personal" />;
        case 'goals-view':
          return <GoalsWidget key={widget.key} {...commonProps} viewMode="view" />;
        case 'tasks':
          return <TasksWidget key={widget.key} {...commonProps} />;
        case 'events':
          return <EventsWidget key={widget.key} {...commonProps} />;
        case 'contacts':
          return <ContactsWidget key={widget.key} {...commonProps} />;
        case 'eventParticipation':
          return <EventParticipationWidget key={widget.key} {...commonProps} />;
        case 'nextWish':
          return <NextWishWidget key={widget.key} {...commonProps} />;
        default:
          return null;
      }
    })();

    if (!widgetElement) return null;

    // 1カラム(columnSpan=1) = 幅広 = md:col-span-2 / 2カラム(2) = 通常 = 1ブロック
    const isFullWidth = (widget.columnSpan ?? 2) === 1;
    return (
      <div 
        key={widget.key} 
        className={`${isFullWidth ? 'md:col-span-2' : ''} flex flex-col`}
        style={{ minHeight: '100%' }}
      >
        <div className="flex-1 flex flex-col">
          {widgetElement}
        </div>
      </div>
    );
  };

  let enabledWidgets = (dashboardConfig?.widgets
    .filter((w) => w.enabled && w.key !== 'taskRequests')
    .sort((a, b) => a.order - b.order) || []).slice();

  const isStaffUser =
    user?.role === 'MASTER' || user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT';
  if (isStaffUser) {
    const goalWidgetKeys = new Set(['goals', 'goals-personal', 'goals-view']);
    let goalWidgetKept = false;
    enabledWidgets = enabledWidgets.filter((w) => {
      if (!goalWidgetKeys.has(w.key)) return true;
      if (goalWidgetKept) return false;
      goalWidgetKept = true;
      return true;
    });
  }

  // カラムルールを守るため、ウィジェットを再配置
  // 1カラム(幅広)ウィジェットが偶数番目(右側)になる場合、はみ出しを防ぐため前のウィジェットと入れ替え
  // また、連続する幅広ウィジェットが2つ以上ある場合は、次の行に配置
  let currentRowPosition = 0;
  const reorderedWidgets: WidgetConfig[] = [];
  
  for (let i = 0; i < enabledWidgets.length; i++) {
    const widget = enabledWidgets[i];
    const isFullWidth = (widget.columnSpan ?? 2) === 1;
    
    if (isFullWidth) {
      // 幅広ウィジェットは常に新しい行の先頭に配置
      if (currentRowPosition > 0) {
        // 現在の行が空でない場合は、次の行に配置
        currentRowPosition = 0;
      }
      reorderedWidgets.push(widget);
      currentRowPosition += 2; // 幅広ウィジェットは2カラム分を占める
    } else {
      // 通常のウィジェット
      if (currentRowPosition >= 2) {
        // 現在の行が満杯の場合は、次の行に配置
        currentRowPosition = 0;
      }
      reorderedWidgets.push(widget);
      currentRowPosition += 1; // 通常のウィジェットは1カラム分を占める
    }
    
    // 行が満杯になったら次の行へ
    if (currentRowPosition >= 2) {
      currentRowPosition = 0;
    }
  }
  
  enabledWidgets = reorderedWidgets;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl whitespace-nowrap font-bold text-gray-900 dark:text-gray-100">ダッシュボード</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">ようこそ、{user?.name}さん</p>
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

      {isStaff && (
        <div className="bg-card dark:bg-gray-800 rounded-xl border border-border dark:border-gray-700 p-4 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">表示モード（個人 / 閲覧）</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed max-w-2xl">
                ミッション・プロジェクト・タスク・スケジュール・SNS・やりたいことなど、画面全体で同じ基準が使われます。ここで選んだモードはこのブラウザに保存され、次回ログイン時も維持されます。
              </p>
            </div>
            <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 p-1 bg-gray-50 dark:bg-gray-900/60 shrink-0">
              <button
                type="button"
                onClick={() => applyWorkspaceMode('personal')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  workspaceMode === 'personal'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/80 dark:hover:bg-gray-700'
                }`}
              >
                個人
              </button>
              <button
                type="button"
                onClick={() => applyWorkspaceMode('browse')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  workspaceMode === 'browse'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200/80 dark:hover:bg-gray-700'
                }`}
              >
                閲覧
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Link
          to="/schedule"
          className="bg-card dark:bg-gray-800 p-6 rounded-lg shadow hover:shadow-lg transition-shadow border border-border dark:border-gray-700"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-primary/10 dark:bg-primary/20 rounded-lg">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">スケジュール</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {schedules.length}件
              </p>
            </div>
          </div>
        </Link>

        <Link
          to="/announcements"
          className="bg-card dark:bg-gray-800 p-6 rounded-lg shadow hover:shadow-lg transition-shadow border border-border dark:border-gray-700"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-primary/10 dark:bg-primary/20 rounded-lg">
              <Megaphone className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">お知らせ</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {user?.role === 'MEMBER'
                  ? `未読 ${announcementUnread?.count ?? '—'} 件`
                  : `全 ${staffAnnouncements.length} 件`}
              </p>
            </div>
          </div>
        </Link>

        <div className="bg-card dark:bg-gray-800 p-6 rounded-lg shadow border border-border dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-accent/10 dark:bg-accent/20 rounded-lg">
              <Clock className="h-6 w-6 text-accent" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">今週の活動時間</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {schedules.length * 8}h
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card dark:bg-gray-800 p-6 rounded-lg shadow border border-border dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Inbox className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">受付ボックス</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {totalInboxCount}件
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 受付ボックスセクション */}
      {totalInboxCount > 0 && (
        <div className="bg-card dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">受付ボックス</h2>
          
          {inboxLoading ? (
            <LoadingSpinner />
          ) : (
            <div className="space-y-4">
              {/* スケジュール招待 */}
              {inboxData?.scheduleInvites && inboxData.scheduleInvites.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">スケジュール招待</h3>
                  <div className="space-y-3">
                    {inboxData.scheduleInvites.map((invite) => (
                      <div
                        key={invite.participantId}
                        className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                                style={{ backgroundColor: invite.fromUser.avatarColor }}
                              >
                                {(invite.fromUser.avatarLetter || invite.fromUser.name || '').charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 dark:text-gray-100">{invite.fromUser.name}さんからの招待</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{invite.title}</p>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400 ml-10">
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
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3">承認結果</h3>
                  <div className="space-y-2">
                    {inboxData.scheduleResponses.map((response, index) => (
                      <div
                        key={`${response.scheduleId}-${response.toUser.id}-${index}`}
                        className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                            style={{ backgroundColor: response.toUser.avatarColor }}
                          >
                            {(response.toUser.avatarLetter || response.toUser.name || '').charAt(0)}
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            <span className="font-medium">{response.toUser.name}</span>さんが
                            <span className="font-medium">{response.scheduleTitle}</span>への参加を
                            <span className={response.decision === 'APPROVED' ? 'text-green-600 dark:text-green-400 font-semibold' : 'text-red-600 dark:text-red-400 font-semibold'}>
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

            </div>
          )}
        </div>
      )}

      <WeeklyScheduleWidget
        schedules={schedules}
        loading={loading}
        displayCount={weeklyScheduleCount}
      />

      {/* SNSリンク（固定表示） */}
      <SNSLinksWidget />

      {/* カスタムウィジェットエリア */}
      {enabledWidgets.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" style={{ gridAutoRows: 'min-content', alignItems: 'stretch' }}>
          {enabledWidgets.map((widget) => renderWidget(widget))}
        </div>
      )}

      {/* カスタマイズモーダル */}
      <DashboardCustomizeModal
        isOpen={isCustomizeModalOpen}
        onClose={() => setIsCustomizeModalOpen(false)}
      />

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
