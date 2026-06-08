import React, { useRef, useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Schedule as ScheduleType } from '../../types';
import { api } from '../../utils/api';
import { isHolidayDate, isSaturday, isSunday } from '../../utils/date';
import { useIsMobileBreakpoint } from '../../hooks/useIsMobileBreakpoint';

interface DraggableCalendarViewProps {
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
  viewMode: 'week' | 'month' | 'day';
  currentDate: Date;
  calendarViewMode?: 'individual' | 'all';
  currentUserId?: string;
  onScheduleClick: (schedule: ScheduleType) => void;
  onEventClick: (eventId: string) => void;
  onCreateSchedule: (date: Date, startTime?: string, endTime?: string) => void;
  onMoreClick?: (date: Date) => void;
  onScheduleUpdate: () => void;
  firstDay?: 0 | 1;
}

const normalizeTimeValue = (value?: string | null, fallback = '00:00') => {
  if (!value) return fallback;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return fallback;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const DraggableCalendarView: React.FC<DraggableCalendarViewProps> = ({
  schedules,
  events,
  viewMode,
  currentDate,
  calendarViewMode = 'individual',
  currentUserId,
  onScheduleClick,
  onEventClick,
  onCreateSchedule,
  onMoreClick,
  onScheduleUpdate,
  firstDay = 0,
}) => {
  const calendarRef = useRef<FullCalendar>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const isMobile = useIsMobileBreakpoint();
  const isMobileMonth = isMobile && viewMode === 'month';

  // 色のコントラストを計算して適切なテキスト色を返す
  const getTextColor = (backgroundColor: string): string => {
    // #RRGGBB形式の色からRGB値を抽出
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // 相対輝度を計算（WCAG 2.1基準）
    const toLinear = (c: number) => {
      const val = c / 255;
      return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    };
    
    const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
    
    // 輝度に基づいて適切なテキスト色を返す
    // 明るい背景: 濃いグレー (#1F2937 - gray-800)
    // 暗い背景: オフホワイト (#F9FAFB - gray-50)
    return luminance > 0.5 ? '#1F2937' : '#F9FAFB';
  };

  // FullCalendar用のイベントデータに変換
  const calendarEvents = React.useMemo(() => {
    const result = [
      // スケジュール
      ...schedules.map((schedule) => {
        try {
          // 日付を文字列形式に変換（YYYY-MM-DD）
          // データベースから返される日付は "2026-04-20T00:00:00.000Z" (UTC) の形式
          // これを JST として解釈すると9時間ずれるため、文字列から直接日付部分を抽出する
          let startDate: string;
          if (schedule.startDate) {
            if (typeof schedule.startDate === 'string') {
              // "2026-04-20T00:00:00.000Z" → "2026-04-20"
              startDate = schedule.startDate.split('T')[0];
            } else {
              // Date オブジェクトの場合は UTC の日付部分を取得
              const d = new Date(schedule.startDate);
              const year = d.getUTCFullYear();
              const month = String(d.getUTCMonth() + 1).padStart(2, '0');
              const day = String(d.getUTCDate()).padStart(2, '0');
              startDate = `${year}-${month}-${day}`;
            }
          } else {
            if (typeof schedule.date === 'string') {
              startDate = schedule.date.split('T')[0];
            } else {
              const d = new Date(schedule.date);
              const year = d.getUTCFullYear();
              const month = String(d.getUTCMonth() + 1).padStart(2, '0');
              const day = String(d.getUTCDate()).padStart(2, '0');
              startDate = `${year}-${month}-${day}`;
            }
          }
          
          let endDate: string;
          if (schedule.endDate) {
            if (typeof schedule.endDate === 'string') {
              endDate = schedule.endDate.split('T')[0];
            } else {
              const d = new Date(schedule.endDate);
              const year = d.getUTCFullYear();
              const month = String(d.getUTCMonth() + 1).padStart(2, '0');
              const day = String(d.getUTCDate()).padStart(2, '0');
              endDate = `${year}-${month}-${day}`;
            }
          } else {
            endDate = startDate;
          }

          const color = schedule.userId === currentUserId
            ? (schedule as any).customColor || schedule.project?.themeColor || schedule.user?.avatarColor || '#6B7280'
            : schedule.user?.avatarColor || '#6B7280';

          // テキスト色を自動調整
          const textColor = getTextColor(color);

          // 複数日スケジュールの場合
          const isMultiDay = startDate !== endDate;
          
          // FullCalendar に渡す時刻を作成
          // timeZone: 'Asia/Tokyo' を設定しているため、タイムゾーン情報なしで渡す
          // FullCalendarが自動的にJSTとして解釈する
          const isAllDay = !!schedule.isAllDay || isMultiDay;
          const scheduleStartTime = normalizeTimeValue(schedule.startTime);
          const scheduleEndTime = normalizeTimeValue(schedule.endTime, '23:59');
          const startDateTime = `${startDate}T${scheduleStartTime}:00`;
          const endDateTime = isMultiDay 
            ? `${endDate}T${scheduleEndTime}:00`
            : `${startDate}T${scheduleEndTime}:00`;

          // 他人のスケジュールは編集不可
          const isEditable = !currentUserId || schedule.userId === currentUserId;

          const event = {
            id: schedule.id,
            title: (schedule as any).title || schedule.activityDescription || '(タイトルなし)',
            start: isAllDay ? startDate : startDateTime,
            // allDay イベントの end は exclusive（終了日の翌日）なので +1日
            end: isAllDay ? (() => {
              const d = new Date(endDate + 'T00:00:00');
              d.setDate(d.getDate() + 1);
              return d.toISOString().slice(0, 10);
            })() : endDateTime,
            backgroundColor: color,
            borderColor: color,
            textColor: textColor,
            allDay: isAllDay,
            editable: isEditable && !isMultiDay,
            extendedProps: {
              type: 'schedule',
              schedule,
            },
          };

          return event;
        } catch (error) {
          console.error('Error converting schedule:', schedule, error);
          return null;
        }
      }).filter(Boolean),
      // イベント
      ...events.map((event) => {
        try {
          const colorClass = event.eventType === 'TOWN_OFFICIAL' ? '#3B82F6' : event.eventType === 'TEAM' ? '#10B981' : '#6B7280';
          const textColor = getTextColor(colorClass);
          
          // 日付を JST で取得（データベースから返される日付は UTC なので、UTC の日付部分を使用）
          let dateStr: string;
          if (typeof event.date === 'string') {
            // "2026-04-20T00:00:00.000Z" → "2026-04-20"
            dateStr = event.date.split('T')[0];
          } else {
            // Date オブジェクトの場合は UTC の日付部分を取得
            const d = new Date(event.date);
            const year = d.getUTCFullYear();
            const month = String(d.getUTCMonth() + 1).padStart(2, '0');
            const day = String(d.getUTCDate()).padStart(2, '0');
            dateStr = `${year}-${month}-${day}`;
          }
          
          return {
            id: `event-${event.id}`,
            title: event.eventName,
            start: event.startTime ? `${dateStr}T${normalizeTimeValue(event.startTime)}:00` : dateStr,
            end: event.endTime ? `${dateStr}T${normalizeTimeValue(event.endTime, '23:59')}:00` : undefined,
            backgroundColor: colorClass,
            borderColor: colorClass,
            textColor: textColor,
            allDay: !event.startTime,
            extendedProps: {
              type: 'event',
              event,
            },
          };
        } catch (error) {
          console.error('Error converting event:', event, error);
          return null;
        }
      }).filter(Boolean),
    ];

    return result;
  }, [schedules, events, calendarViewMode, currentUserId]);

  // ビューモードの変換
  const getCalendarView = () => {
    switch (viewMode) {
      case 'day':
        return 'timeGridDay';
      case 'week':
        return 'timeGridWeek';
      case 'month':
        return 'dayGridMonth';
      default:
        return 'dayGridMonth';
    }
  };

  // 日付変更時にFullCalendarの表示を更新
  useEffect(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.gotoDate(currentDate);
    }
  }, [currentDate]);

  // ビューモード変更時にFullCalendarのビューを更新
  useEffect(() => {
    const calendarApi = calendarRef.current?.getApi();
    if (calendarApi) {
      calendarApi.changeView(getCalendarView());
    }
  }, [viewMode]);

  // FullCalendar から返される Date オブジェクトを JST として扱うヘルパー関数
  // FullCalendar の timeZone: 'Asia/Tokyo' 設定により、Date オブジェクトは
  // ローカルタイムゾーンで返されるが、実際には JST として解釈する必要がある
  const getJSTDateString = (date: Date): string => {
    // Date オブジェクトのローカル時刻を JST として扱う
    // FullCalendar は timeZone: 'Asia/Tokyo' を設定しているため、
    // date.getFullYear() などは既に JST の値を返している
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getJSTTimeString = (date: Date): string => {
    // Date オブジェクトのローカル時刻を JST として扱う
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const formatScheduleUpdateError = (error: any): string => {
    const data = error.response?.data;
    if (!data) return error.message || '不明なエラー';
    if (typeof data === 'string') return data;
    if (data.details) return `${data.error || '入力内容を確認してください'}: ${data.details}`;
    return data.error || data.message || error.message || '不明なエラー';
  };

  const addPreservedScheduleFields = (updateData: any, schedule: ScheduleType) => {
    updateData.title = (schedule as any).title || schedule.activityDescription;
    updateData.activityDescription = schedule.activityDescription;
    const locationText = schedule.locationText?.trim();
    if (locationText) updateData.locationText = locationText;
  };

  // イベントドロップ（移動）処理
  const handleEventDrop = async (info: any) => {
    if (isUpdating) {
      info.revert();
      return;
    }

    const { event } = info;
    const extendedProps = event.extendedProps;

    // イベントタイプの場合は移動不可
    if (extendedProps.type === 'event') {
      info.revert();
      return;
    }

    const schedule: ScheduleType = extendedProps.schedule;
    
    // 他人のスケジュールは編集不可
    if (currentUserId && schedule.userId !== currentUserId) {
      info.revert();
      return;
    }
    const oldStartDate = new Date(schedule.startDate || schedule.date);
    const oldEndDate = new Date(schedule.endDate || schedule.date);
    
    // FullCalendar から取得した新しい開始・終了時刻
    const newStart = event.start;
    const newEnd = event.end || newStart;

    setIsUpdating(true);

    try {
      // 月表示の場合は時刻を保持
      const calendarApi = calendarRef.current?.getApi();
      const currentView = calendarApi?.view.type;
      const isMonthView = currentView === 'dayGridMonth';

      let updateData: any = {};

      if (isMonthView) {
        // 月表示でtimed eventを移動した場合、時刻を保持
        const oldStartTime = schedule.startTime;
        const oldEndTime = schedule.endTime;
        
        // 新しい日付を JST で取得
        const newDateStr = getJSTDateString(newStart);
        
        // 元の開始日と終了日の日数差を計算
        oldStartDate.setHours(0, 0, 0, 0);
        oldEndDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.round((oldEndDate.getTime() - oldStartDate.getTime()) / (1000 * 60 * 60 * 24));

        // 新しい終了日を計算
        let newEndDateStr = newDateStr;
        if (daysDiff > 0) {
          const newEndDate = new Date(newStart);
          newEndDate.setDate(newEndDate.getDate() + daysDiff);
          newEndDateStr = getJSTDateString(newEndDate);
        }

        updateData = {
          date: newDateStr,
          startTime: oldStartTime,
          endTime: oldEndTime,
        };
        addPreservedScheduleFields(updateData, schedule);

        // 複数日スケジュールの場合
        if (daysDiff > 0) {
          updateData.endDate = newEndDateStr;
        }

      } else {
        // 週/日表示の場合: ブロックごと移動（開始・終了の両方が移動）
        // 元の所要時間を計算
        const oldStartMinutes = parseInt(schedule.startTime.split(':')[0]) * 60 + parseInt(schedule.startTime.split(':')[1]);
        const oldEndMinutes = parseInt(schedule.endTime.split(':')[0]) * 60 + parseInt(schedule.endTime.split(':')[1]);
        const duration = oldEndMinutes - oldStartMinutes;

        // JST の時刻を取得
        const newStartTime = getJSTTimeString(newStart);

        const newEndTime = newEnd ? getJSTTimeString(newEnd) : (() => {
          const [startHours, startMinutes] = newStartTime.split(':').map(Number);
          const newStartMinutes = startHours * 60 + startMinutes;
          const newEndMinutes = newStartMinutes + duration;
          const newEndHours = Math.floor(newEndMinutes / 60) % 24;
          const newEndMins = newEndMinutes % 60;
          return `${String(newEndHours).padStart(2, '0')}:${String(newEndMins).padStart(2, '0')}`;
        })();
        
        // 日付を JST で取得
        const newDateStr = getJSTDateString(newStart);

        updateData = {
          date: newDateStr,
          startTime: newStartTime,
          endTime: newEndTime,
        };
        addPreservedScheduleFields(updateData, schedule);

        if (newEnd && newStart.toDateString() !== newEnd.toDateString()) {
          const newEndDateStr = getJSTDateString(newEnd);
          updateData.endDate = newEndDateStr;
        }

      }

      await api.put(`/api/schedules/${schedule.id}`, updateData);
      
      // 成功したら親コンポーネントに通知
      onScheduleUpdate();
    } catch (error: any) {
      console.error('Failed to update schedule:', error);
      console.error('Error response:', error.response?.data);
      alert(`スケジュールの更新に失敗しました: ${formatScheduleUpdateError(error)}`);
      info.revert();
    } finally {
      setIsUpdating(false);
    }
  };

  // イベントリサイズ処理
  const handleEventResize = async (info: any) => {
    if (isUpdating) {
      info.revert();
      return;
    }

    const { event, startDelta, endDelta } = info;
    const extendedProps = event.extendedProps;

    // イベントタイプまたは月表示の場合はリサイズ不可
    if (extendedProps.type === 'event') {
      info.revert();
      return;
    }

    const calendarApi = calendarRef.current?.getApi();
    const currentView = calendarApi?.view.type;
    const isMonthView = currentView === 'dayGridMonth';

    if (isMonthView) {
      info.revert();
      return;
    }

    const schedule: ScheduleType = extendedProps.schedule;
    
    // 他人のスケジュールは編集不可
    if (currentUserId && schedule.userId !== currentUserId) {
      info.revert();
      return;
    }
    const newStart = event.start;
    const newEnd = event.end || newStart;

    setIsUpdating(true);

    try {
      // リサイズの種類を判定
      const isStartResize = startDelta && startDelta.milliseconds !== 0;
      const isEndResize = endDelta && endDelta.milliseconds !== 0;

      let startTime: string;
      let endTime: string;

      if (isStartResize) {
        // 開始時刻のみ変更（終了時刻は固定）
        startTime = getJSTTimeString(newStart);
        endTime = schedule.endTime; // 元の終了時刻を保持
      } else if (isEndResize) {
        // 終了時刻のみ変更（開始時刻は固定）
        startTime = schedule.startTime; // 元の開始時刻を保持
        endTime = getJSTTimeString(newEnd);
      } else {
        // どちらも変更されていない場合（念のため）
        startTime = getJSTTimeString(newStart);
        endTime = getJSTTimeString(newEnd);
      }

      const updateData: any = {
        date: getJSTDateString(newStart),
        startTime,
        endTime,
      };
      addPreservedScheduleFields(updateData, schedule);

      // 複数日スケジュールの場合
      if (newStart.toDateString() !== newEnd.toDateString()) {
        updateData.endDate = getJSTDateString(newEnd);
      }

      await api.put(`/api/schedules/${schedule.id}`, updateData);
      
      // 成功したら親コンポーネントに通知
      onScheduleUpdate();
    } catch (error: any) {
      console.error('Failed to resize schedule:', error);
      console.error('Error response:', error.response?.data);
      alert(`スケジュールのリサイズに失敗しました: ${formatScheduleUpdateError(error)}`);
      info.revert();
    } finally {
      setIsUpdating(false);
    }
  };

  // イベントクリック処理
  const handleEventClick = (info: any) => {
    const extendedProps = info.event.extendedProps;
    if (extendedProps.type === 'schedule') {
      onScheduleClick(extendedProps.schedule);
    } else if (extendedProps.type === 'event') {
      onEventClick(extendedProps.event.id);
    }
  };

  // 日付クリック処理（新規作成）
  const handleDateClick = (info: any) => {
    const calendarApi = calendarRef.current?.getApi();
    const currentView = calendarApi?.view.type;
    const isTimeGridView = currentView?.startsWith('timeGrid');

    if (isTimeGridView) {
      // 週/日表示の場合は時刻付きで作成
      const clickedDate = info.date;

      const startTime = getJSTTimeString(clickedDate);
      const endDate = new Date(clickedDate);
      endDate.setHours(clickedDate.getHours() + 1);
      const endTime = getJSTTimeString(endDate);

      onCreateSchedule(clickedDate, startTime, endTime);
    } else {
      // 月表示の場合は日付のみで作成
      onCreateSchedule(info.date);
    }
  };

  return (
    <div className={`fullcalendar-wrapper ${isMobile ? 'fullcalendar-mobile' : ''}`}>
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={getCalendarView()}
        initialDate={currentDate}
        headerToolbar={false}
        locale="ja"
        timeZone="local"
        slotMinTime="00:00:00"
        slotMaxTime="24:00:00"
        slotDuration="00:30:00"
        slotLabelInterval="01:00:00"
        snapDuration="00:15:00"
        allDaySlot={true}
        events={calendarEvents}
        editable={true}
        droppable={true}
        eventResizableFromStart={false}
        eventDurationEditable={true}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        eventClick={handleEventClick}
        dateClick={handleDateClick}
        height={isMobile ? 'calc(100dvh - 220px)' : 'auto'}
        contentHeight={isMobile ? 'auto' : undefined}
        expandRows={true}
        stickyHeaderDates={!isMobile}
        dayMaxEvents={isMobileMonth ? 3 : isMobile ? 3 : 3}
        dayMaxEventRows={isMobileMonth ? 3 : isMobile ? 3 : 3}
        moreLinkContent={(arg) => `${arg.num} more`}
        moreLinkClick={(arg) => {
          if (isMobileMonth && onMoreClick) {
            onMoreClick(arg.date);
            return false;
          }
          return 'popover';
        }}
        longPressDelay={180}
        selectLongPressDelay={180}
        eventLongPressDelay={250}
        eventTimeFormat={{
          hour: 'numeric',
          minute: '2-digit',
          hour12: false,
        }}
        slotLabelFormat={{
          hour: 'numeric',
          minute: '2-digit',
          hour12: false,
        }}
        dayCellContent={(arg) => {
          // 日付の数字のみを表示（「日」を削除）
          return arg.dayNumberText.replace('日', '');
        }}
        dayCellClassNames={(arg) => {
          if (isHolidayDate(arg.date) || isSunday(arg.date)) return ['cb-calendar-day-holiday'];
          if (isSaturday(arg.date)) return ['cb-calendar-day-saturday'];
          return [];
        }}
        dayHeaderClassNames={(arg) => {
          if (isHolidayDate(arg.date) || isSunday(arg.date)) return ['cb-calendar-day-holiday'];
          if (isSaturday(arg.date)) return ['cb-calendar-day-saturday'];
          return [];
        }}
        firstDay={firstDay}
        weekends={true}
        nowIndicator={true}
        eventDisplay="block"
        displayEventTime={!isMobileMonth}
        displayEventEnd={false}
        eventContent={(arg) => {
          const schedule = arg.event.extendedProps?.schedule as ScheduleType | undefined;
          const isGoogle = !!schedule?.googleCalendarEventLink;
          const needsProject = schedule?.googleCalendarEventLink?.origin === 'GOOGLE' && !schedule.projectId;
          return (
            <div className="min-w-0 overflow-hidden">
              <div className="flex min-w-0 items-center gap-1">
                {isGoogle && (
                  <span className="shrink-0 rounded bg-white/80 px-1 text-[9px] font-bold leading-4 text-gray-700">
                    G
                  </span>
                )}
                <span className="truncate">{arg.event.title}</span>
              </div>
              {needsProject && !isMobileMonth && (
                <div className="truncate text-[10px] opacity-90">プロジェクト未設定</div>
              )}
            </div>
          );
        }}
      />
    </div>
  );
};
