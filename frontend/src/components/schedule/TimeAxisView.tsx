import React from 'react';
import { Schedule as ScheduleType } from '../../types';
import { formatDate, isSameDay } from '../../utils/date';
import { CalendarDays } from 'lucide-react';

interface TimeAxisViewProps {
  dates: Date[];
  schedules: ScheduleType[];
  events: Array<{
    id: string;
    eventName: string;
    eventType: 'TOWN_OFFICIAL' | 'TEAM' | 'OTHER';
    date: string;
    startTime?: string | null;
    endTime?: string | null;
    isCompleted?: boolean;
  }>;
  onScheduleClick: (schedule: ScheduleType) => void;
  onEventClick: (eventId: string) => void;
  onCreateSchedule: (date: Date) => void;
  viewMode: 'week' | 'day';
}

// 時間帯を生成（0時から24時まで30分刻み）
const generateTimeSlots = () => {
  const slots = [];
  for (let hour = 0; hour < 24; hour++) {
    slots.push(`${String(hour).padStart(2, '0')}:00`);
    slots.push(`${String(hour).padStart(2, '0')}:30`);
  }
  return slots;
};

// 時間文字列（HH:mm）を分に変換
const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

// 分を時間文字列に変換
const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

// スケジュールの位置と高さを計算
const calculateSchedulePosition = (startTime: string, endTime: string) => {
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  const top = (startMinutes / 30) * 2; // 30分 = 2rem
  const height = ((endMinutes - startMinutes) / 30) * 2;
  return { top: `${top}rem`, height: `${Math.max(height, 2)}rem` };
};

export const TimeAxisView: React.FC<TimeAxisViewProps> = ({
  dates,
  schedules,
  events,
  onScheduleClick,
  onEventClick,
  onCreateSchedule,
  viewMode,
}) => {
  const timeSlots = generateTimeSlots();
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getSchedulesForDate = (date: Date) => {
    return schedules.filter((schedule) => isSameDay(new Date(schedule.date), date));
  };

  const getEventsForDate = (date: Date) => {
    return events.filter((event) => isSameDay(new Date(event.date), date));
  };

  return (
    <div className="flex border border-gray-200 rounded-lg overflow-hidden bg-white">
      {/* 時間軸 */}
      <div className="w-16 border-r border-gray-200 bg-gray-50 flex-shrink-0">
        <div className="h-12 border-b border-gray-200"></div>
        {hours.map((hour) => (
          <div key={hour} className="h-16 border-b border-gray-200 flex items-start justify-end pr-2">
            <span className="text-xs text-gray-600 font-medium">{hour}:00</span>
          </div>
        ))}
      </div>

      {/* 日付列 */}
      <div className="flex-1 flex overflow-x-auto">
        {dates.map((date, dateIndex) => {
          const daySchedules = getSchedulesForDate(date);
          const dayEvents = getEventsForDate(date);
          const isToday = formatDate(date) === formatDate(new Date());

          return (
            <div
              key={dateIndex}
              className={`flex-1 border-r border-gray-200 min-w-[200px] ${
                isToday ? 'bg-blue-50' : 'bg-white'
              }`}
            >
              {/* 日付ヘッダー */}
              <div className={`h-12 border-b border-gray-200 flex flex-col items-center justify-center ${
                isToday ? 'bg-blue-100 font-bold' : 'bg-gray-50'
              }`}>
                <div className="text-xs text-gray-600">
                  {formatDate(date, 'E')}
                </div>
                <div className={`text-lg ${isToday ? 'text-blue-700' : 'text-gray-900'}`}>
                  {formatDate(date, 'd')}
                </div>
              </div>

              {/* 時間軸エリア */}
              <div className="relative" style={{ height: '48rem' }}>
                {/* 時間帯の背景 */}
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="absolute w-full border-b border-gray-100"
                    style={{ top: `${hour * 4}rem`, height: '4rem' }}
                  />
                ))}

                {/* スケジュール */}
                {daySchedules.map((schedule) => {
                  const position = calculateSchedulePosition(schedule.startTime, schedule.endTime);
                  const participantCount = schedule.scheduleParticipants?.filter(p => p.status === 'APPROVED').length || 0;
                  
                  return (
                    <button
                      key={schedule.id}
                      onClick={() => onScheduleClick(schedule)}
                      className="absolute left-1 right-1 rounded text-xs p-1 text-white hover:opacity-90 transition-opacity z-10 overflow-hidden"
                      style={{
                        top: position.top,
                        height: position.height,
                        backgroundColor: schedule.user?.avatarColor || '#6B7280',
                        minHeight: '1.5rem',
                      }}
                      title={`${schedule.activityDescription} (${schedule.startTime}-${schedule.endTime})`}
                    >
                      <div className="flex items-start justify-between h-full">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-white">
                            {schedule.activityDescription}
                          </p>
                          <p className="text-xs text-white/80 truncate">
                            {schedule.startTime}-{schedule.endTime}
                          </p>
                        </div>
                        {participantCount > 0 && (
                          <span className="ml-1 text-xs bg-white/20 text-white px-1 rounded whitespace-nowrap">
                            +{participantCount}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}

                {/* イベント */}
                {dayEvents.map((event) => {
                  if (!event.startTime) return null;
                  
                  const position = calculateSchedulePosition(
                    event.startTime,
                    event.endTime || event.startTime
                  );
                  const eventTypeColors = {
                    TOWN_OFFICIAL: 'bg-blue-500',
                    TEAM: 'bg-green-500',
                    OTHER: 'bg-gray-500',
                  };
                  const colorClass = eventTypeColors[event.eventType] || eventTypeColors.OTHER;
                  
                  return (
                    <button
                      key={event.id}
                      onClick={() => onEventClick(event.id)}
                      className={`absolute left-1 right-1 rounded text-xs p-1 text-white hover:opacity-90 transition-opacity z-10 ${colorClass} ${
                        event.isCompleted ? 'opacity-60' : ''
                      }`}
                      style={{
                        top: position.top,
                        height: position.height,
                        minHeight: '1.5rem',
                      }}
                      title={event.eventName}
                    >
                      <div className="flex items-center gap-1 h-full">
                        <CalendarDays className="h-3 w-3 flex-shrink-0" />
                        <p className="font-medium truncate text-white">
                          {event.eventName}
                        </p>
                      </div>
                    </button>
                  );
                })}

                {/* 新規作成ボタン（各時間帯に配置） */}
                {hours.map((hour) => (
                  <button
                    key={hour}
                    onClick={() => onCreateSchedule(date)}
                    className="absolute w-full opacity-0 hover:opacity-100 transition-opacity border-dashed border-2 border-gray-300 hover:border-blue-400 rounded"
                    style={{
                      top: `${hour * 4}rem`,
                      height: '4rem',
                    }}
                    title="クリックしてスケジュールを追加"
                  >
                    <span className="text-xs text-gray-400">+</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

