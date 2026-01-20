import React, { useEffect, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, CalendarDays, ChevronDown, ChevronRight as ChevronRightIcon, ListChecks, RefreshCw, Circle, PlayCircle, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { Schedule as ScheduleType, Project, Task } from '../types';
import { formatDate, getWeekDates, getMonthDates, isSameDay, isHolidayDate, isSunday, isSaturday } from '../utils/date';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ScheduleModal } from '../components/schedule/ScheduleModal';
import { TimeAxisView } from '../components/schedule/TimeAxisView';
import { useAuthStore } from '../stores/authStore';

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
  }, [weekDates]);

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
      const startDate = formatDate(weekDates[0]);
      const endDate = formatDate(weekDates[weekDates.length - 1]);
      const response = await api.get<Project[]>('/api/projects');
      const allProjects = response.data || [];
      
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
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          スケジュール管理
          {user?.role === 'MEMBER' && <span className="text-lg font-normal text-gray-500 dark:text-gray-400 ml-2">（自分のスケジュール）</span>}
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              await Promise.all([fetchSchedules(), fetchProjects()]);
            }}
            title="スケジュールとタスクを更新"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            更新
          </Button>
          <Button onClick={() => handleCreateSchedule(new Date())}>
            <Plus className="h-4 w-4 mr-2" />
            新規作成
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6">
        <div className="flex justify-between items-center mb-6">
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
          <TimeAxisView
            dates={weekDates}
            schedules={schedules}
            events={events}
            onScheduleClick={handleEditSchedule}
            onEventClick={handleEventClick}
            onCreateSchedule={handleCreateSchedule}
            viewMode={viewMode}
          />
        ) : (
          <div className="grid gap-2 grid-cols-7">
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

              return (
                <div
                  key={index}
                  className={`border rounded-lg p-3 min-h-[120px] ${dayBgColor} ${
                    isHighlightedByTask ? 'ring-2 ring-blue-400 dark:ring-blue-300' : 'border-border'
                  }`}
                >
                  <div className="text-center mb-2">
                    <p className={`text-xs ${dayLabelColor}`}>
                      {formatDate(date, 'E')}
                    </p>
                    <p className={`text-lg font-bold ${dayTextColor} ${
                      formatDate(date, 'M') !== formatDate(currentDate, 'M') ? 'opacity-40' : ''
                    }`}>
                      {formatDate(date, 'd')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    {/* スケジュール表示 */}
                    {daySchedules.map((schedule) => {
                      const participantCount = schedule.scheduleParticipants?.filter(p => p.status === 'APPROVED').length || 0;
                      return (
                        <button
                          key={schedule.id}
                          onClick={() => handleEditSchedule(schedule)}
                          className="w-full text-left p-2 rounded text-xs border border-border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 bg-white dark:bg-gray-800"
                          style={{
                            borderLeftWidth: '3px',
                            borderLeftColor: schedule.project?.themeColor || schedule.user?.avatarColor || '#6B7280',
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {schedule.activityDescription}
                              </p>
                              <p className="text-gray-600 dark:text-gray-400">
                                {schedule.startTime}-{schedule.endTime}
                              </p>
                            </div>
                            {participantCount > 0 && (
                              <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded whitespace-nowrap">
                                +{participantCount}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                    
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

                  <button
                    onClick={() => handleCreateSchedule(date)}
                    className="w-full mt-2 text-xs text-gray-500 dark:text-gray-400 hover:text-primary dark:hover:text-blue-400"
                  >
                    + 追加
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* プロジェクトの複数日にわたるスケジュール表示（＋タスク一覧） */}
        {projects.length > 0 && (
          <div className="mt-6 space-y-2">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              進行中のプロジェクト
            </h3>
            {projects.map((project) => {
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
                      <p className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                        {project.projectName}
                      </p>
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
            })}
          </div>
        )}
      </div>

      {isModalOpen && (
        <ScheduleModal
          schedule={selectedSchedule}
          defaultDate={selectedDate}
          defaultStartTime={defaultStartTime}
          defaultEndTime={defaultEndTime}
          onClose={handleCloseModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};
