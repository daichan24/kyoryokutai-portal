import React, { useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';

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

interface InterviewCalendarProps {
  schedules: InterviewSchedule[];
  month: string;
  memberName: string;
}

export const InterviewCalendar: React.FC<InterviewCalendarProps> = ({ schedules, month, memberName }) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const monthStart = useMemo(() => startOfMonth(new Date(`${month}-01`)), [month]);
  const monthEnd = useMemo(() => endOfMonth(new Date(`${month}-01`)), [month]);
  const daysInMonth = useMemo(() => eachDayOfInterval({ start: monthStart, end: monthEnd }), [monthStart, monthEnd]);

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

  const startDayOfWeek = monthStart.getDay();

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          {memberName}さんのスケジュール - {format(monthStart, 'yyyy年M月', { locale: ja })}
        </h3>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Day headers */}
          {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
            <div
              key={day}
              className={`text-center text-xs font-medium py-2 ${
                i === 0 ? 'text-red-600 dark:text-red-400' : i === 6 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              {day}
            </div>
          ))}

          {/* Empty cells for days before month starts */}
          {Array.from({ length: startDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}

          {/* Calendar days */}
          {daysInMonth.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const daySchedules = schedulesByDate.get(dateKey) || [];
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isToday = isSameDay(day, new Date());

            return (
              <button
                key={dateKey}
                onClick={() => setSelectedDate(day)}
                className={`aspect-square p-1 rounded-lg border transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : isToday
                    ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/20'
                    : daySchedules.length > 0
                    ? 'border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{format(day, 'd')}</div>
                {daySchedules.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {daySchedules.slice(0, 2).map((s) => (
                      <div
                        key={s.id}
                        className="h-1 rounded-full"
                        style={{ backgroundColor: s.project?.themeColor || '#6366f1' }}
                      />
                    ))}
                    {daySchedules.length > 2 && (
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">+{daySchedules.length - 2}</div>
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
