import React, { useRef, useEffect, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Schedule as ScheduleType } from '../../types';
import { api } from '../../utils/api';

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
  onScheduleUpdate: () => void;
}

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
  onScheduleUpdate,
}) => {
  const calendarRef = useRef<FullCalendar>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // デバッグ: スケジュール数を確認
  useEffect(() => {
    console.log('DraggableCalendarView: schedules count =', schedules.length);
    console.log('DraggableCalendarView: events count =', events.length);
  }, [schedules, events]);

  // 色のコントラストを計算して適切なテキスト色を返す
  const getTextColor = (backgroundColor: string): string => {
    // #RRGGBB形式の色からRGB値を抽出
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // 相対輝度を計算（WCAG基準）
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // 輝度が0.5以上なら黒文字、それ以下なら白文字
    return luminance > 0.5 ? '#000000' : '#ffffff';
  };

  // FullCalendar用のイベントデータに変換
  const calendarEvents = React.useMemo(() => {
    console.log('Converting schedules to calendar events...');
    console.log('Sample schedule:', schedules[0]);
    
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

          const color = calendarViewMode === 'all'
            ? schedule.user?.avatarColor || '#6B7280'
            : (schedule as any).customColor || schedule.project?.themeColor || schedule.user?.avatarColor || '#6B7280';

          // テキスト色を自動調整
          const textColor = getTextColor(color);

          // 複数日スケジュールの場合
          const isMultiDay = startDate !== endDate;
          
          // FullCalendar に渡す時刻を作成
          // timeZone: 'Asia/Tokyo' を設定しているため、タイムゾーン情報なしで渡す
          // FullCalendarが自動的にJSTとして解釈する
          const startDateTime = `${startDate}T${schedule.startTime}:00`;
          const endDateTime = isMultiDay 
            ? `${endDate}T${schedule.endTime}:00`
            : `${startDate}T${schedule.endTime}:00`;

          // 他人のスケジュールは編集不可
          const isEditable = !currentUserId || schedule.userId === currentUserId;

          const event = {
            id: schedule.id,
            title: (schedule as any).title || schedule.activityDescription || '(タイトルなし)',
            start: startDateTime,
            end: endDateTime,
            backgroundColor: color,
            borderColor: color,
            textColor: textColor,
            allDay: false,
            editable: isEditable,
            extendedProps: {
              type: 'schedule',
              schedule,
            },
          };

          console.log('Converted schedule:', { 
            id: schedule.id, 
            start: event.start, 
            end: event.end, 
            title: event.title,
            originalStartTime: schedule.startTime,
            originalEndTime: schedule.endTime,
            editable: isEditable,
          });
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
            start: event.startTime ? `${dateStr}T${event.startTime}:00` : dateStr,
            end: event.endTime ? `${dateStr}T${event.endTime}:00` : undefined,
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

    console.log('Total calendar events:', result.length);
    console.log('Sample calendar event:', result[0]);
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

  // イベントドロップ（移動）処理
  const handleEventDrop = async (info: any) => {
    if (isUpdating) {
      info.revert();
      return;
    }

    const { event, delta } = info;
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
          // 既存のフィールドを保持
          title: (schedule as any).title || schedule.activityDescription,
          activityDescription: schedule.activityDescription,
          locationText: schedule.locationText || '',
        };

        // 複数日スケジュールの場合
        if (daysDiff > 0) {
          updateData.endDate = newEndDateStr;
        }

        console.log('月表示での移動:', {
          scheduleId: schedule.id,
          oldDate: schedule.date,
          newDate: newDateStr,
          oldStartTime,
          oldEndTime,
          daysDiff,
          updateData,
        });
      } else {
        // 週/日表示の場合: ブロックごと移動（開始・終了の両方が移動）
        // 元の所要時間を計算
        const oldStartMinutes = parseInt(schedule.startTime.split(':')[0]) * 60 + parseInt(schedule.startTime.split(':')[1]);
        const oldEndMinutes = parseInt(schedule.endTime.split(':')[0]) * 60 + parseInt(schedule.endTime.split(':')[1]);
        const duration = oldEndMinutes - oldStartMinutes;

        console.log('=== ドラッグ&ドロップ デバッグ ===');
        console.log('newStart (raw):', newStart);
        console.log('newStart.toString():', newStart.toString());
        console.log('newStart.toISOString():', newStart.toISOString());
        console.log('newStart.getTimezoneOffset():', newStart.getTimezoneOffset());
        
        // JST の時刻を取得
        const newStartTime = getJSTTimeString(newStart);
        
        console.log('計算された newStartTime:', newStartTime);
        console.log('元の schedule.startTime:', schedule.startTime);
        
        // 新しい終了時刻 = 新しい開始時刻 + 元の所要時間
        // newStartTime から分数を計算（JST基準）
        const [startHours, startMinutes] = newStartTime.split(':').map(Number);
        const newStartMinutes = startHours * 60 + startMinutes;
        const newEndMinutes = newStartMinutes + duration;
        const newEndHours = Math.floor(newEndMinutes / 60);
        const newEndMins = newEndMinutes % 60;
        const newEndTime = `${String(newEndHours).padStart(2, '0')}:${String(newEndMins).padStart(2, '0')}`;
        
        console.log('計算された newEndTime:', newEndTime);
        console.log('元の schedule.endTime:', schedule.endTime);
        console.log('所要時間 (duration):', duration, '分');
        console.log('===================================');

        // 日付を JST で取得
        const newDateStr = getJSTDateString(newStart);

        updateData = {
          date: newDateStr,
          startTime: newStartTime,
          endTime: newEndTime,
          // 既存のフィールドを保持
          title: (schedule as any).title || schedule.activityDescription,
          activityDescription: schedule.activityDescription,
          locationText: schedule.locationText || '',
        };

        // 複数日スケジュールの場合
        if (newStart.toDateString() !== newEnd.toDateString()) {
          const newEndDateStr = getJSTDateString(newEnd);
          updateData.endDate = newEndDateStr;
        }

        console.log('週/日表示でのブロック移動:', {
          scheduleId: schedule.id,
          oldDate: schedule.date,
          newDate: newDateStr,
          oldStartTime: schedule.startTime,
          newStartTime,
          oldEndTime: schedule.endTime,
          newEndTime,
          duration: `${duration}分`,
          updateData,
        });
      }

      console.log('Updating schedule:', { id: schedule.id, updateData });

      const response = await api.put(`/api/schedules/${schedule.id}`, updateData);
      console.log('Update response:', response.data);
      
      // 成功したら親コンポーネントに通知
      onScheduleUpdate();
    } catch (error: any) {
      console.error('Failed to update schedule:', error);
      console.error('Error response:', error.response?.data);
      alert(`スケジュールの更新に失敗しました: ${error.response?.data?.error || error.message}`);
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
        console.log('=== リサイズ（開始時刻変更）デバッグ ===');
        console.log('newStart (raw):', newStart);
        console.log('newStart.toString():', newStart.toString());
        console.log('newStart.toISOString():', newStart.toISOString());
        
        startTime = getJSTTimeString(newStart);
        endTime = schedule.endTime; // 元の終了時刻を保持
        
        console.log('計算された startTime:', startTime);
        console.log('元の schedule.startTime:', schedule.startTime);
        console.log('保持される endTime:', endTime);
        console.log('===================================');
        
        console.log('開始時刻のみリサイズ:', {
          scheduleId: schedule.id,
          oldStartTime: schedule.startTime,
          newStartTime: startTime,
          endTime: endTime,
          delta: `${startDelta.milliseconds / 1000 / 60}分`,
        });
      } else if (isEndResize) {
        // 終了時刻のみ変更（開始時刻は固定）
        console.log('=== リサイズ（終了時刻変更）デバッグ ===');
        console.log('newEnd (raw):', newEnd);
        console.log('newEnd.toString():', newEnd.toString());
        console.log('newEnd.toISOString():', newEnd.toISOString());
        
        startTime = schedule.startTime; // 元の開始時刻を保持
        endTime = getJSTTimeString(newEnd);
        
        console.log('保持される startTime:', startTime);
        console.log('計算された endTime:', endTime);
        console.log('元の schedule.endTime:', schedule.endTime);
        console.log('===================================');
        
        console.log('終了時刻のみリサイズ:', {
          scheduleId: schedule.id,
          startTime: startTime,
          oldEndTime: schedule.endTime,
          newEndTime: endTime,
          delta: `${endDelta.milliseconds / 1000 / 60}分`,
        });
      } else {
        // どちらも変更されていない場合（念のため）
        startTime = getJSTTimeString(newStart);
        endTime = getJSTTimeString(newEnd);
      }

      // 日付も JST で取得
      const year = newStart.getFullYear();
      const month = String(newStart.getMonth() + 1).padStart(2, '0');
      const day = String(newStart.getDate()).padStart(2, '0');
      const newDateStr = `${year}-${month}-${day}`;

      const updateData: any = {
        date: getJSTDateString(newStart),
        startTime,
        endTime,
        // 既存のフィールドを保持
        title: (schedule as any).title || schedule.activityDescription,
        activityDescription: schedule.activityDescription,
        locationText: schedule.locationText || '',
      };

      // 複数日スケジュールの場合
      if (newStart.toDateString() !== newEnd.toDateString()) {
        updateData.endDate = getJSTDateString(newEnd);
      }

      console.log('Resizing schedule:', { 
        scheduleId: schedule.id, 
        isStartResize,
        isEndResize,
        updateData 
      });

      const response = await api.put(`/api/schedules/${schedule.id}`, updateData);
      console.log('Resize response:', response.data);
      
      // 成功したら親コンポーネントに通知
      onScheduleUpdate();
    } catch (error: any) {
      console.error('Failed to resize schedule:', error);
      console.error('Error response:', error.response?.data);
      alert(`スケジュールのリサイズに失敗しました: ${error.response?.data?.error || error.message}`);
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
      
      console.log('=== 日付クリック（週/日表示）デバッグ ===');
      console.log('clickedDate (raw):', clickedDate);
      console.log('clickedDate.toString():', clickedDate.toString());
      console.log('clickedDate.toISOString():', clickedDate.toISOString());
      console.log('clickedDate.getHours():', clickedDate.getHours());
      console.log('clickedDate.getMinutes():', clickedDate.getMinutes());
      console.log('clickedDate.getTimezoneOffset():', clickedDate.getTimezoneOffset());
      
      const startTime = getJSTTimeString(clickedDate);
      const endDate = new Date(clickedDate);
      endDate.setHours(clickedDate.getHours() + 1);
      const endTime = getJSTTimeString(endDate);
      
      console.log('計算された startTime:', startTime);
      console.log('計算された endTime:', endTime);
      console.log('===================================');
      
      onCreateSchedule(clickedDate, startTime, endTime);
    } else {
      // 月表示の場合は日付のみで作成
      console.log('=== 日付クリック（月表示）デバッグ ===');
      console.log('clickedDate:', info.date);
      console.log('===================================');
      onCreateSchedule(info.date);
    }
  };

  return (
    <div className="fullcalendar-wrapper">
      {calendarEvents.length === 0 && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg mb-4">
          <p className="text-yellow-800 dark:text-yellow-200">
            ⚠️ カレンダーイベントが0件です。ブラウザのコンソールを確認してください。
          </p>
          <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-2">
            スケジュール数: {schedules.length} / イベント数: {events.length}
          </p>
        </div>
      )}
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
        slotDuration="00:15:00"
        snapDuration="00:15:00"
        allDaySlot={true}
        events={calendarEvents}
        editable={true}
        droppable={true}
        eventResizableFromStart={true}
        eventDurationEditable={true}
        eventDrop={handleEventDrop}
        eventResize={handleEventResize}
        eventClick={handleEventClick}
        dateClick={handleDateClick}
        height="auto"
        dayMaxEvents={3}
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
        firstDay={0}
        weekends={true}
        nowIndicator={true}
        eventDisplay="block"
        displayEventTime={true}
        displayEventEnd={false}
      />
    </div>
  );
};
