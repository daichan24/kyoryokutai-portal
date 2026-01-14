import React, { useEffect, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../utils/api';
import { Schedule as ScheduleType } from '../types';
import { formatDate, getWeekDates, getMonthDates, getDayDate, isSameDay } from '../utils/date';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ScheduleModal } from '../components/schedule/ScheduleModal';
import { useAuthStore } from '../stores/authStore';

type ViewMode = 'week' | 'month' | 'day';

export const Schedule: React.FC = () => {
  const { user } = useAuthStore();
  const [schedules, setSchedules] = useState<ScheduleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('week');
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
    setLoading(true);
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">
          スケジュール管理
          {user?.role === 'MEMBER' && <span className="text-lg font-normal text-gray-500 ml-2">（自分のスケジュール）</span>}
        </h1>
        <Button onClick={() => handleCreateSchedule(new Date())}>
          <Plus className="h-4 w-4 mr-2" />
          新規作成
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow border border-border p-6">
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
              {viewMode === 'month' && weekDates[0] && formatDate(weekDates[0], 'yyyy年M月')}
            </h2>
          </div>
          <Button variant="outline" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className={`grid gap-2 ${
            viewMode === 'day' ? 'grid-cols-1' :
            viewMode === 'week' ? 'grid-cols-7' :
            'grid-cols-7'
          }`}>
            {weekDates.map((date, index) => {
              const daySchedules = getSchedulesForDate(date);
              const isToday =
                formatDate(date) === formatDate(new Date());

              return (
                <div
                  key={index}
                  className={`border border-border rounded-lg p-3 ${
                    isToday ? 'bg-primary/5 border-primary' : 'bg-white'
                  } ${
                    viewMode === 'day' ? 'min-h-[600px]' :
                    viewMode === 'month' ? 'min-h-[120px]' :
                    'min-h-[200px]'
                  }`}
                >
                  <div className="text-center mb-2">
                    <p className="text-xs text-gray-500">
                      {formatDate(date, 'E')}
                    </p>
                    <p className={`text-lg font-bold ${isToday ? 'text-primary' : ''}`}>
                      {formatDate(date, 'd')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    {daySchedules.map((schedule) => (
                      <button
                        key={schedule.id}
                        onClick={() => handleEditSchedule(schedule)}
                        className="w-full text-left p-2 rounded text-xs border border-border hover:bg-gray-50"
                        style={{
                          borderLeftWidth: '3px',
                          borderLeftColor: schedule.user?.avatarColor,
                        }}
                      >
                        <p className="font-medium truncate">
                          {schedule.activityDescription}
                        </p>
                        <p className="text-gray-600">
                          {schedule.startTime}-{schedule.endTime}
                        </p>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={() => handleCreateSchedule(date)}
                    className="w-full mt-2 text-xs text-gray-500 hover:text-primary"
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
