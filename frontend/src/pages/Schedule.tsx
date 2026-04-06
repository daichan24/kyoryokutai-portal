import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, ChevronDown, ChevronRight as ChevronRightIcon, ListChecks, RefreshCw, Circle, PlayCircle, CheckCircle2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { Schedule as ScheduleType, Project, Task, User } from '../types';
import { formatDate, getWeekDates, getMonthDates, isSameDay, isHolidayDate, isSunday, isSaturday, formatTime } from '../utils/date';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ScheduleModal } from '../components/schedule/ScheduleModal';
import { TimeAxisView } from '../components/schedule/TimeAxisView';
import { GovernmentAttendanceCalendar } from '../components/schedule/GovernmentAttendanceCalendar';
import { GovernmentAttendanceModal } from '../components/schedule/GovernmentAttendanceModal';
import { useAuthStore } from '../stores/authStore';
import { useStaffWorkspace } from '../stores/workspaceStore';
import { format } from 'date-fns';

type ViewMode = 'week' | 'month';

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
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month'); // デフォルトを月表示に変更
  const [weekDates, setWeekDates] = useState<Date[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleType | null>(null);
  const [defaultStartTime, setDefaultStartTime] = useState<string | undefined>(undefined);
  const [defaultEndTime, setDefaultEndTime] = useState<string | undefined>(undefined);
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>([]);
  /** 隊員向け: 月表示の個人/全体。マスター等はダッシュボードのモードを使用 */
  const [calendarViewModeMember, setCalendarViewModeMember] = useState<'individual' | 'all'>('individual');
  const calendarViewMode = isStaff
    ? workspaceMode === 'browse'
      ? 'all'
      : 'individual'
    : calendarViewModeMember;
  const projectViewMode: 'view' | 'personal' = isStaff
    ? workspaceMode === 'browse'
      ? 'view'
      : 'personal'
    : 'personal';
  const [selectedDateForDetail, setSelectedDateForDetail] = useState<Date | null>(null); // 詳細表示用の選択日
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null); // 週表示の個人モードで選択されたメンバーID
  const [availableMembers, setAvailableMembers] = useState<User[]>([]); // 選択可能なメンバーリスト
  const [isGovernmentAttendanceModalOpen, setIsGovernmentAttendanceModalOpen] = useState(false);
  const [detailFilterUserId, setDetailFilterUserId] = useState<string>('');

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
    }
  }, [currentDate, viewMode]);

  useEffect(() => {
    if (weekDates.length > 0) {
      fetchSchedules();
      fetchEvents();
      fetchProjects();
    }
  }, [weekDates, calendarViewMode, selectedMemberId, user?.id, isStaff, workspaceMode]);

  // メンバーリストを取得（週表示・月表示共通）
  useEffect(() => {
    fetchMembers();
  }, []);

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
      
      if (viewMode === 'month') {
        if (selectedMemberId) {
          // 特定メンバーを選択している場合
          params.append('userId', selectedMemberId);
        } else if (calendarViewMode === 'all') {
          params.append('allMembers', 'true');
        }
        // individual の場合は自分のスケジュール（デフォルト）
      } else {
        // 週表示
        if (selectedMemberId) {
          params.append('userId', selectedMemberId);
        } else if (isStaff && workspaceMode === 'browse') {
          params.append('allMembers', 'true');
        }
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

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
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

  return (
    <div className="space-y-6">
      {/* スマホ: タイトルとボタンを別カラムに配置 */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100 whitespace-nowrap">
          スケジュール管理
        </h1>
        <div className="flex flex-wrap gap-2 items-center">
          {/* カレンダー表示切り替え: 隊員・スタッフ共通 */}
          {viewMode === 'month' ? (
            <div className="flex items-center gap-2 mr-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:inline">表示:</span>
              <div className="flex gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCalendarViewModeMember('individual');
                    setSelectedMemberId(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors text-sm ${
                    calendarViewModeMember === 'individual' && !selectedMemberId
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  個人
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCalendarViewModeMember('all');
                    setSelectedMemberId(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors text-sm ${
                    calendarViewModeMember === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  全体
                </button>
                {/* 全ロールで特定メンバーを選択可能 */}
                {availableMembers.length > 0 && (
                  <select
                    value={selectedMemberId || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelectedMemberId(value || null);
                      if (value) setCalendarViewModeMember('individual');
                    }}
                    className={`px-2 py-1.5 rounded-lg border font-medium transition-colors text-sm ${
                      selectedMemberId
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <option value="">{isStaff ? '個人を選択' : '他のメンバー'}</option>
                    {availableMembers.map((member) => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ) : viewMode === 'week' ? (
            <div className="flex items-center gap-2 mr-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 hidden sm:inline">表示:</span>
              <div className="flex gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMemberId(null)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-colors text-sm ${
                    !selectedMemberId
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  自分
                </button>
                {availableMembers.length > 0 && (
                  <select
                    value={selectedMemberId || ''}
                    onChange={(e) => setSelectedMemberId(e.target.value || null)}
                    className={`px-2 py-1.5 rounded-lg border font-medium transition-colors text-sm ${
                      selectedMemberId
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600'
                    }`}
                  >
                    <option value="">メンバーを選択</option>
                    {availableMembers.map((member) => (
                      <option key={member.id} value={member.id}>{member.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          ) : null}
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

      <div className="bg-white dark:bg-gray-800 rounded-none sm:rounded-lg shadow sm:border lg:border-border dark:border-gray-700 p-0 sm:p-6 min-w-0 w-full">
        <div className="flex justify-between items-center mb-4 sm:mb-6 px-3 sm:px-0 pt-3 sm:pt-0">
          <Button variant="outline" onClick={handlePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-4">
            <div className="flex gap-2">
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
              {viewMode === 'week' && weekDates[0] && weekDates[6] && (
                <>
                  {formatDate(weekDates[0], 'yyyy年M月d日')} -{' '}
                  {formatDate(weekDates[6], 'M月d日')}
                </>
              )}
              {viewMode === 'month' && formatDate(currentDate, 'yyyy年M月')}
            </h2>
          </div>
          <Button variant="outline" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>


        {loading ? (
          <LoadingSpinner />
        ) : viewMode === 'week' ? (
          <>
            <TimeAxisView
              dates={weekDates}
              schedules={schedules}
              events={events}
              onScheduleClick={(schedule) => {
                const isOtherUser = calendarViewMode === 'all' && schedule.userId !== user?.id;
                if (isOtherUser) {
                  setSelectedSchedule(schedule);
                  setIsModalOpen(true);
                } else {
                  handleEditSchedule(schedule);
                }
              }}
              onEventClick={handleEventClick}
              onCreateSchedule={handleCreateSchedule}
              viewMode={viewMode}
              calendarViewMode={calendarViewMode}
              currentUserId={user?.id}
            />
            {/* 行政出勤カレンダー（週表示） */}
            <GovernmentAttendanceCalendar
              dates={weekDates}
              viewMode="week"
            />
          </>
        ) : (
          <div className="w-full min-w-0 overflow-x-hidden">
            {/* Header row for days of the week */}
            <div className="grid grid-cols-7 gap-0 w-full min-w-0 mb-1 px-0">
              {weekDates.slice(0, 7).map((date, index) => {
                const isHoliday = isHolidayDate(date);
                const isSun = isSunday(date);
                const isSat = isSaturday(date);
                let dayLabelColor = 'text-gray-500 dark:text-gray-400';
                if (isHoliday || isSun) {
                  dayLabelColor = 'text-red-500 dark:text-red-400';
                } else if (isSat) {
                  dayLabelColor = 'text-blue-500 dark:text-blue-400';
                }
                return (
                  <div key={`header-${index}`} className={`text-center text-[10px] sm:text-xs font-semibold py-1 ${dayLabelColor}`}>
                    {formatDate(date, 'E')}
                  </div>
                );
              })}
            </div>
            <div
              className="grid gap-0 w-full min-w-0 border-t border-l border-border dark:border-gray-700 sm:border-0"
              style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))' }}
            >
            {weekDates.map((date, index) => {
              const daySchedules = getSchedulesForDate(date);
              const isToday = formatDate(date) === formatDate(new Date());
              const isHoliday = isHolidayDate(date);
              const isSun = isSunday(date);
              const isSat = isSaturday(date);

              // 色分け: 祝日 > 日曜 > 土曜
              let dayBgColor = 'bg-white dark:bg-gray-800';
              let dayTextColor = 'text-gray-900 dark:text-gray-100';
              let dayLabelColor = 'text-gray-500 dark:text-gray-400';

              if (isHoliday) {
                dayBgColor = 'bg-red-50 dark:bg-red-900/20';
                dayTextColor = 'text-red-700 dark:text-red-300';
                dayLabelColor = 'text-red-600 dark:text-red-400';
              } else if (isSun) {
                dayBgColor = 'bg-red-50 dark:bg-red-900/20';
                dayTextColor = 'text-red-600 dark:text-red-400';
                dayLabelColor = 'text-red-500 dark:text-red-400';
              } else if (isSat) {
                dayBgColor = 'bg-blue-50 dark:bg-blue-900/20';
                dayTextColor = 'text-blue-600 dark:text-blue-400';
                dayLabelColor = 'text-blue-500 dark:text-blue-400';
              }

              // 今日の場合は強調
              if (isToday) {
                dayBgColor = 'bg-primary/10 dark:bg-primary/20 border-primary border-2';
                dayTextColor = 'text-primary dark:text-blue-400 font-bold';
              }

              const isHighlightedByTask =
                hoveredTaskId != null &&
                daySchedules.some((s) => s.taskId && s.taskId === hoveredTaskId);

              // 5件まで表示、それ以降は「他◯件」表示
              const MAX_VISIBLE_SCHEDULES = 5;
              const visibleSchedules = daySchedules.slice(0, MAX_VISIBLE_SCHEDULES);
              const remainingCount = daySchedules.length > MAX_VISIBLE_SCHEDULES
                ? daySchedules.length - MAX_VISIBLE_SCHEDULES
                : 0;

              // 色の取得：個人モードはカスタム色→プロジェクト色→ユーザー色、全体モードはユーザー色
              const getScheduleColor = (schedule: ScheduleType) => {
                if (calendarViewMode === 'all') {
                  return schedule.user?.avatarColor || '#6B7280';
                }
                // 個人表示: customColor > project.themeColor > user.avatarColor
                return (schedule as any).customColor || schedule.project?.themeColor || schedule.user?.avatarColor || '#6B7280';
              };

              // 行政出勤ドットは削除（行政カレンダーモーダルのみで確認）
              const dateStr = format(date, 'yyyy-MM-dd');

              const getTextColor = (backgroundColor: string) => {
                // HEXカラーをRGBに変換
                const hex = backgroundColor.replace('#', '');
                const r = parseInt(hex.substr(0, 2), 16);
                const g = parseInt(hex.substr(2, 2), 16);
                const b = parseInt(hex.substr(4, 2), 16);
                // 輝度を計算（0.299*R + 0.587*G + 0.114*B）
                const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                // 輝度が128より大きい場合は黒、小さい場合は白
                return brightness > 128 ? 'text-gray-900' : 'text-white';
              };

              // 他の人のスケジュールかどうかを判定
              const isOtherUserSchedule = (schedule: ScheduleType) => {
                return schedule.userId !== user?.id;
              };

              return (
                <div
                  key={index}
                  className={`bg-white dark:bg-gray-800 border-r border-b sm:border rounded-none min-w-0 w-full flex flex-col p-1 sm:p-2 ${
                    isHighlightedByTask ? 'ring-2 ring-blue-400 dark:ring-blue-300 relative z-10' : 'border-border dark:border-gray-700'
                  } ${calendarViewMode !== 'all' ? 'cursor-pointer' : 'cursor-default'}`}
                  style={{ minHeight: '5.5rem', height: 'clamp(5.5rem, 22vw, 10rem)' }}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('button')) return;
                    if (calendarViewMode === 'all') {
                      // 閲覧モード: スケジュールがあれば詳細表示のみ、新規作成はしない
                      if (daySchedules.length > 0) setSelectedDateForDetail(date);
                      return;
                    }
                    handleCreateSchedule(date);
                  }}
                >
                  <div className="text-center mb-1 sm:mb-2 flex-shrink-0 min-w-0">
                    <p className={`text-sm sm:text-lg font-bold ${dayTextColor} ${
                      formatDate(date, 'M') !== formatDate(currentDate, 'M') ? 'opacity-40' : ''
                    }`}>
                      {formatDate(date, 'd')}
                    </p>
                  </div>

                  <div className="space-y-1 flex-1 overflow-hidden">
                    {/* スケジュール表示 */}
                    {visibleSchedules.map((schedule) => {
                      const participantCount = schedule.scheduleParticipants?.filter(p => p.status === 'APPROVED').length || 0;
                      const scheduleColor = getScheduleColor(schedule);
                      const isOtherUser = isOtherUserSchedule(schedule);
                      const isReadOnly = calendarViewMode === 'all' && isOtherUser;
                      const textColor = getTextColor(scheduleColor);

                      // 複数日またぎの判定
                      const schedStartDate = (schedule as any).startDate
                        ? (schedule as any).startDate.slice(0, 10)
                        : formatDate(schedule.date);
                      const schedEndDate = (schedule as any).endDate
                        ? (schedule as any).endDate.slice(0, 10)
                        : schedStartDate;
                      const isMultiDay = schedStartDate !== schedEndDate;
                      const isStartDay = formatDate(date) === schedStartDate;
                      const isEndDay = formatDate(date) === schedEndDate;
                      
                      return (
                        <button
                          key={schedule.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isReadOnly) {
                              setSelectedSchedule(schedule);
                              setIsModalOpen(true);
                            } else {
                              handleEditSchedule(schedule);
                            }
                          }}
                          className={`w-full text-left px-2 py-1 text-xs hover:opacity-90 transition-opacity ${
                            isMultiDay
                              ? isStartDay ? 'rounded-l' : isEndDay ? 'rounded-r' : 'rounded-none'
                              : 'rounded'
                          }`}
                          style={{
                            backgroundColor: scheduleColor,
                            color: textColor === 'text-white' ? '#ffffff' : '#111827',
                            marginLeft: isMultiDay && !isStartDay ? '-4px' : undefined,
                            marginRight: isMultiDay && !isEndDay ? '-4px' : undefined,
                          }}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            {(!isMultiDay || isStartDay) && (
                              <span className="font-medium whitespace-nowrap">{formatTime(schedule.startTime)}-{formatTime(schedule.endTime)}</span>
                            )}
                            {isStartDay && (
                              <span className="truncate">{(schedule as any).title || schedule.activityDescription}</span>
                            )}
                            {calendarViewMode === 'all' && schedule.user && isStartDay && (
                              <span className="whitespace-nowrap">（{schedule.user.name}）</span>
                            )}
                            {participantCount > 0 && isStartDay && (
                              <span className="ml-auto text-xs px-1 rounded whitespace-nowrap" style={{
                                backgroundColor: textColor === 'text-white' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)',
                              }}>
                                +{participantCount}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                    
                    {/* 残りのスケジュール数表示 */}
                    {remainingCount > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDateForDetail(date);
                        }}
                        className="w-full text-center px-2 py-1 rounded text-xs border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium"
                      >
                        他{remainingCount}件
                      </button>
                    )}
                    
                    {/* イベント表示（read-only） */}
                    {getEventsForDate(date).map((event) => {
                      const eventTypeColors = {
                        TOWN_OFFICIAL: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300',
                        TEAM: 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-800 dark:text-green-300',
                        OTHER: 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-800 dark:text-gray-200',
                      };
                      const colorClass = eventTypeColors[event.eventType] || eventTypeColors.OTHER;
                      
                      return (
                        <button
                          key={event.id}
                          onClick={() => handleEventClick(event.id)}
                          className={`w-full text-left p-2 rounded text-xs border-2 hover:opacity-80 transition-opacity ${colorClass} ${
                            event.isCompleted ? 'opacity-60' : ''
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {event.eventName}
                              </p>
                              {event.startTime && (
                                <p className="text-xs opacity-75">
                                  {event.startTime}
                                  {event.endTime && `-${event.endTime}`}
                                </p>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            </div>
          </div>
        )}

        {/* プロジェクトの複数日にわたるスケジュール表示（＋タスク一覧） */}
        <div className="mt-6 space-y-2">
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

      {isModalOpen && (
        <ScheduleModal
          schedule={selectedSchedule}
          defaultDate={selectedDate}
          defaultStartTime={defaultStartTime}
          defaultEndTime={defaultEndTime}
          readOnly={
            selectedSchedule
              ? calendarViewMode === 'all' && selectedSchedule.userId !== user?.id
              : false
          }
          onClose={handleCloseModal}
          onSaved={handleSaved}
        />
      )}

      {/* 日詳細表示モーダル（全体表示時） */}
      {selectedDateForDetail && calendarViewMode === 'all' && (() => {
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
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
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
