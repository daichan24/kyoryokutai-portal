import React, { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
                onClick={() => setSelectedDate(day)}
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

      {/* Schedule Preview */}
      {selectedDate && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
          <h4 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-3">
            {format(selectedDate, 'M月d日（EEE）', { locale: ja })}の予定
          </h4>

          {selectedSchedules.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">この日の予定はありません</p>
          ) : (
            <div className="space-y-3">
              {selectedSchedules.map((s) => {
                const people = [
                  ...s.scheduleParticipants.map((p) => p.user),
                  ...s.legacyParticipantUsers,
                ];
                const uniquePeople = Array.from(
                  new Map(people.map((p) => [p.id, p])).values()
                );

                return (
                  <div
                    key={s.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900/40"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 tabular-nums">
                        {s.startTime} - {s.endTime}
                      </span>
                      {s.project && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                          style={{ backgroundColor: s.project.themeColor || '#6366f1' }}
                        >
                          {s.project.projectName}
                        </span>
                      )}
                    </div>

                    <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                      {s.shortTitle?.trim() || s.activityDescription?.trim()?.split(/\n/)?.[0]?.slice(0, 80) || '（タイトルなし）'}
                    </p>

                    {s.activityDescription?.trim() && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap mb-2 line-clamp-3">
                        {s.activityDescription}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 text-xs">
                      {(s.location?.name || s.locationText) && (
                        <span className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                          📍 {s.location?.name || s.locationText}
                        </span>
                      )}
                      {uniquePeople.map((p) => (
                        <span
                          key={p.id}
                          className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                        >
                          {p.name}
                        </span>
                      ))}
                    </div>

                    {s.freeNote?.trim() && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 border-t border-dashed border-gray-200 dark:border-gray-600 pt-2">
                        メモ: {s.freeNote}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
