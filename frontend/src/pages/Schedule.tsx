import React, { useEffect, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { Schedule as ScheduleType } from '../types';
import { formatDate, getWeekDates, getMonthDates, getDayDate, isSameDay, isHolidayDate, isSunday, isSaturday } from '../utils/date';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ScheduleModal } from '../components/schedule/ScheduleModal';
import { TimeAxisView } from '../components/schedule/TimeAxisView';
import { useAuthStore } from '../stores/authStore';

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
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<ScheduleType[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('month'); // デフォルトを月表示に変更
  const [weekDates, setWeekDates] = useState<Date[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleType | null>(null);

  useEffect(() => {
    if (viewMode === 'week') {
      setWeekDates(getWeekDates(currentDate));
    } else if (viewMode === 'month') {
      setWeekDates(getMonthDates(currentDate));
    } else {
      setWeekDates(getDayDate(currentDate));
    }
  }, [currentDate, viewMode]);

  useEffect(() => {
    if (weekDates.length > 0) {
      fetchSchedules();
      fetchEvents();
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

  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
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
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleCreateSchedule = (date: Date) => {
    setSelectedDate(date);
    setSelectedSchedule(null);
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          スケジュール管理
          {user?.role === 'MEMBER' && <span className="text-lg font-normal text-gray-500 dark:text-gray-400 ml-2">（自分のスケジュール）</span>}
        </h1>
        <Button onClick={() => handleCreateSchedule(new Date())}>
          <Plus className="h-4 w-4 mr-2" />
          新規作成
        </Button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6">
        <div className="flex justify-between items-center mb-6">
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
            <h2 className="text-xl font-bold">
              {viewMode === 'day' && weekDates[0] && formatDate(weekDates[0], 'yyyy年M月d日')}
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

        {/* 週/月表示のヘッダー（日曜始まり） */}
        {(viewMode === 'week' || viewMode === 'month') && (
          <div className="grid grid-cols-7 gap-2 mb-2">
            {['日', '月', '火', '水', '木', '金', '土'].map((day, idx) => (
              <div
                key={idx}
                className={`text-center text-sm font-semibold py-2 ${
                  idx === 0 ? 'text-red-600 dark:text-red-400' : idx === 6 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                {day}
              </div>
            ))}
          </div>
        )}

        {loading ? (
          <LoadingSpinner />
        ) : viewMode === 'week' || viewMode === 'day' ? (
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

              return (
                <div
                  key={index}
                  className={`border border-border rounded-lg p-3 ${dayBgColor} min-h-[120px]`}
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
                            borderLeftColor: schedule.user?.avatarColor,
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
      </div>

      {isModalOpen && (
        <ScheduleModal
          schedule={selectedSchedule}
          defaultDate={selectedDate}
          onClose={handleCloseModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};
