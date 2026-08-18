import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { Schedule as ScheduleType, User } from '../types';
import { formatDate, getWeekDates, getMonthDates, isHolidayDate, isSunday, isSaturday, formatTime } from '../utils/date';
import type { WeekStartsOn } from '../utils/date';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { TaskModal } from '../components/project/TaskModal';
import { TimeAxisView } from '../components/schedule/TimeAxisView';
import { GovernmentAttendanceCalendar } from '../components/schedule/GovernmentAttendanceCalendar';
import { GovernmentAttendanceModal } from '../components/schedule/GovernmentAttendanceModal';
// FullCalendar本体は重量級ライブラリのため、Scheduleページ自体の読み込みをブロックしないよう遅延読み込みにする
const DraggableCalendarView = lazy(() =>
  import('../components/schedule/DraggableCalendarView').then((m) => ({ default: m.DraggableCalendarView }))
);
import { useAuthStore } from '../stores/authStore';
import { useIsMobileBreakpoint } from '../hooks/useIsMobileBreakpoint';

type ViewMode = 'week' | 'month' | 'day';

interface Event {
  id: string;
  eventName: string;
  eventType: 'TOWN_OFFICIAL' | 'TEAM' | 'OTHER';
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  endAt?: string;
  isCompleted?: boolean;
}

const EMPTY_SCHEDULES: ScheduleType[] = [];
const EMPTY_EVENTS: Event[] = [];

