import React, { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SchedulePreviewModal } from './SchedulePreviewModal';

interface InterviewParticipantUser {
  id: string;
  name: string;
  avatarColor: string;
  role: string;
}

interface InterviewSchedule {
  id: string;
  startDate: string;
  endDate: string;
  date: string;
  startTime: string;
  endTime: string;
  shortTitle: string | null;
  activityDescription: string;
  freeNote: string | null;
  locationText: string | null;
  location: { id: string; name: string } | null;
  project: { id: string; projectName: string; themeColor: string | null } | null;
  scheduleParticipants: Array<{
    userId: string;
    user: InterviewParticipantUser;
  }>;
  legacyParticipantUsers: InterviewParticipantUser[];
}

interface EnhancedInterviewCalendarProps {
  schedules: InterviewSchedule[];
  initialMonth: string; // YYYY-MM format
  memberName: string;
  onMonthChange?: (month: string) => void;
}

export const EnhancedInterviewCalendar: React.FC<EnhancedInterviewCalendarProps> = ({
  schedules,
  initialMonth,
  memberName,
  onMonthChange,
}) => {
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date(`${initialMonth}-01`));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);

  const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);
  
  // カレンダーの開始日と終了日（前後の月の日付を含む）
  const calendarStart = useMemo(() => startOfWeek(monthStart, { weekStartsOn: 0 }), [monthStart]);
  const calendarEnd = useMemo(() => endOfWeek(monthEnd, { weekStartsOn: 0 }), [monthEnd]);
  const calendarDays = useMemo(() => eachDayOfInterval({ start: calendarStart, end: calendarEnd }), [calendarStart, calendarEnd]);

  const schedulesByDate = useMemo(() => {
    const map = new Map<string, InterviewSchedule[]>();
    schedules.forEach((s) => {
      const dateKey = format(parseISO(s.startDate), 'yyyy-MM-dd');
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(s);
    });
    return map;
  }, [schedules]);

  const selectedSchedules = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return schedulesByDate.get(dateKey) || [];
  }, [selectedDate, schedulesByDate]);

  const handlePrevMonth = () => {
    const newMonth = subMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    if (onMonthChange) {
      onMonthChange(format(newMonth, 'yyyy-MM'));
    }
  };

  const handleNextMonth = () => {
    const newMonth = addMonths(currentMonth, 1);
    setCurrentMonth(newMonth);
    if (onMonthChange) {
      onMonthChange(format(newMonth, 'yyyy-MM'));
    }
  };

  const isCurrentMonth = (day: Date) => {
    return day.getMonth() === currentMonth.getMonth();
  };

  const handleDateClick = (day: Date) => {
    setSelectedDate(day);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {memberName}さんのスケジュール
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <span className="text-lg font-medium text-gray-900 dark:text-gray-100 min-w-[120px] text-center">
              {format(currentMonth, 'yyyy年M月', { locale: ja })}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <ChevronRight className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          {/* Day headers */}
          {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
            <div
              key={day}
              className={`bg-gray-50 dark:bg-gray-800 text-center text-xs font-medium py-2 ${
                i === 0 ? 'text-red-600 dark:text-red-400' : i === 6 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {calendarDays.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const daySchedules = schedulesByDate.get(dateKey) || [];
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());
            const isOtherMonth = !isCurrentMonth(day);

            return (
              <button
                key={dateKey}
                onClick={() => handleDateClick(day)}
                className={`min-h-[80px] p-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors text-left ${
                  isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''
                } ${isOtherMonth ? 'opacity-40' : ''}`}
              >
                <div className={`text-sm font-medium mb-1 ${
                  isToday
                    ? 'inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-500 text-white'
                    : isOtherMonth
                    ? 'text-gray-400 dark:text-gray-600'
                    : 'text-gray-900 dark:text-gray-100'
                }`}>
                  {format(day, 'd')}
                </div>
                {daySchedules.length > 0 && (
                  <div className="space-y-1">
                    {daySchedules.slice(0, 3).map((s) => (
                      <div
                        key={s.id}
                        className="text-[10px] px-1 py-0.5 rounded truncate"
                        style={{
                          backgroundColor: s.project?.themeColor || '#6366f1',
                          color: 'white',
                        }}
                        title={s.shortTitle || s.activityDescription}
                      >
                        {s.startTime} {s.shortTitle || s.activityDescription?.slice(0, 10)}
                      </div>
                    ))}
                    {daySchedules.length > 3 && (
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 px-1">
                        +{daySchedules.length - 3}件
                      </div>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* モーダルでプレビュー表示 */}
      {showModal && selectedDate && (
        <SchedulePreviewModal
          date={selectedDate}
          schedules={selectedSchedules}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};
