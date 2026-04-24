import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, ChevronDown, ChevronRight as ChevronRightIcon, ListChecks, RefreshCw, Circle, PlayCircle, CheckCircle2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { Schedule as ScheduleType, Project, Task, User } from '../types';
import { formatDate, getWeekDates, getMonthDates, isSameDay, isHolidayDate, isSunday, isSaturday, formatTime } from '../utils/date';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ScheduleModal } from '../components/schedule/ScheduleModal';
import { TaskModal } from '../components/project/TaskModal';
import { TimeAxisView } from '../components/schedule/TimeAxisView';
import { GovernmentAttendanceCalendar } from '../components/schedule/GovernmentAttendanceCalendar';
import { GovernmentAttendanceModal } from '../components/schedule/GovernmentAttendanceModal';
import { DraggableCalendarView } from '../components/schedule/DraggableCalendarView';
import { useAuthStore } from '../stores/authStore';
import { useStaffWorkspace } from '../stores/workspaceStore';
import { format } from 'date-fns';

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

export const Schedule: React.FC = () => {
  const { user } = useAuthStore();
  const { isStaff, workspaceMode } = useStaffWorkspace();
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<ScheduleType[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [missions, setMissions] = useState<Array<{ id: string; missionName: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month'); // デフォルトを月表示に変更
  const [calendarViewMode, setCalendarViewMode] = useState<'individual' | 'all'>('individual'); // カレンダー表示モード
  const [useDraggable, setUseDraggable] = useState(true); // ドラッグ可能カレンダーを使用
  const [weekDates, setWeekDates] = useState<Date[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleType | null>(null);
  const [defaultStartTime, setDefaultStartTime] = useState<string | undefined>(undefined);
  const [defaultEndTime, setDefaultEndTime] = useState<string | undefined>(undefined);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>([]);
  const projectViewMode: 'view' | 'personal' = isStaff
    ? workspaceMode === 'browse'
      ? 'view'
      : 'personal'
    : 'personal';
  const [selectedDateForDetail, setSelectedDateForDetail] = useState<Date | null>(null); // 詳細表示用の選択日
  const [availableMembers, setAvailableMembers] = useState<User[]>([]); // 選択可能なメンバーリスト
  const [isGovernmentAttendanceModalOpen, setIsGovernmentAttendanceModalOpen] = useState(false);
  const [detailFilterUserId, setDetailFilterUserId] = useState<string>('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [visibleMemberIds, setVisibleMemberIds] = useState<Set<string>>(new Set());
  const [showMemberSidebar, setShowMemberSidebar] = useState(true);

  // 行政出勤記録（行政カレンダーモーダル用のみ）
  const govAttendanceFrom = '';
  const govAttendanceTo = '';

  useEffect(() => {
    if (isStaff && workspaceMode === 'browse') {
      setSelectedMemberId(null);
    }
  }, [isStaff, workspaceMode]);

  useEffect(() => {
    setDetailFilterUserId('');
  }, [selectedDateForDetail]);

  useEffect(() => {
    if (viewMode === 'week') {
      setWeekDates(getWeekDates(currentDate));
    } else if (viewMode === 'month') {
      setWeekDates(getMonthDates(currentDate));
    } else if (viewMode === 'day') {
      setWeekDates([currentDate]);
    }
  }, [currentDate, viewMode]);

  useEffect(() => {
    if (weekDates.length > 0) {
      fetchSchedules();
      fetchEvents();
      fetchProjects();
      fetchMissions();
    }
  }, [weekDates, user?.id, isStaff, workspaceMode, visibleMemberIds]);

  // メンバーリストを取得（週表示・月表示共通）
  useEffect(() => {
    fetchMembers();
  }, []);

  // 初期表示時に自分のIDをvisibleMemberIdsに追加
  useEffect(() => {
    if (user?.id && visibleMemberIds.size === 0) {
      setVisibleMemberIds(new Set([user.id]));
    }
  }, [user?.id]);

  // ローカルストレージから表示設定を読み込み
  useEffect(() => {
    const saved = localStorage.getItem('calendarVisibleMembers');
    if (saved) {
      try {
        const ids = JSON.parse(saved);
        setVisibleMemberIds(new Set(ids));
      } catch (e) {
        console.error('Failed to load visible members:', e);
      }
    }
  }, []);

  // 表示設定をローカルストレージに保存
  useEffect(() => {
    if (visibleMemberIds.size > 0) {
      localStorage.setItem('calendarVisibleMembers', JSON.stringify([...visibleMemberIds]));
    }
  }, [visibleMemberIds]);

  const fetchMembers = async () => {
    try {
      const response = await api.get<User[]>('/api/users');
      // メンバーのみを取得（表示順0番目を除く）
      const members = (response.data || []).filter(u => 
        u.role === 'MEMBER' && (u.displayOrder ?? 0) !== 0
      );
      setAvailableMembers(members);
    } catch (error) {
      console.error('Failed to fetch members:', error);
      setAvailableMembers([]);
    }
  };

  // プロジェクト表示モード変更時の処理（weekDatesが空でないことを確認）
  useEffect(() => {
    if (weekDates.length > 0) {
      console.log('Fetching projects with mode:', projectViewMode, 'weekDates:', weekDates.length);
      fetchProjects();
    }
  }, [projectViewMode, weekDates, user?.id, isStaff, workspaceMode]);

  // スケジュール更新イベントをリッスン
  useEffect(() => {
    const handleScheduleUpdate = () => {
      fetchSchedules();
    };
    window.addEventListener('schedule-updated', handleScheduleUpdate);
    return () => window.removeEventListener('schedule-updated', handleScheduleUpdate);
  }, []);

  const fetchSchedules = async () => {
    try {
      const params = new URLSearchParams({
        startDate: formatDate(weekDates[0]),
        endDate: formatDate(weekDates[weekDates.length - 1]),
        view: viewMode,
      });

      // すべてのビューモードで visibleMemberIds を使用
      if (visibleMemberIds.size > 0) {
        visibleMemberIds.forEach(id => params.append('userIds', id));
      } else {
        // チェックが1つもない場合は何も表示しない
        setSchedules([]);
        return;
      }

      const response = await api.get<ScheduleType[]>(`/api/schedules?${params}`);
      const data = response.data;
      setSchedules(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch schedules:', error);
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const startDate = formatDate(weekDates[0]);
      const endDate = formatDate(weekDates[weekDates.length - 1]);
      const response = await api.get<Event[]>('/api/events');
      const allEvents = response.data || [];
      
      // 表示期間内のイベントのみフィルタリング
      const filteredEvents = allEvents.filter((event) => {
        const eventDate = new Date(event.date);
        return eventDate >= new Date(startDate) && eventDate <= new Date(endDate);
      });
      
      setEvents(filteredEvents);
    } catch (error) {
      console.error('Failed to fetch events:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProjects = async () => {
    try {
      // weekDatesが空の場合は実行しない
      if (weekDates.length === 0) {
        console.log('fetchProjects: weekDates is empty, skipping');
        return;
      }
      
      const startDate = formatDate(weekDates[0]);
      const endDate = formatDate(weekDates[weekDates.length - 1]);
      
      // プロジェクト表示モードに応じて取得
      let url = '/api/projects';
      if (user?.role !== 'MEMBER') {
        if (projectViewMode === 'personal') {
          // 個人モード: 自分のプロジェクトのみ
          url = `/api/projects?userId=${user?.id}`;
        } else {
          // 閲覧モード: 自分以外のメンバーのプロジェクトのみ
          // まずメンバー一覧を取得して、自分のIDを除外
          const membersResponse = await api.get('/api/users');
          const members = (membersResponse.data || []).filter((u: any) => 
            u.role === 'MEMBER' && (u.displayOrder ?? 0) !== 0 && u.id !== user?.id
          );
          // メンバーがいる場合は、各メンバーのプロジェクトを取得して結合
          if (members.length > 0) {
            const allMemberProjects: Project[] = [];
            for (const member of members) {
              try {
                const memberResponse = await api.get<Project[]>(`/api/projects?userId=${member.id}`);
                allMemberProjects.push(...(memberResponse.data || []));
              } catch (error) {
                console.error(`Failed to fetch projects for member ${member.id}:`, error);
              }
            }
            // 表示期間内のプロジェクトのみフィルタリング
            const filteredProjects = allMemberProjects.filter((project) => {
              if (!project.startDate && !project.endDate) return false;
              const projectStartDate = project.startDate ? new Date(project.startDate) : null;
              const projectEndDate = project.endDate ? new Date(project.endDate) : null;
              const viewStartDate = new Date(startDate);
              const viewEndDate = new Date(endDate);
              
              if (projectStartDate && projectEndDate) {
                return projectStartDate <= viewEndDate && projectEndDate >= viewStartDate;
              } else if (projectStartDate) {
                return projectStartDate <= viewEndDate;
              } else if (projectEndDate) {
                return projectEndDate >= viewStartDate;
              }
              return false;
            });
            
            console.log('fetchProjects: filtered to', filteredProjects.length, 'projects (view mode)');
            setProjects(filteredProjects);
            return;
          } else {
            setProjects([]);
            return;
          }
        }
      }
      
      console.log('fetchProjects: fetching from', url, 'mode:', projectViewMode);
      const response = await api.get<Project[]>(url);
      const allProjects = response.data || [];
      console.log('fetchProjects: received', allProjects.length, 'projects');
      
      // 表示期間内のプロジェクトのみフィルタリング（開始日または終了日が期間内にあるもの）
      const filteredProjects = allProjects.filter((project) => {
        if (!project.startDate && !project.endDate) return false;
        const projectStartDate = project.startDate ? new Date(project.startDate) : null;
        const projectEndDate = project.endDate ? new Date(project.endDate) : null;
        const viewStartDate = new Date(startDate);
        const viewEndDate = new Date(endDate);
        
        // プロジェクトの期間が表示期間と重なっているかチェック
        if (projectStartDate && projectEndDate) {
          return projectStartDate <= viewEndDate && projectEndDate >= viewStartDate;
        } else if (projectStartDate) {
          return projectStartDate <= viewEndDate;
        } else if (projectEndDate) {
          return projectEndDate >= viewStartDate;
        }
        return false;
      });
      
      console.log('fetchProjects: filtered to', filteredProjects.length, 'projects');
      // relatedTasksが含まれているプロジェクトをそのまま使用
      setProjects(filteredProjects);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setProjects([]);
    }
  };

  const fetchMissions = async () => {
    try {
      const response = await api.get('/api/missions');
      setMissions(response.data || []);
    } catch (error) {
      console.error('Failed to fetch missions:', error);
      setMissions([]);
    }
  };

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
    fetchSchedules();
    handleCloseModal();
  };

  const getSchedulesForDate = (date: Date) => {
    return schedules.filter((s) => isSameDay(s.date, date));
  };

  const getEventsForDate = (date: Date) => {
    return events.filter((e) => {
      const eventDate = new Date(e.date);
      return isSameDay(eventDate, date);
    });
  };

  const handleEventClick = (eventId: string) => {
    navigate(`/events/${eventId}`);
  };

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjectIds((prev) =>
      prev.includes(projectId) ? prev.filter((id) => id !== projectId) : [...prev, projectId],
    );
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

  return (
    <div className="space-y-6 -mx-3 sm:-mx-4 md:-mx-6">
      {/* スマホ: タイトルとボタンを別カラムに配置 */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 px-3 sm:px-4 md:px-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">
          スケジュール管理
        </h1>
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            variant="outline"
            onClick={() => setIsGovernmentAttendanceModalOpen(true)}
            title="行政出勤カレンダーを表示"
          >
            <CalendarDays className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">行政カレンダー</span>
            <span className="sm:hidden">行政</span>
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              await Promise.all([fetchSchedules(), fetchProjects()]);
            }}
            title="スケジュールとタスクを更新"
          >
            <RefreshCw className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">更新</span>
          </Button>

        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow border-y border-border dark:border-gray-700 min-w-0 w-full">
        <div className="flex gap-4 px-2 sm:px-3 md:px-4 py-6">
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
        <div className="flex justify-between items-center mb-4 sm:mb-6 px-1 sm:px-2 pt-3 sm:pt-0">
          <Button variant="outline" onClick={handlePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
              <Button
                variant={viewMode === 'day' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setViewMode('day')}
              >
                日
              </Button>
              <Button
                variant={viewMode === 'week' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setViewMode('week')}
              >
                週
              </Button>
              <Button
                variant={viewMode === 'month' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setViewMode('month')}
              >
                月
              </Button>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {viewMode === 'day' && formatDate(currentDate, 'yyyy年M月d日')}
              {viewMode === 'week' && weekDates[0] && weekDates[6] && (
                <>
                  {formatDate(weekDates[0], 'yyyy年M月d日')} -{' '}
                  {formatDate(weekDates[6], 'M月d日')}
                </>
              )}
              {viewMode === 'month' && formatDate(currentDate, 'yyyy年M月')}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5"
            >
              今日
            </Button>
            <Button variant="outline" onClick={handleNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>


        {loading ? (
          <LoadingSpinner />
        ) : useDraggable && viewMode !== 'day' ? (
          <>
            <DraggableCalendarView
              schedules={schedules}
              events={events}
              viewMode={viewMode}
              currentDate={currentDate}
              calendarViewMode="all"
              currentUserId={user?.id}
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
              onScheduleUpdate={fetchSchedules}
            />
            {/* 行政出勤カレンダー（週表示のみ） */}
            {viewMode === 'week' && (
              <div className="mt-4">
                <GovernmentAttendanceCalendar
                  dates={weekDates}
                  viewMode="week"
                />
              </div>
            )}
            {viewMode === 'month' && (
              <div className="mt-4">
                <GovernmentAttendanceCalendar
                  dates={weekDates}
                  viewMode="month"
                />
              </div>
            )}
          </>
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
              calendarViewMode={calendarViewMode}
              currentUserId={user?.id}
              members={viewMode === 'day' ? availableMembers.filter(m => (m.displayOrder ?? 0) !== 0).sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)) : undefined}
            />
            {/* 行政出勤カレンダー（週表示） */}
            <GovernmentAttendanceCalendar
              dates={weekDates}
              viewMode="week"
            />
          </>
        ) : (
          <div className="w-full min-w-0 overflow-x-hidden">
            {/* 曜日ヘッダー */}
            <div className="grid grid-cols-7 gap-0 w-full min-w-0 mb-1 px-0">
              {weekDates.slice(0, 7).map((date, index) => {
                const isHoliday = isHolidayDate(date);
                const isSun = isSunday(date);
                const isSat = isSaturday(date);
                let dayLabelColor = 'text-gray-500 dark:text-gray-400';
                if (isHoliday || isSun) dayLabelColor = 'text-red-500 dark:text-red-400';
                else if (isSat) dayLabelColor = 'text-blue-500 dark:text-blue-400';
                return (
                  <div key={`header-${index}`} className={`text-center text-[10px] sm:text-xs font-semibold py-1 ${dayLabelColor}`}>
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
                const sd = new Date((s as any).startDate || s.date);
                const ed = new Date((s as any).endDate || s.date);
                sd.setHours(0, 0, 0, 0);
                ed.setHours(0, 0, 0, 0);
                return sd.getTime() !== ed.getTime();
              });

              const getScheduleColor = (schedule: ScheduleType) => {
                if (calendarViewMode === 'all') return schedule.user?.avatarColor || '#6B7280';
                return (schedule as any).customColor || schedule.project?.themeColor || schedule.user?.avatarColor || '#6B7280';
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

                const overlayHeight = HEADER_HEIGHT + lanes.length * (BAR_HEIGHT + BAR_GAP);

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
                        const isHoliday = isHolidayDate(date);
                        const isSun = isSunday(date);
                        const isSat = isSaturday(date);
                        let dayTextColor = 'text-gray-900 dark:text-gray-100';
                        if (isHoliday || isSun) dayTextColor = 'text-red-600 dark:text-red-400';
                        else if (isSat) dayTextColor = 'text-blue-600 dark:text-blue-400';
                        if (isToday) dayTextColor = 'text-primary dark:text-blue-400 font-bold';

                        const isHighlightedByTask = hoveredTaskId != null && getSchedulesForDate(date).some((s) => s.taskId === hoveredTaskId);

                        const MAX_SINGLE = 3;
                        const visibleSingle = singleDaySchedules.slice(0, MAX_SINGLE);
                        const remainingSingle = singleDaySchedules.length > MAX_SINGLE ? singleDaySchedules.length - MAX_SINGLE : 0;

                        // この日に表示される複数日バーの数を計算
                        const lanesForThisDay = getLanesForDay(dayIndex);
                        const multiDayBarHeight = lanesForThisDay * (BAR_HEIGHT + BAR_GAP);

                        return (
                          <div key={dayIndex}
                            className={`border-r border-b border-border dark:border-gray-700 min-w-0 w-full flex flex-col p-1 ${
                              isHighlightedByTask ? 'ring-2 ring-blue-400 relative z-10' : ''
                            } ${isToday ? 'bg-primary/10 dark:bg-primary/20' : 'bg-white dark:bg-gray-800'} ${
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
                                      if (isOtherUser) { 
                                        setSelectedSchedule(schedule); 
                                        setIsModalOpen(true); 
                                      } else {
                                        handleEditSchedule(schedule); 
                                      }
                                    }}
                                    className="w-full text-left px-1.5 py-0.5 rounded hover:opacity-90 transition-opacity truncate"
                                    style={{ backgroundColor: color, color: tc }}>
                                    <span className="text-[10px] font-semibold" style={{ color: tc }}>{formatTime(schedule.startTime)}</span>
                                    <span className="ml-1 text-xs truncate" style={{ color: tc }}>{(schedule as any).title || schedule.activityDescription}</span>
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
                        {barInfos.map((bar, barIdx) => {
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
          {/* 行政出勤カレンダー（月表示） */}
          <GovernmentAttendanceCalendar
            dates={weekDates}
            viewMode="month"
          />
          </div>
        )}
          </div>
        </div>
        </div>
      </div>

      {/* プロジェクトの複数日にわたるスケジュール表示（＋タスク一覧） */}
      <div className="bg-white dark:bg-gray-800 shadow border-y border-border dark:border-gray-700 min-w-0 w-full px-3 sm:px-4 md:px-6 py-6">
        <div className="space-y-2">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              進行中のプロジェクト
            </h3>
            {/* メンバー以外の役職で閲覧・個人切り替え */}
            {user?.role !== 'MEMBER' && isStaff && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                プロジェクト一覧はダッシュボードのモードに連動
              </p>
            )}
          </div>
          {projects.length > 0 ? (
            projects.map((project) => {
              const projectStartDate = project.startDate ? new Date(project.startDate) : null;
              const projectEndDate = project.endDate ? new Date(project.endDate) : null;
              const viewStartDate = weekDates[0];
              const viewEndDate = weekDates[weekDates.length - 1];

              const projectTasks = (project.relatedTasks || (project as any).tasks || []) as Task[];
              const isExpanded = expandedProjectIds.includes(project.id);
              
              // 表示期間内の開始日と終了日を計算
              const displayStartDate = projectStartDate && projectStartDate > viewStartDate ? projectStartDate : viewStartDate;
              const displayEndDate = projectEndDate && projectEndDate < viewEndDate ? projectEndDate : viewEndDate;
              
              return (
                <div
                  key={project.id}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                  style={{
                    borderLeftWidth: '4px',
                    borderLeftColor: project.themeColor || '#6B7280',
                  }}
                >
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    onClick={() => toggleProjectExpanded(project.id)}
                  >
                    <div className="flex-shrink-0">
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                      ) : (
                        <ChevronRightIcon className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {project.projectName}
                        </p>
                        {/* メンバー以外の役職で閲覧モード時のみ所有者名を表示 */}
                        {user?.role !== 'MEMBER' && projectViewMode === 'view' && project.user && (
                          <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                            （{project.user.name}）
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {formatDate(displayStartDate, 'M月d日')} 〜 {formatDate(displayEndDate, 'M月d日')} まで進行中
                      </p>
                    </div>
                    <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate('/projects', { state: { projectId: project.id } })}
                        className="whitespace-nowrap"
                      >
                        <ListChecks className="h-4 w-4 mr-1" />
                        詳細へ
                      </Button>
                    </div>
                  </div>

                  {isExpanded && projectTasks.length > 0 && (
                    <div className="px-4 pb-4 space-y-2 border-t border-gray-200 dark:border-gray-700 pt-3">
                      {projectTasks.map((task) => {
                        let statusClass = 'text-gray-600 dark:text-gray-300';
                        let statusBgClass = 'bg-gray-50 dark:bg-gray-700/50';
                        if (task.status === 'IN_PROGRESS') {
                          statusClass = 'text-blue-700 dark:text-blue-300';
                          statusBgClass = 'bg-blue-50 dark:bg-blue-900/20';
                        } else if (task.status === 'COMPLETED') {
                          statusClass = 'text-green-700 dark:text-green-300';
                          statusBgClass = 'bg-green-50 dark:bg-green-900/20';
                        }
                        return (
                          <div
                            key={task.id}
                            className={`flex items-center justify-between text-sm px-3 py-2 rounded-md ${statusBgClass} hover:opacity-80 transition-opacity cursor-pointer`}
                            onMouseEnter={() => setHoveredTaskId(task.id)}
                            onMouseLeave={() => setHoveredTaskId(null)}
                          >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {task.status === 'NOT_STARTED' && <Circle className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                              {task.status === 'IN_PROGRESS' && <PlayCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />}
                              {task.status === 'COMPLETED' && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}
                              <span className={`font-medium truncate ${statusClass}`}>{task.title}</span>
                            </div>
                            <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {task.status === 'NOT_STARTED'
                                ? '未着手'
                                : task.status === 'IN_PROGRESS'
                                ? '進行中'
                                : '完了'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {isExpanded && projectTasks.length === 0 && (
                    <div className="px-4 pb-4 text-sm text-gray-500 dark:text-gray-400 text-center py-3">
                      このプロジェクトに紐づくタスクはありません
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 py-4">
              {projectViewMode === 'personal' ? '表示期間内に自分のプロジェクトはありません' : '表示期間内に進行中のプロジェクトはありません'}
            </div>
          )}
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedDateForDetail(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center px-5 py-4 border-b dark:border-gray-700 flex-shrink-0">
                <h2 className="text-lg font-bold dark:text-gray-100">
                  {formatDate(selectedDateForDetail, 'yyyy年M月d日')} のスケジュール
                </h2>
                <button onClick={() => setSelectedDateForDetail(null)} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {/* 人フィルター */}
              {userGroups.length > 1 && (
                <div className="px-5 py-2 border-b dark:border-gray-700 flex-shrink-0">
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
                      <div className="space-y-1.5 pl-9">
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
                                className="w-full text-left px-3 py-2 rounded-lg border border-border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 bg-white dark:bg-gray-800 transition-colors"
                                style={{ borderLeftWidth: '3px', borderLeftColor: scheduleColor }}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap">
                                    {formatTime(schedule.startTime)}–{formatTime(schedule.endTime)}
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
    </div>
  );
};