export const Schedule: React.FC = () => {
  const { user } = useAuthStore();
  const isMobile = useIsMobileBreakpoint();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month'); // デフォルトを月表示に変更
  const [calendarViewMode] = useState<'individual' | 'all'>('individual'); // カレンダー表示モード
  const [useDraggable] = useState(true); // ドラッグ可能カレンダーを使用
  const [weekDates, setWeekDates] = useState<Date[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleType | null>(null);
  const [defaultStartTime, setDefaultStartTime] = useState<string | undefined>(undefined);
  const [defaultEndTime, setDefaultEndTime] = useState<string | undefined>(undefined);
  const [selectedDateForDetail, setSelectedDateForDetail] = useState<Date | null>(null); // 詳細表示用の選択日
  const [isGovernmentAttendanceModalOpen, setIsGovernmentAttendanceModalOpen] = useState(false);
  const [detailFilterUserId, setDetailFilterUserId] = useState<string>('');
  const [visibleMemberIds, setVisibleMemberIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('calendarVisibleMembers');
      if (saved) {
        const ids = JSON.parse(saved);
        if (Array.isArray(ids)) return new Set(ids);
      }
    } catch {
      /* ignore invalid stored values */
    }
    return user?.id ? new Set([user.id]) : new Set();
  });
  const [showMemberSidebar, setShowMemberSidebar] = useState(true);
  const scheduleWeekStartsOn: WeekStartsOn = user?.scheduleWeekStartsOn === 1 ? 1 : 0;

  useEffect(() => {
    setDetailFilterUserId('');
  }, [selectedDateForDetail]);

  useEffect(() => {
    if (viewMode === 'week') {
      setWeekDates(getWeekDates(currentDate, scheduleWeekStartsOn));
    } else if (viewMode === 'month') {
      setWeekDates(getMonthDates(currentDate, scheduleWeekStartsOn));
    } else if (viewMode === 'day') {
      setWeekDates([currentDate]);
    }
  }, [currentDate, viewMode, scheduleWeekStartsOn]);

  // 表示設定をローカルストレージに保存
  useEffect(() => {
    if (visibleMemberIds.size > 0) {
      localStorage.setItem('calendarVisibleMembers', JSON.stringify([...visibleMemberIds]));
    }
  }, [visibleMemberIds]);

  const rangeStartDate = weekDates.length > 0 ? formatDate(weekDates[0]) : '';
  const rangeEndDate = weekDates.length > 0 ? formatDate(weekDates[weekDates.length - 1]) : '';

  const { data: events = EMPTY_EVENTS, isLoading: loading } = useQuery<Event[]>({
    queryKey: ['schedule-events', rangeStartDate, rangeEndDate],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate: rangeStartDate, endDate: rangeEndDate });
      const response = await api.get<Event[]>(`/api/events?${params}`);
      return response.data || [];
    },
    enabled: weekDates.length > 0,
  });

  const { data: missions = [] } = useQuery<Array<{ id: string; missionName: string }>>({
    queryKey: ['schedule-missions'],
    queryFn: async () => {
      const response = await api.get('/api/missions');
      return response.data || [];
    },
  });

  // メンバーリストを取得（週表示・月表示共通、他画面と共有キャッシュ）
  const { data: allUsers = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get<User[]>('/api/users');
      return response.data || [];
    },
  });
  const availableMembers = useMemo(() => allUsers.filter((u) => u.role === 'MEMBER'), [allUsers]);

  const visibleMemberIdsKey = useMemo(() => [...visibleMemberIds].sort().join(','), [visibleMemberIds]);

  const { data: schedules = EMPTY_SCHEDULES } = useQuery<ScheduleType[]>({
    queryKey: ['schedules', rangeStartDate, rangeEndDate, viewMode, visibleMemberIdsKey],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate: rangeStartDate, endDate: rangeEndDate, view: viewMode });
      visibleMemberIds.forEach((id) => params.append('userIds', id));
      const response = await api.get<ScheduleType[]>(`/api/schedules?${params}`);
      return Array.isArray(response.data) ? response.data : [];
    },
    // チェックが1つもない場合は何も表示しない（フェッチ自体を行わない）
    enabled: weekDates.length > 0 && visibleMemberIds.size > 0,
  });

  const refreshSchedules = () => {
    queryClient.invalidateQueries({ queryKey: ['schedules'] });
  };

  // スケジュール更新イベントをリッスン（他画面からの通知）
  useEffect(() => {
    const handleScheduleUpdate = () => refreshSchedules();
    window.addEventListener('schedule-updated', handleScheduleUpdate);
    return () => window.removeEventListener('schedule-updated', handleScheduleUpdate);
  }, []);

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleCreateSchedule = (date: Date, startTime?: string, endTime?: string) => {
    setSelectedDate(date);
    setSelectedSchedule(null);
    setDefaultStartTime(startTime);
    setDefaultEndTime(endTime);
    setIsModalOpen(true);
  };

  const handleQuickCreateSchedule = () => {
    const base = new Date(currentDate);
    const now = new Date();
    if (formatDate(base) === formatDate(now)) {
      base.setHours(now.getHours(), now.getMinutes(), 0, 0);
    }
    const roundedMinutes = Math.ceil(base.getMinutes() / 15) * 15;
    if (roundedMinutes === 60) {
      base.setHours(base.getHours() + 1, 0, 0, 0);
    } else {
      base.setMinutes(roundedMinutes, 0, 0);
    }
    const start = `${String(base.getHours()).padStart(2, '0')}:${String(base.getMinutes()).padStart(2, '0')}`;
    const endDate = new Date(base);
    endDate.setHours(endDate.getHours() + 1);
    const end = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
    handleCreateSchedule(base, start, end);
  };

  const handleEditSchedule = (schedule: ScheduleType) => {
    setSelectedSchedule(schedule);
    setSelectedDate(new Date(schedule.date));
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDate(null);
    setSelectedSchedule(null);
    setDefaultStartTime(undefined);
    setDefaultEndTime(undefined);
  };

  const handleSaved = () => {
    refreshSchedules();
    handleCloseModal();
  };

  const dateKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

  // 日付ごとの予定・イベントを事前にグルーピングしておき、
  // カレンダーのセルを描画するたびに配列を全走査しなくて済むようにする
  const schedulesByDateKey = useMemo(() => {
    const map = new Map<string, ScheduleType[]>();
    for (const s of schedules) {
      const key = dateKey(new Date(s.date));
      const list = map.get(key);
      if (list) list.push(s);
      else map.set(key, [s]);
    }
    return map;
  }, [schedules]);

  const eventsByDateKey = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const e of events) {
      const key = dateKey(new Date(e.date));
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    return map;
  }, [events]);

  const getSchedulesForDate = (date: Date) => {
    return schedulesByDateKey.get(dateKey(date)) ?? EMPTY_SCHEDULES;
  };

  const getEventsForDate = (date: Date) => {
    return eventsByDateKey.get(dateKey(date)) ?? EMPTY_EVENTS;
  };

  const getCalendarDateTone = (date: Date) => {
    const isHoliday = isHolidayDate(date);
    const isSun = isSunday(date);
    const isSat = isSaturday(date);
    if (isHoliday || isSun) {
      return {
        headerBg: 'bg-red-50 dark:bg-red-950/30',
        cellBg: 'bg-red-50/35 dark:bg-red-950/10',
        text: 'text-red-600 dark:text-red-300',
      };
    }
    if (isSat) {
      return {
        headerBg: 'bg-sky-50 dark:bg-sky-950/30',
        cellBg: 'bg-sky-50/35 dark:bg-sky-950/10',
        text: 'text-sky-600 dark:text-sky-300',
      };
    }
    return {
      headerBg: 'bg-gray-50 dark:bg-gray-900',
      cellBg: 'bg-white dark:bg-gray-800',
      text: 'text-gray-600 dark:text-gray-400',
    };
  };

  const handleEventClick = (eventId: string) => {
    navigate(`/events/${eventId}`);
  };

  const toggleMemberVisibility = (memberId: string) => {
    setVisibleMemberIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
      return newSet;
    });
  };

  const selectAllMembers = () => {
    const allIds = new Set([user?.id, ...availableMembers.map(m => m.id)].filter(Boolean) as string[]);
    setVisibleMemberIds(allIds);
  };

  const selectOnlyMe = () => {
    if (user?.id) {
      setVisibleMemberIds(new Set([user.id]));
    }
  };

  const clearAllMembers = () => {
    setVisibleMemberIds(new Set());
  };

  const selectedCalendarMembers = React.useMemo(() => {
    const byId = new Map<string, User>();
    if (user) byId.set(user.id, user as User);
    for (const member of availableMembers) byId.set(member.id, member);
    return [...visibleMemberIds]
      .map((id) => byId.get(id))
      .filter((member): member is User => !!member)
      .sort((a, b) => {
        if (a.id === user?.id) return -1;
        if (b.id === user?.id) return 1;
        return (a.displayOrder ?? 0) - (b.displayOrder ?? 0) || a.name.localeCompare(b.name, 'ja');
      });
  }, [availableMembers, user, visibleMemberIds]);

  return (
    <div className="space-y-4 sm:space-y-6 -mx-3 sm:-mx-4 md:-mx-6">
      <div className="bg-white dark:bg-gray-800 shadow border-y border-border dark:border-gray-700 min-w-0 w-full">
        <div className="flex gap-4 px-0 sm:px-3 md:px-4 py-0 sm:py-6">
          {/* メンバーサイドバー（すべてのビューモードで表示） */}
          {showMemberSidebar && (
            <div className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 pr-4 hidden lg:block">
              <div className="sticky top-0">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">メンバー</h3>
                  <button
                    onClick={() => setShowMemberSidebar(false)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    title="サイドバーを閉じる"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                
                {/* 選択数表示 */}
                <div className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                  {visibleMemberIds.size}人選択中
                </div>

                {/* クイックアクション */}
                <div className="flex gap-1 mb-3">
                  <button
                    onClick={selectOnlyMe}
                    className="flex-1 text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                  >
                    自分のみ
                  </button>
                  <button
                    onClick={selectAllMembers}
                    className="flex-1 text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                  >
                    全員
                  </button>
                  <button
                    onClick={clearAllMembers}
                    className="flex-1 text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300"
                  >
                    クリア
                  </button>
                </div>

                {/* 自分 */}
                {user && (
                  <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={visibleMemberIds.has(user.id)}
                      onChange={() => toggleMemberVisibility(user.id)}
                      className="rounded border-gray-300 dark:border-gray-600"
                    />
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                      style={{ backgroundColor: user.avatarColor || '#6B7280' }}
                    >
                      {(user.avatarLetter || user.name || '').charAt(0)}
                    </div>
                    <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                      {user.name} (自分)
                    </span>
                  </label>
                )}

                {/* 区切り線 */}
                {user && availableMembers.length > 0 && (
                  <div className="border-t border-gray-200 dark:border-gray-700 my-2" />
                )}

                {/* 他のメンバー */}
                <div className="space-y-1 max-h-[60vh] overflow-y-auto">
                  {availableMembers.map((member) => (
                    <label
                      key={member.id}
                      className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={visibleMemberIds.has(member.id)}
                        onChange={() => toggleMemberVisibility(member.id)}
                        className="rounded border-gray-300 dark:border-gray-600"
                      />
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                        style={{ backgroundColor: member.avatarColor || '#6B7280' }}
                      >
                        {(member.avatarLetter || member.name || '').charAt(0)}
                      </div>
                      <span className="text-sm text-gray-900 dark:text-gray-100 truncate">
                        {member.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* サイドバー開閉ボタン（閉じている時のみ表示） */}
          {!showMemberSidebar && (
            <button
              onClick={() => setShowMemberSidebar(true)}
              className="fixed left-4 top-32 z-10 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 hidden lg:block"
              title="メンバーサイドバーを開く"
            >
              <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            </button>
          )}

          {/* カレンダー本体 */}
          <div className="flex-1 min-w-0">
        <div className="sticky top-0 z-20 bg-white/95 dark:bg-gray-800/95 backdrop-blur border-b border-gray-100 dark:border-gray-700 sm:static sm:border-b-0 px-3 sm:px-0 py-2 sm:py-0 mb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" onClick={handlePrev} className="h-9 w-9 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="min-w-[8rem] flex-1 text-center text-base font-bold text-gray-900 dark:text-gray-100 truncate sm:text-xl">
              {viewMode === 'day' && formatDate(currentDate, isMobile ? 'M月d日(E)' : 'yyyy年M月d日(E)')}
              {viewMode === 'week' && weekDates[0] && weekDates[6] && (
                <>
                  {formatDate(weekDates[0], isMobile ? 'M/d' : 'yyyy年M月d日')} -{' '}
                  {formatDate(weekDates[6], isMobile ? 'M/d' : 'M月d日')}
                </>
              )}
              {viewMode === 'month' && formatDate(currentDate, 'yyyy年M月')}
            </h2>
            <div className="flex items-center gap-1">
              <div className="inline-flex shrink-0 rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-900">
                <Button
                  variant={viewMode === 'day' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('day')}
                  className="h-8 border-0 px-3 shadow-none"
                >
                  日
                </Button>
                <Button
                  variant={viewMode === 'week' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('week')}
                  className="h-8 border-0 px-3 shadow-none"
                >
                  週
                </Button>
                <Button
                  variant={viewMode === 'month' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setViewMode('month')}
                  className="h-8 border-0 px-3 shadow-none"
                >
                  月
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={() => setCurrentDate(new Date())}
                className="h-9 px-3 py-0"
              >
                今日
              </Button>
              <Button variant="outline" onClick={handleNext} className="h-9 w-9 p-0">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {user?.role === 'GOVERNMENT' && (
            <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-800 dark:bg-blue-950/40">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-blue-950 dark:text-blue-100">行政出勤カレンダー</p>
                <p className="truncate text-xs text-blue-700 dark:text-blue-300">
                  自分の出勤・出張・休みを月単位で登録できます
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setIsGovernmentAttendanceModalOpen(true)}
                className="shrink-0"
              >
                <CalendarDays className="mr-1.5 h-4 w-4" />
                出勤情報を入力
              </Button>
            </div>
          )}
          <div className="lg:hidden mt-2 -mx-3 px-3 flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={selectOnlyMe}
              className="lg:hidden shrink-0 h-8 px-3 rounded-full border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
            >
              自分のみ
            </button>
            <button
              type="button"
              onClick={selectAllMembers}
              className="lg:hidden shrink-0 h-8 px-3 rounded-full border border-gray-200 dark:border-gray-700 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
            >
              全員
            </button>
            {user && (
              <button
                type="button"
                onClick={() => toggleMemberVisibility(user.id)}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs ${
                  visibleMemberIds.has(user.id)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: user.avatarColor || '#6B7280' }} />
                自分
              </button>
            )}
            {availableMembers.map((member) => (
              <button
                key={member.id}
                type="button"
                onClick={() => toggleMemberVisibility(member.id)}
                className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs ${
                  visibleMemberIds.has(member.id)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: member.avatarColor || '#6B7280' }} />
                {member.name}
              </button>
            ))}
          </div>
        </div>


        {loading ? (
          <LoadingSpinner />
        ) : useDraggable ? (
          <Suspense fallback={<LoadingSpinner />}>
            <DraggableCalendarView
              schedules={schedules}
              events={events}
              viewMode={viewMode}
              currentDate={currentDate}
              calendarViewMode={viewMode === 'month' ? 'all' : calendarViewMode}
              currentUserId={user?.id}
              onScheduleClick={(schedule) => {
                if (isMobile && viewMode === 'month') {
                  setSelectedDateForDetail(new Date((schedule as any).startDate || schedule.date));
                  return;
                }
                // 他人のスケジュールは読み取り専用
                const isOtherUser = schedule.userId !== user?.id;
                if (isOtherUser) {
                  setSelectedSchedule(schedule);
                  setIsModalOpen(true);
                } else {
                  handleEditSchedule(schedule);
                }
              }}
              onEventClick={handleEventClick}
              onCreateSchedule={handleCreateSchedule}
              onMoreClick={(date) => {
                setCurrentDate(date);
                setViewMode('day');
              }}
              onScheduleUpdate={refreshSchedules}
              firstDay={scheduleWeekStartsOn}
            />
          </Suspense>
        ) : viewMode === 'week' || viewMode === 'day' ? (
          <>
            <TimeAxisView
              dates={viewMode === 'day' ? [currentDate] : weekDates}
              schedules={schedules}
              events={events}
              onScheduleClick={(schedule) => {
                // 他人のスケジュールは読み取り専用
                const isOtherUser = schedule.userId !== user?.id;
                if (isOtherUser) {
                  setSelectedSchedule(schedule);
                  setIsModalOpen(true);
                } else {
                  handleEditSchedule(schedule);
                }
              }}
              onEventClick={handleEventClick}
              onCreateSchedule={handleCreateSchedule}
              viewMode={viewMode === 'day' ? 'day' : 'week'}
              calendarViewMode={viewMode === 'day' && selectedCalendarMembers.length > 1 ? 'all' : calendarViewMode}
              currentUserId={user?.id}
              members={viewMode === 'day' ? selectedCalendarMembers : undefined}
            />
          </>
        ) : (
          <div className="w-full min-w-0 overflow-x-hidden">
            {/* 曜日ヘッダー */}
            <div className="grid grid-cols-7 gap-0 w-full min-w-0 mb-1 px-0">
              {weekDates.slice(0, 7).map((date, index) => {
                const tone = getCalendarDateTone(date);
                return (
                  <div key={`header-${index}`} className={`text-center text-[10px] sm:text-xs font-semibold py-1 ${tone.headerBg} ${tone.text}`}>
                    {formatDate(date, 'E')}
                  </div>
                );
              })}
            </div>

            {/* 週行ごとに描画（複数日バーのオーバーレイ付き） */}
            {(() => {
              // weekDates を7日ずつの週に分割
              const weeks: Date[][] = [];
              for (let i = 0; i < weekDates.length; i += 7) {
                weeks.push(weekDates.slice(i, i + 7));
              }

              // 複数日スケジュールを抽出
              const multiDaySchedules = schedules.filter((s) => {
                if (s.isTimeUnspecified) return false;
                const sd = new Date((s as any).startDate || s.date);
                const ed = new Date((s as any).endDate || s.date);
                sd.setHours(0, 0, 0, 0);
                ed.setHours(0, 0, 0, 0);
                return sd.getTime() !== ed.getTime();
              });

              const getScheduleColor = (schedule: ScheduleType) => {
                if (schedule.userId === user?.id) {
                  return (schedule as any).customColor || schedule.project?.themeColor || schedule.user?.avatarColor || '#6B7280';
                }
                return schedule.user?.avatarColor || '#6B7280';
              };

              const getTextColor = (bg: string) => {
                const hex = bg.replace('#', '');
                const r = parseInt(hex.substr(0, 2), 16);
                const g = parseInt(hex.substr(2, 2), 16);
                const b = parseInt(hex.substr(4, 2), 16);
                
                // 相対輝度を計算（WCAG 2.1基準）
                const toLinear = (c: number) => {
                  const val = c / 255;
                  return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
                };
                
                const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
                
                // 明るい背景: 濃いグレー (#1F2937)
                // 暗い背景: オフホワイト (#F9FAFB)
                return luminance > 0.5 ? '#1F2937' : '#F9FAFB';
              };

              return weeks.map((weekDays, weekIndex) => {
                const weekStart = new Date(weekDays[0]); weekStart.setHours(0, 0, 0, 0);
                const weekEnd = new Date(weekDays[6]); weekEnd.setHours(0, 0, 0, 0);

                // この週に重なる複数日スケジュール
                const weekMultiDay = multiDaySchedules.filter((s) => {
                  const sd = new Date((s as any).startDate || s.date); sd.setHours(0, 0, 0, 0);
                  const ed = new Date((s as any).endDate || s.date); ed.setHours(0, 0, 0, 0);
                  return sd <= weekEnd && ed >= weekStart;
                });

                // バーの行割り当て（重なりを避けるためレーン管理）
                const lanes: Array<{ schedule: ScheduleType; startCol: number; endCol: number }[]> = [];
                const barInfos = weekMultiDay.map((s) => {
                  const sd = new Date((s as any).startDate || s.date); sd.setHours(0, 0, 0, 0);
                  const ed = new Date((s as any).endDate || s.date); ed.setHours(0, 0, 0, 0);
                  const startCol = Math.max(0, Math.round((Math.max(sd.getTime(), weekStart.getTime()) - weekStart.getTime()) / 86400000));
                  const endCol = Math.min(6, Math.round((Math.min(ed.getTime(), weekEnd.getTime()) - weekStart.getTime()) / 86400000));
                  return { schedule: s, startCol, endCol, isActualStart: sd >= weekStart, isActualEnd: ed <= weekEnd };
                });

                barInfos.forEach((bar) => {
                  let placed = false;
                  for (const lane of lanes) {
                    const overlap = lane.some((b) => b.startCol <= bar.endCol && b.endCol >= bar.startCol);
                    if (!overlap) { lane.push(bar); placed = true; break; }
                  }
                  if (!placed) lanes.push([bar]);
                });

                const BAR_HEIGHT = 20; // px
                const BAR_GAP = 2;
                const HEADER_HEIGHT = 28; // 日付数字の高さ

                // 各日ごとに必要なレーン数を計算
                const getLanesForDay = (dayCol: number): number => {
                  let maxLane = 0;
                  lanes.forEach((lane, laneIndex) => {
                    const hasBarOnDay = lane.some((bar) => bar.startCol <= dayCol && bar.endCol >= dayCol);
                    if (hasBarOnDay) maxLane = Math.max(maxLane, laneIndex + 1);
                  });
                  return maxLane;
                };

                return (
                  <div key={weekIndex} className="relative w-full" style={{ marginBottom: 0 }}>
                    {/* 日セルグリッド */}
                    <div className="grid gap-0 w-full border-t border-l border-border dark:border-gray-700 sm:border-0"
                      style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}>
                      {weekDays.map((date, dayIndex) => {
                        const singleDaySchedules = getSchedulesForDate(date).filter((s) => {
                          const sd = new Date((s as any).startDate || s.date); sd.setHours(0, 0, 0, 0);
                          const ed = new Date((s as any).endDate || s.date); ed.setHours(0, 0, 0, 0);
                          return sd.getTime() === ed.getTime();
                        });
                        const isToday = formatDate(date) === formatDate(new Date());
                        const tone = getCalendarDateTone(date);
                        let dayTextColor = `${tone.text} font-semibold`;
                        if (isToday) dayTextColor = 'text-primary dark:text-blue-400 font-bold';

                        const MAX_SINGLE = 3;
                        const visibleSingle = singleDaySchedules.slice(0, MAX_SINGLE);
                        const remainingSingle = singleDaySchedules.length > MAX_SINGLE ? singleDaySchedules.length - MAX_SINGLE : 0;

                        // この日に表示される複数日バーの数を計算
                        const lanesForThisDay = getLanesForDay(dayIndex);
                        const multiDayBarHeight = lanesForThisDay * (BAR_HEIGHT + BAR_GAP);

                        return (
                          <div key={dayIndex}
                            className={`border-r border-b border-border dark:border-gray-700 min-w-0 w-full flex flex-col p-1 ${
                              isToday ? 'bg-primary/10 dark:bg-primary/20' : tone.cellBg
                            } ${
                              calendarViewMode !== 'all' ? 'cursor-pointer' : 'cursor-default'
                            }`}
                            style={{ minHeight: `${HEADER_HEIGHT + multiDayBarHeight + 40}px` }}
                            onClick={(e) => {
                              if ((e.target as HTMLElement).closest('button')) return;
                              if (calendarViewMode === 'all') { if (getSchedulesForDate(date).length > 0) setSelectedDateForDetail(date); return; }
                              handleCreateSchedule(date);
                            }}>
                            {/* 日付数字 */}
                            <div className="flex-shrink-0" style={{ height: `${HEADER_HEIGHT}px` }}>
                              <p className={`text-sm sm:text-base font-bold text-center ${dayTextColor} ${
                                formatDate(date, 'M') !== formatDate(currentDate, 'M') ? 'opacity-40' : ''
                              }`}>{formatDate(date, 'd')}</p>
                            </div>
                            {/* 複数日バーの高さ分スペース確保（この日に必要な分だけ） */}
                            <div style={{ height: `${multiDayBarHeight}px`, flexShrink: 0 }} />
                            {/* 単日スケジュール */}
                            <div className="space-y-0.5 flex-1 overflow-hidden mt-0.5">
                              {visibleSingle.map((schedule) => {
                                const color = getScheduleColor(schedule);
                                const tc = getTextColor(color);
                                const isOtherUser = schedule.userId !== user?.id;
                                return (
                                  <button key={schedule.id}
                                    onClick={(e) => { 
                                      e.stopPropagation(); 
                                      if (isMobile) {
                                        setSelectedDateForDetail(date);
                                        return;
                                      }
                                      if (isOtherUser) { 
                                        setSelectedSchedule(schedule); 
                                        setIsModalOpen(true); 
                                      } else {
                                        handleEditSchedule(schedule); 
                                      }
                                    }}
                                    className="w-full text-left px-1.5 py-0.5 rounded hover:opacity-90 transition-opacity truncate"
                                    style={{ backgroundColor: color, color: tc }}>
                                    {!isMobile && (
                                      <span className="text-[10px] font-semibold" style={{ color: tc }}>
                                        {schedule.isTimeUnspecified ? '時間未定' : formatTime(schedule.startTime)}
                                      </span>
                                    )}
                                    <span className={`${isMobile ? '' : 'ml-1'} text-xs truncate`} style={{ color: tc }}>{(schedule as any).title || schedule.activityDescription}</span>
                                  </button>
                                );
                              })}
                              {remainingSingle > 0 && (
                                <button onClick={(e) => { e.stopPropagation(); setSelectedDateForDetail(date); }}
                                  className="w-full text-center px-1 py-0.5 rounded text-xs border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400">
                                  他{remainingSingle}件
                                </button>
                              )}
                              {getEventsForDate(date).map((event) => (
                                <button key={event.id} onClick={() => handleEventClick(event.id)}
                                  className={`w-full text-left px-1.5 py-0.5 rounded text-xs border hover:opacity-80 ${
                                    event.eventType === 'TOWN_OFFICIAL' ? 'bg-blue-100 border-blue-300 text-blue-800 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
                                    : event.eventType === 'TEAM' ? 'bg-green-100 border-green-300 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300'
                                    : 'bg-gray-100 border-gray-300 text-gray-800 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200'
                                  } ${event.isCompleted ? 'opacity-60' : ''}`}>
                                  <CalendarDays className="h-3 w-3 inline mr-1" />{event.eventName}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* 複数日バーのオーバーレイ（週行の上に絶対配置） */}
                    {weekMultiDay.length > 0 && (
                      <div className="absolute inset-0 pointer-events-none" style={{ top: 0, left: 0, right: 0 }}>
                        {barInfos.map((bar) => {
                          const laneIndex = lanes.findIndex((lane) => lane.some((b) => b.schedule.id === bar.schedule.id));
                          const color = getScheduleColor(bar.schedule);
                          const tc = getTextColor(color);
                          const colWidth = 100 / 7;
                          const left = `calc(${bar.startCol * colWidth}% + 3px)`;
                          const width = `calc(${(bar.endCol - bar.startCol + 1) * colWidth}% - 6px)`;
                          const top = HEADER_HEIGHT + laneIndex * (BAR_HEIGHT + BAR_GAP);
                          const borderRadius = bar.isActualStart && bar.isActualEnd ? '4px'
                            : bar.isActualStart ? '4px 0 0 4px'
                            : bar.isActualEnd ? '0 4px 4px 0'
                            : '0';
                          return (
                            <button key={`${bar.schedule.id}-${weekIndex}`}
                              className="absolute pointer-events-auto hover:opacity-90 transition-opacity overflow-hidden"
                              style={{
                                left, width, top: `${top}px`, height: `${BAR_HEIGHT}px`,
                                backgroundColor: color, color: tc, borderRadius,
                                fontSize: '10px', padding: '2px 6px', lineHeight: '16px',
                                whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                              }}
                              onClick={(e) => { 
                                e.stopPropagation(); 
                                const isOtherUser = bar.schedule.userId !== user?.id;
                                if (isOtherUser) {
                                  setSelectedSchedule(bar.schedule);
                                  setIsModalOpen(true);
                                } else {
                                  handleEditSchedule(bar.schedule);
                                }
                              }}
                              title={`${(bar.schedule as any).title || bar.schedule.activityDescription} (${formatTime(bar.schedule.startTime)}-${formatTime(bar.schedule.endTime)})`}>
                              {bar.isActualStart && (
                                <span className="font-medium truncate" style={{ color: tc }}>
                                  {(bar.schedule as any).title || bar.schedule.activityDescription}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              });
            })()}
          </div>
        )}
        {!loading && weekDates.length > 0 && (
          <GovernmentAttendanceCalendar
            dates={weekDates}
            viewMode={viewMode === 'day' ? 'week' : viewMode}
          />
        )}
          </div>
        </div>
      </div>

      {/* 新規タスク追加（TaskModal） */}
      {isModalOpen && !selectedSchedule && (
        <TaskModal
          missionId={missions.length > 0 ? missions[0].id : undefined}
          defaultDate={selectedDate}
          defaultStartTime={defaultStartTime || undefined}
          defaultEndTime={defaultEndTime || undefined}
          onClose={handleCloseModal}
          onSaved={handleSaved}
        />
      )}

      {/* スケジュール編集（TaskModal で統一） */}
      {isModalOpen && selectedSchedule && (
        <TaskModal
          missionId={selectedSchedule.task?.missionId || (missions.length > 0 ? missions[0].id : undefined)}
          schedule={selectedSchedule}
          readOnly={selectedSchedule.userId !== user?.id}
          onClose={handleCloseModal}
          onSaved={handleSaved}
        />
      )}

      {/* 日詳細表示モーダル */}
      {selectedDateForDetail && (() => {
        const allDaySchedules = getSchedulesForDate(selectedDateForDetail);
        // ユーザーごとにグループ化
        const userMap = new Map<string, { user: ScheduleType['user']; schedules: ScheduleType[] }>();
        for (const s of allDaySchedules) {
          const uid = s.userId;
          if (!userMap.has(uid)) userMap.set(uid, { user: s.user, schedules: [] });
          userMap.get(uid)!.schedules.push(s);
        }
        const userGroups = [...userMap.values()].sort((a, b) =>
          (a.user?.name || '').localeCompare(b.user?.name || '', 'ja')
        );
        const filteredGroups = detailFilterUserId
          ? userGroups.filter(g => g.user?.id === detailFilterUserId)
          : userGroups;

        return (
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={() => setSelectedDateForDetail(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-lg shadow-xl max-w-2xl w-full sm:m-4 max-h-[88vh] sm:max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="sm:hidden mx-auto mt-2 h-1 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0" />
              <div className="flex justify-between items-center px-4 sm:px-5 py-4 border-b dark:border-gray-700 flex-shrink-0">
                <h2 className="text-base sm:text-lg font-bold dark:text-gray-100">
                  {formatDate(selectedDateForDetail, 'yyyy年M月d日')} のスケジュール
                </h2>
                <button onClick={() => setSelectedDateForDetail(null)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {/* 人フィルター */}
              {userGroups.length > 1 && (
                <div className="px-4 sm:px-5 py-2 border-b dark:border-gray-700 flex-shrink-0">
                  <select
                    value={detailFilterUserId}
                    onChange={(e) => setDetailFilterUserId(e.target.value)}
                    className="text-sm px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                  >
                    <option value="">全員 ({allDaySchedules.length}件)</option>
                    {userGroups.map(g => (
                      <option key={g.user?.id} value={g.user?.id || ''}>
                        {g.user?.name} ({g.schedules.length}件)
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {filteredGroups.length === 0 ? (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">スケジュールはありません</p>
                ) : (
                  filteredGroups.map(({ user: schedUser, schedules: userSchedules }) => (
                    <div key={schedUser?.id || 'unknown'}>
                      {/* ユーザーヘッダー */}
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                          style={{ backgroundColor: schedUser?.avatarColor || '#6B7280' }}
                        >
                          {(schedUser?.avatarLetter || schedUser?.name || '').charAt(0)}
                        </div>
                        <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                          {schedUser?.name || '不明'}
                        </span>
                        <span className="text-xs text-gray-400">{userSchedules.length}件</span>
                      </div>
                      {/* そのユーザーのスケジュール（時間順） */}
                      <div className="space-y-2 sm:space-y-1.5 sm:pl-9">
                        {[...userSchedules]
                          .sort((a, b) => a.startTime.localeCompare(b.startTime))
                          .map((schedule) => {
                            const scheduleColor = schedUser?.avatarColor || '#6B7280';
                            return (
                              <button
                                key={schedule.id}
                                onClick={() => {
                                  setSelectedDateForDetail(null);
                                  setSelectedSchedule(schedule);
                                  setIsModalOpen(true);
                                }}
                                className="w-full text-left px-3 py-2.5 sm:py-2 rounded-lg border border-border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 bg-white dark:bg-gray-800 transition-colors"
                                style={{ borderLeftWidth: '3px', borderLeftColor: scheduleColor }}
                              >
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                    {schedule.isTimeUnspecified ? '時間未定' : `${formatTime(schedule.startTime)}–${formatTime(schedule.endTime)}`}
                                  </span>
                                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                    {(schedule as any).title || schedule.activityDescription}
                                  </span>
                                </div>
                                {schedule.locationText && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">📍 {schedule.locationText}</p>
                                )}
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        );
      })()}
      {/* 行政出勤カレンダーモーダル */}
      {isGovernmentAttendanceModalOpen && (
        <GovernmentAttendanceModal
          isOpen={isGovernmentAttendanceModalOpen}
          onClose={() => setIsGovernmentAttendanceModalOpen(false)}
        />
      )}
      {isMobile && (
        <button
          type="button"
          onClick={handleQuickCreateSchedule}
          className="fixed bottom-4 right-4 z-30 inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/25 active:scale-95"
        >
          ＋ 予定
        </button>
      )}
    </div>
  );
};
