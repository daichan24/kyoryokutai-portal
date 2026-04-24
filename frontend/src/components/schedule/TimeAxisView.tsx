import React, { useRef, useEffect, useState } from 'react';
import { Schedule as ScheduleType, User } from '../../types';
import { formatDate, isSameDay, formatTime } from '../../utils/date';
import { CalendarDays, RefreshCw } from 'lucide-react';

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
  calendarViewMode?: 'individual' | 'all';
  currentUserId?: string;
  members?: User[];
}

const timeToMinutes = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const minutesToTime = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
};

const calcPos = (startTime: string, endTime: string) => {
  const s = timeToMinutes(startTime);
  const e = timeToMinutes(endTime);
  return { top: `${(s / 60) * 4}rem`, height: `${Math.max((e - s) / 60 * 4, 0.5)}rem` };
};

const getNowMinutes = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };

export const TimeAxisView: React.FC<TimeAxisViewProps> = ({
  dates, schedules, events, onScheduleClick, onEventClick, onCreateSchedule,
  viewMode, calendarViewMode = 'individual', currentUserId, members = [],
}) => {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [nowMin, setNowMin] = useState(getNowMinutes());
  const isToday = (d: Date) => formatDate(d) === formatDate(new Date());

  useEffect(() => {
    const t = setInterval(() => setNowMin(getNowMinutes()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = Math.max(0, Math.floor(nowMin / 60) - 1) * 4 * 16;
  }, [dates]);

  const getSchedulesForDate = (date: Date) =>
    schedules.filter((s) => {
      const sd = new Date((s as any).startDate || s.date);
      const ed = new Date((s as any).endDate || s.date);
      const d = new Date(date);
      sd.setHours(0,0,0,0); ed.setHours(0,0,0,0); d.setHours(0,0,0,0);
      return d >= sd && d <= ed;
    });

  const getEventsForDate = (d: Date) => events.filter((e) => isSameDay(new Date(e.date), d));

  const getColor = (s: ScheduleType) =>
    calendarViewMode === 'all'
      ? s.user?.avatarColor || '#6B7280'
      : (s as any).customColor || s.project?.themeColor || s.user?.avatarColor || '#6B7280';

  const isDayView = viewMode === 'day';
  const dayDate = isDayView ? dates[0] : null;
  const memberCount = Math.max(members.length, 1);
  const gridTemplate = isDayView
    ? `minmax(2rem, 3.5rem) repeat(${memberCount}, minmax(0, 1fr))`
    : 'minmax(2rem, 3.5rem) repeat(7, minmax(0, 1fr))';

  const multiDaySchedules = !isDayView ? schedules.filter((s) => {
    const sd = new Date((s as any).startDate || s.date);
    const ed = new Date((s as any).endDate || s.date);
    sd.setHours(0,0,0,0); ed.setHours(0,0,0,0);
    return sd.getTime() !== ed.getTime();
  }) : [];

  const showNowLine = dates.some(d => isToday(d));
  const nowTop = `${(nowMin / 60) * 4}rem`;

  const renderDayCol = (date: Date, colIdx: number, memberId?: string) => {
    const singleDay = memberId
      ? getSchedulesForDate(date).filter(s => s.userId === memberId)
      : getSchedulesForDate(date).filter((s) => {
          const sd = new Date((s as any).startDate || s.date);
          const ed = new Date((s as any).endDate || s.date);
          sd.setHours(0,0,0,0); ed.setHours(0,0,0,0);
          return sd.getTime() === ed.getTime();
        });
    const dayEvents = getEventsForDate(date);
    const todayCol = isToday(date);

    return (
      <div key={colIdx}
        className={`min-w-0 border-r border-gray-200 dark:border-gray-700 last:border-r-0 ${todayCol ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-gray-800'}`}>
        <div className="relative" style={{ height: '96rem' }}>
          {hours.map(h => (
            <div key={h} className="absolute w-full border-b border-gray-100 dark:border-gray-700" style={{ top: `${h * 4}rem`, height: '4rem' }} />
          ))}
          {hours.map(h => (
            <div key={`hh-${h}`} className="absolute w-full border-b border-gray-50 dark:border-gray-800/50" style={{ top: `${h * 4 + 2}rem` }} />
          ))}
          {todayCol && showNowLine && (
            <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: nowTop }}>
              <div className="flex items-center">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0 -ml-1.5" />
                <div className="flex-1 h-0.5 bg-red-500" />
              </div>
            </div>
          )}
          {singleDay.map((s) => {
            const pos = calcPos(s.startTime, s.endTime);
            const color = getColor(s);
            const isRecurring = (s as any).createdBy === 'RECURRENCE';
            const pCount = s.scheduleParticipants?.filter(p => p.status === 'APPROVED').length || 0;
            return (
              <button key={s.id} onClick={() => onScheduleClick(s)}
                className="absolute left-0.5 right-0.5 rounded text-xs p-1 text-white hover:opacity-90 transition-opacity z-10 overflow-hidden"
                style={{ top: pos.top, height: pos.height, backgroundColor: color, minHeight: '1.5rem' }}
                title={`${(s as any).title || s.activityDescription} (${formatTime(s.startTime)}-${formatTime(s.endTime)})`}>
                <div className="flex items-start justify-between h-full">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate text-white leading-tight text-[11px]">{(s as any).title || s.activityDescription}</p>
                    <p className="text-[10px] text-white/80 truncate">{formatTime(s.startTime)}-{formatTime(s.endTime)}</p>
                    {calendarViewMode === 'all' && s.user && <p className="text-[10px] text-white/70 truncate">{s.user.name}</p>}
                  </div>
                  <div className="flex items-center gap-0.5 flex-shrink-0 ml-0.5">
                    {pCount > 0 && <span className="text-[10px] bg-white/20 px-0.5 rounded">+{pCount}</span>}
                    {isRecurring && <span title="繰り返し"><RefreshCw className="h-2.5 w-2.5 text-white/80" /></span>}
                  </div>
                </div>
              </button>
            );
          })}
          {!isDayView && dayEvents.map((ev) => {
            if (!ev.startTime) return null;
            const pos = calcPos(ev.startTime, ev.endTime || ev.startTime);
            const cls = ev.eventType === 'TOWN_OFFICIAL' ? 'bg-blue-500' : ev.eventType === 'TEAM' ? 'bg-green-500' : 'bg-gray-500';
            return (
              <button key={ev.id} onClick={() => onEventClick(ev.id)}
                className={`absolute left-0.5 right-0.5 rounded text-xs p-1 text-white hover:opacity-90 z-10 ${cls} ${ev.isCompleted ? 'opacity-60' : ''}`}
                style={{ top: pos.top, height: pos.height, minHeight: '1.5rem' }}>
                <div className="flex items-center gap-1 h-full">
                  <CalendarDays className="h-3 w-3 flex-shrink-0" />
                  <p className="font-medium truncate">{ev.eventName}</p>
                </div>
              </button>
            );
          })}
          {hours.map(h => Array.from({ length: 4 }, (_, bi) => {
            const bm = h * 60 + bi * 15;
            const bt = (bm / 60) * 4;
            return (
              <div key={`${h}-${bi}`}
                className="absolute w-full opacity-0 hover:opacity-100 transition-opacity border-dashed border border-gray-300 dark:border-gray-600 hover:border-blue-400 rounded cursor-pointer"
                style={{ top: `${bt}rem`, height: '1rem' }}
                onMouseDown={(e) => {
                  e.preventDefault(); e.stopPropagation();
                  const area = e.currentTarget.parentElement as HTMLElement;
                  if (!area) return;
                  const rect = area.getBoundingClientRect();
                  const startY = e.clientY - rect.top + area.scrollTop;
                  let curMin = bm;
                  const hl = document.createElement('div');
                  hl.className = 'absolute left-0 right-0 bg-blue-200 dark:bg-blue-800/50 border-2 border-blue-400 rounded z-20';
                  hl.style.top = `${bt}rem`; hl.style.height = '1rem';
                  area.appendChild(hl);
                  const onMove = (mv: MouseEvent) => {
                    const dy = mv.clientY - rect.top + area.scrollTop - startY;
                    curMin = Math.round(Math.max(0, Math.min(1439, bm + (dy / 16) * 15)) / 15) * 15;
                    const s2 = Math.min(bm, curMin); const dur = Math.abs(curMin - bm);
                    hl.style.top = `${(s2 / 60) * 4}rem`; hl.style.height = `${Math.max(0.25, (dur / 60) * 4)}rem`;
                  };
                  const onUp = () => {
                    document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp);
                    hl.remove();
                    const s2 = Math.min(bm, curMin); const e2 = Math.max(bm, curMin);
                    onCreateSchedule(date, minutesToTime(Math.round(s2 / 15) * 15), minutesToTime(Math.max(Math.round(e2 / 15) * 15, s2 + 15)));
                  };
                  document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp);
                }} />
            );
          }))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800 w-full min-w-0">
      <div className="grid w-full min-w-0 border-b border-gray-200 dark:border-gray-700 flex-shrink-0" style={{ gridTemplateColumns: gridTemplate }}>
        <div className="border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 min-w-0" />
        {isDayView ? members.map((m, i) => (
          <div key={i} className="min-w-0 border-r border-gray-200 dark:border-gray-700 last:border-r-0 h-12 flex flex-col items-center justify-center px-1 bg-gray-50 dark:bg-gray-900">
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-medium mb-0.5" style={{ backgroundColor: m.avatarColor }}>
              {(m.avatarLetter || m.name || '').charAt(0)}
            </div>
            <p className="text-[10px] text-gray-700 dark:text-gray-300 truncate max-w-full text-center">{m.name}</p>
          </div>
        )) : dates.map((d, i) => {
          const todayH = isToday(d);
          return (
            <div key={i} className={`min-w-0 border-r border-gray-200 dark:border-gray-700 last:border-r-0 h-11 sm:h-12 flex flex-col items-center justify-center px-0.5 ${todayH ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-50 dark:bg-gray-900'}`}>
              <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 leading-none truncate text-center">{formatDate(d, 'E')}</div>
              <div className={`text-sm sm:text-lg leading-tight mt-0.5 ${todayH ? 'text-blue-700 dark:text-blue-300 font-bold' : 'text-gray-900 dark:text-gray-100'}`}>{formatDate(d, 'd')}</div>
            </div>
          );
        })}
      </div>
      {/* 複数日バナー（週表示のみ） - Googleカレンダー方式で横断バー表示 */}
      {!isDayView && multiDaySchedules.length > 0 && (() => {
        const weekStart = new Date(dates[0]); weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(dates[dates.length - 1]); weekEnd.setHours(0, 0, 0, 0);
        const totalCols = dates.length;

        type BannerRow = { scheduleId: string; startCol: number; endCol: number };
        const rows: BannerRow[][] = [];

        const banners = multiDaySchedules.map((s) => {
          const sd = new Date((s as any).startDate || s.date); sd.setHours(0, 0, 0, 0);
          const ed = new Date((s as any).endDate || s.date); ed.setHours(0, 0, 0, 0);
          const clampedStart = sd < weekStart ? weekStart : sd;
          const clampedEnd = ed > weekEnd ? weekEnd : ed;
          const startCol = dates.findIndex((d) => { const dd = new Date(d); dd.setHours(0,0,0,0); return dd.getTime() === clampedStart.getTime(); });
          const endCol = dates.findIndex((d) => { const dd = new Date(d); dd.setHours(0,0,0,0); return dd.getTime() === clampedEnd.getTime(); });
          const sc = startCol < 0 ? 0 : startCol;
          const ec = endCol < 0 ? totalCols - 1 : endCol;
          const startsInWeek = sd.getTime() >= weekStart.getTime();
          const endsInWeek = ed.getTime() <= weekEnd.getTime();

          let rowIdx = 0;
          while (true) {
            if (!rows[rowIdx]) { rows[rowIdx] = []; }
            const conflict = rows[rowIdx].some((b) => !(ec < b.startCol || sc > b.endCol));
            if (!conflict) { rows[rowIdx].push({ scheduleId: s.id, startCol: sc, endCol: ec }); break; }
            rowIdx++;
          }

          return { s, sc, ec, rowIdx, startsInWeek, endsInWeek };
        });

        const rowCount = rows.length;
        const ROW_H = 22;
        const bannerAreaHeight = rowCount * ROW_H + 4;

        return (
          <div className="border-b border-gray-200 dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800 flex"
            style={{ minHeight: `${bannerAreaHeight}px` }}>
            <div className="border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-start justify-end pr-1 pt-1 flex-shrink-0"
              style={{ minWidth: '2rem', maxWidth: '3.5rem' }}>
              <span className="text-[8px] text-gray-400">終日</span>
            </div>
            <div className="relative flex-1 min-w-0">
              <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${totalCols}, minmax(0, 1fr))` }}>
                {dates.map((_, di) => (
                  <div key={di} className="border-r border-gray-200 dark:border-gray-700 last:border-r-0 h-full" />
                ))}
              </div>
              {banners.map(({ s, sc, ec, rowIdx, startsInWeek, endsInWeek }) => {
                const color = calendarViewMode === 'all'
                  ? s.user?.avatarColor || '#6B7280'
                  : (s as any).customColor || s.project?.themeColor || s.user?.avatarColor || '#6B7280';
                const textColor = getTextColor(color);
                const isRecurring = (s as any).createdBy === 'RECURRENCE';
                const leftPct = (sc / totalCols) * 100;
                const widthPct = ((ec - sc + 1) / totalCols) * 100;
                const top = rowIdx * ROW_H + 2;
                return (
                  <button
                    key={s.id}
                    onClick={() => onScheduleClick(s)}
                    className="absolute flex items-center text-xs px-1.5 hover:opacity-90 transition-opacity overflow-hidden z-10"
                    style={{
                      left: `calc(${leftPct}% + ${startsInWeek ? 2 : 0}px)`,
                      width: `calc(${widthPct}% - ${(startsInWeek ? 2 : 0) + (endsInWeek ? 2 : 0)}px)`,
                      top: `${top}px`,
                      height: `${ROW_H - 2}px`,
                      backgroundColor: color,
                      color: textColor,
                      borderRadius: startsInWeek && endsInWeek ? '4px' : startsInWeek ? '4px 0 0 4px' : endsInWeek ? '0 4px 4px 0' : '0',
                    }}
                    title={`${(s as any).title || s.activityDescription}`}>
                    <span className="truncate flex-1 font-medium" style={{ fontSize: '11px' }}>
                      {startsInWeek ? ((s as any).title || s.activityDescription) : ''}
                    </span>
                    {isRecurring && endsInWeek && (
                      <RefreshCw className="h-2.5 w-2.5 opacity-80 flex-shrink-0 ml-0.5" style={{ color: textColor }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div ref={scrollRef} className="w-full min-w-0 overflow-y-auto overflow-x-hidden" style={{ maxHeight: '60vh' }}>
        <div className="grid w-full min-w-0" style={{ gridTemplateColumns: gridTemplate }}>
          <div className="border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 min-w-0">
            <div className="relative" style={{ height: '96rem' }}>
              {hours.map(h => (
                <div key={h} className="absolute border-b border-gray-200 dark:border-gray-700 flex items-start justify-end pr-0.5 sm:pr-2"
                  style={{ top: `${h * 4}rem`, height: '4rem', width: '100%' }}>
                  <span className="text-[8px] sm:text-xs text-gray-600 dark:text-gray-400 font-medium tabular-nums whitespace-nowrap">{h}:00</span>
                </div>
              ))}
            </div>
          </div>
          {isDayView
            ? members.map((m, i) => renderDayCol(dayDate!, i, m.id))
            : dates.map((d, i) => renderDayCol(d, i))
          }
        </div>
      </div>
    </div>
  );
};
