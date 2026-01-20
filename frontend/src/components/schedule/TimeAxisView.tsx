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
  onCreateSchedule: (date: Date, startTime?: string, endTime?: string) => void;
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
  // 1時間 = 4rem（48rem / 24時間）、30分 = 2rem
  const top = (startMinutes / 60) * 4; // 分を時間に変換してremに変換
  const height = ((endMinutes - startMinutes) / 60) * 4;
  return { top: `${top}rem`, height: `${Math.max(height, 0.5)}rem` };
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
    <div className="flex flex-col border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
      {/* 上部の日付ヘッダー（固定） */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        {/* 時間軸のヘッダー部分（空白） */}
        <div className="w-16 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0"></div>
        {/* 日付ヘッダー（横スクロール可能） */}
        <div className="flex-1 flex overflow-x-auto">
          {dates.map((date, dateIndex) => {
            const isToday = formatDate(date) === formatDate(new Date());
            return (
              <div
                key={dateIndex}
                className={`flex-1 border-r border-gray-200 dark:border-gray-700 min-w-[200px] h-12 flex flex-col items-center justify-center ${
                  isToday ? 'bg-blue-100 dark:bg-blue-900/30 font-bold' : 'bg-gray-50 dark:bg-gray-900'
                }`}
              >
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {formatDate(date, 'E')}
                </div>
                <div className={`text-lg ${isToday ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-gray-100'}`}>
                  {formatDate(date, 'd')}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 下部のスクロール可能エリア（時間軸とスケジュール部分） */}
      <div className="flex flex-1 overflow-hidden">
        {/* 時間軸 */}
        <div className="w-16 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex-shrink-0 overflow-y-auto">
          <div className="relative" style={{ height: '48rem' }}>
            {hours.map((hour) => (
              <div 
                key={hour} 
                className="absolute border-b border-gray-200 dark:border-gray-700 flex items-start justify-end pr-2"
                style={{ 
                  top: `${hour * 4}rem`, 
                  height: '4rem',
                  width: '100%'
                }}
              >
                <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">{hour}:00</span>
              </div>
            ))}
          </div>
        </div>

        {/* 日付列（横スクロール可能、縦スクロール可能） */}
        <div className="flex-1 flex overflow-x-auto overflow-y-auto">
          {dates.map((date, dateIndex) => {
            const daySchedules = getSchedulesForDate(date);
            const dayEvents = getEventsForDate(date);
            const isToday = formatDate(date) === formatDate(new Date());

            return (
              <div
                key={dateIndex}
                className={`flex-1 border-r border-gray-200 dark:border-gray-700 min-w-[200px] ${
                  isToday ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-gray-800'
                }`}
              >

              {/* 時間軸エリア */}
              <div className="relative" style={{ height: '48rem' }}>
                {/* 時間帯の背景 */}
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="absolute w-full border-b border-gray-100 dark:border-gray-700"
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

                {/* 時間ブロック（ドラッグ可能） */}
                {hours.map((hour) => {
                  // 15分単位のブロック（1時間 = 4ブロック）
                  return Array.from({ length: 4 }, (_, blockIndex) => {
                    const blockMinutes = hour * 60 + blockIndex * 15;
                    const blockTop = (blockMinutes / 60) * 4; // rem単位
                    const blockHeight = 1; // 15分 = 1rem
                    
                    return (
                      <div
                        key={`${hour}-${blockIndex}`}
                        className="absolute w-full opacity-0 hover:opacity-100 transition-opacity border-dashed border border-gray-300 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 rounded cursor-pointer"
                        style={{
                          top: `${blockTop}rem`,
                          height: `${blockHeight}rem`,
                        }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          
                          // ドラッグ開始
                          const timeAxisArea = e.currentTarget.parentElement as HTMLElement;
                          if (!timeAxisArea) return;
                          
                          const rect = timeAxisArea.getBoundingClientRect();
                          const startY = e.clientY - rect.top + timeAxisArea.scrollTop;
                          const startMinutes = blockMinutes;
                          let currentMinutes = startMinutes;
                          
                          // ハイライト要素を作成
                          const highlightEl = document.createElement('div');
                          highlightEl.id = `time-block-highlight-${dateIndex}-${hour}-${blockIndex}`;
                          highlightEl.className = 'absolute left-0 right-0 bg-blue-200 dark:bg-blue-800/50 border-2 border-blue-400 dark:border-blue-500 rounded z-20';
                          highlightEl.style.top = `${blockTop}rem`;
                          highlightEl.style.height = `${blockHeight}rem`;
                          timeAxisArea.appendChild(highlightEl);
                          
                          const handleMouseMove = (moveEvent: MouseEvent) => {
                            const currentRect = timeAxisArea.getBoundingClientRect();
                            const currentY = moveEvent.clientY - currentRect.top + timeAxisArea.scrollTop;
                            const deltaY = currentY - startY;
                            
                            // 1rem = 16px（デフォルト）、4rem = 1時間 = 64px
                            // 1時間 = 60分、1rem = 15分
                            const deltaMinutes = Math.round((deltaY / 16) * 15); // 16px = 1rem = 15分
                            currentMinutes = Math.max(0, Math.min(1439, startMinutes + deltaMinutes)); // 0-23:59の範囲
                            
                            // 15分単位に丸める
                            currentMinutes = Math.round(currentMinutes / 15) * 15;
                            
                            // 視覚的フィードバック（ハイライト）
                            const actualStartMinutes = Math.min(startMinutes, currentMinutes);
                            const actualEndMinutes = Math.max(startMinutes, currentMinutes);
                            const duration = actualEndMinutes - actualStartMinutes;
                            
                            highlightEl.style.top = `${(actualStartMinutes / 60) * 4}rem`;
                            highlightEl.style.height = `${Math.max(0.25, (duration / 60) * 4)}rem`;
                          };
                          
                          const handleMouseUp = () => {
                            document.removeEventListener('mousemove', handleMouseMove);
                            document.removeEventListener('mouseup', handleMouseUp);
                            
                            // ドラッグ終了時にスケジュール作成
                            // 開始時間と終了時間を正しく計算（終了時間は開始時間より後である必要がある）
                            const actualStartMinutes = Math.min(startMinutes, currentMinutes);
                            const actualEndMinutes = Math.max(startMinutes, currentMinutes);
                            
                            // 最低15分の時間を確保
                            const finalEndMinutes = Math.max(actualEndMinutes, actualStartMinutes + 15);
                            
                            // 15分単位に丸める
                            const roundedStartMinutes = Math.round(actualStartMinutes / 15) * 15;
                            const roundedEndMinutes = Math.round(finalEndMinutes / 15) * 15;
                            
                            const startTime = minutesToTime(roundedStartMinutes);
                            const endTime = minutesToTime(roundedEndMinutes);
                            
                            // ハイライトを削除
                            if (highlightEl.parentElement) {
                              highlightEl.remove();
                            }
                            
                            // スケジュール作成（日時と時間を渡す）
                            onCreateSchedule(date, startTime, endTime);
                          };
                          
                          document.addEventListener('mousemove', handleMouseMove);
                          document.addEventListener('mouseup', handleMouseUp);
                        }}
                        title="ドラッグしてスケジュールを追加"
                      >
                        <span className="text-xs text-gray-400 dark:text-gray-500">+</span>
                      </div>
                    );
                  });
                })}
              </div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
};

