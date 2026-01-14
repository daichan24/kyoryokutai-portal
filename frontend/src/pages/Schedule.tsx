import React, { useEffect, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../utils/api';
import { Schedule as ScheduleType } from '../types';
import { formatDate, getWeekDates, isSameDay } from '../utils/date';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ScheduleModal } from '../components/schedule/ScheduleModal';
import { useAuthStore } from '../stores/authStore';

export const Schedule: React.FC = () => {
  const { user } = useAuthStore();
  const [schedules, setSchedules] = useState<ScheduleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [weekDates, setWeekDates] = useState<Date[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleType | null>(null);

  useEffect(() => {
    setWeekDates(getWeekDates(currentDate));
  }, [currentDate]);

  useEffect(() => {
    if (weekDates.length > 0) {
      fetchSchedules();
    }
  }, [weekDates]);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: formatDate(weekDates[0]),
        endDate: formatDate(weekDates[6]),
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

  const handlePrevWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 7);
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
          <Button variant="outline" onClick={handlePrevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xl font-bold">
            {formatDate(weekDates[0] || new Date(), 'yyyy年M月d日')} -{' '}
            {formatDate(weekDates[6] || new Date(), 'M月d日')}
          </h2>
          <Button variant="outline" onClick={handleNextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {weekDates.map((date, index) => {
              const daySchedules = getSchedulesForDate(date);
              const isToday =
                formatDate(date) === formatDate(new Date());

              return (
                <div
                  key={index}
                  className={`min-h-[200px] border border-border rounded-lg p-3 ${
                    isToday ? 'bg-primary/5 border-primary' : 'bg-white'
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
