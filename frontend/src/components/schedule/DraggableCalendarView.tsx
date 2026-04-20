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

  // FullCalendar用のイベントデータに変換
  const calendarEvents = React.useMemo(() => {
    console.log('Converting schedules to calendar events...');
    console.log('Sample schedule:', schedules[0]);
    
    const result = [
      // スケジュール
      ...schedules.map((schedule) => {
        try {
          // 日付を文字列形式に変換（YYYY-MM-DD）
          const startDate = schedule.startDate 
            ? (typeof schedule.startDate === 'string' ? schedule.startDate.split('T')[0] : new Date(schedule.startDate).toISOString().split('T')[0])
            : (typeof schedule.date === 'string' ? schedule.date.split('T')[0] : new Date(schedule.date).toISOString().split('T')[0]);
          
          const endDate = schedule.endDate 
            ? (typeof schedule.endDate === 'string' ? schedule.endDate.split('T')[0] : new Date(schedule.endDate).toISOString().split('T')[0])
            : startDate;

          const color = calendarViewMode === 'all'
            ? schedule.user?.avatarColor || '#6B7280'
            : (schedule as any).customColor || schedule.project?.themeColor || schedule.user?.avatarColor || '#6B7280';

          // 複数日スケジュールの場合
          const isMultiDay = startDate !== endDate;
          
          // 終了時刻を次の日の開始として扱う（FullCalendarの仕様）
          const endDateTime = isMultiDay 
            ? `${endDate}T${schedule.endTime}`
            : `${startDate}T${schedule.endTime}`;

          const event = {
            id: schedule.id,
            title: (schedule as any).title || schedule.activityDescription || '(タイトルなし)',
            start: `${startDate}T${schedule.startTime}`,
            end: endDateTime,
            backgroundColor: color,
            borderColor: color,
            allDay: false,
            extendedProps: {
              type: 'schedule',
              schedule,
            },
          };

          console.log('Converted schedule:', { id: schedule.id, start: event.start, end: event.end, title: event.title });
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
          const dateStr = typeof event.date === 'string' ? event.date.split('T')[0] : new Date(event.date).toISOString().split('T')[0];
          
          return {
            id: `event-${event.id}`,
            title: event.eventName,
            start: event.startTime ? `${dateStr}T${event.startTime}` : dateStr,
            end: event.endTime ? `${dateStr}T${event.endTime}` : undefined,
            backgroundColor: colorClass,
            borderColor: colorClass,
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
  }, [schedules, events, calendarViewMode]);

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
        
        // 新しい日付を取得（時刻は無視）
        const newDateStr = newStart.toISOString().split('T')[0];
        
        // 元の開始日と終了日の日数差を計算
        oldStartDate.setHours(0, 0, 0, 0);
        oldEndDate.setHours(0, 0, 0, 0);
        const daysDiff = Math.round((oldEndDate.getTime() - oldStartDate.getTime()) / (1000 * 60 * 60 * 24));

        // 新しい終了日を計算
        let newEndDateStr = newDateStr;
        if (daysDiff > 0) {
          const newEndDate = new Date(newStart);
          newEndDate.setDate(newEndDate.getDate() + daysDiff);
          newEndDateStr = newEndDate.toISOString().split('T')[0];
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

        // 新しい開始時刻
        const newStartTime = `${String(newStart.getHours()).padStart(2, '0')}:${String(newStart.getMinutes()).padStart(2, '0')}`;
        
        // 新しい終了時刻 = 新しい開始時刻 + 元の所要時間
        const newStartMinutes = newStart.getHours() * 60 + newStart.getMinutes();
        const newEndMinutes = newStartMinutes + duration;
        const newEndHours = Math.floor(newEndMinutes / 60);
        const newEndMins = newEndMinutes % 60;
        const newEndTime = `${String(newEndHours).padStart(2, '0')}:${String(newEndMins).padStart(2, '0')}`;

        updateData = {
          date: newStart.toISOString().split('T')[0],
          startTime: newStartTime,
          endTime: newEndTime,
          // 既存のフィールドを保持
          title: (schedule as any).title || schedule.activityDescription,
          activityDescription: schedule.activityDescription,
          locationText: schedule.locationText || '',
        };

        // 複数日スケジュールの場合
        if (newStart.toDateString() !== newEnd.toDateString()) {
          updateData.endDate = newEnd.toISOString().split('T')[0];
        }

        console.log('週/日表示でのブロック移動:', {
          scheduleId: schedule.id,
          oldDate: schedule.date,
          newDate: updateData.date,
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
        startTime = `${String(newStart.getHours()).padStart(2, '0')}:${String(newStart.getMinutes()).padStart(2, '0')}`;
        endTime = schedule.endTime; // 元の終了時刻を保持
        
        console.log('開始時刻のみリサイズ:', {
          scheduleId: schedule.id,
          oldStartTime: schedule.startTime,
          newStartTime: startTime,
          endTime: endTime,
          delta: `${startDelta.milliseconds / 1000 / 60}分`,
        });
      } else if (isEndResize) {
        // 終了時刻のみ変更（開始時刻は固定）
        startTime = schedule.startTime; // 元の開始時刻を保持
        endTime = `${String(newEnd.getHours()).padStart(2, '0')}:${String(newEnd.getMinutes()).padStart(2, '0')}`;
        
        console.log('終了時刻のみリサイズ:', {
          scheduleId: schedule.id,
          startTime: startTime,
          oldEndTime: schedule.endTime,
          newEndTime: endTime,
          delta: `${endDelta.milliseconds / 1000 / 60}分`,
        });
      } else {
        // どちらも変更されていない場合（念のため）
        startTime = `${String(newStart.getHours()).padStart(2, '0')}:${String(newStart.getMinutes()).padStart(2, '0')}`;
        endTime = `${String(newEnd.getHours()).padStart(2, '0')}:${String(newEnd.getMinutes()).padStart(2, '0')}`;
      }

      const updateData: any = {
        date: newStart.toISOString().split('T')[0],
        startTime,
        endTime,
        // 既存のフィールドを保持
        title: (schedule as any).title || schedule.activityDescription,
        activityDescription: schedule.activityDescription,
        locationText: schedule.locationText || '',
      };

      // 複数日スケジュールの場合
      if (newStart.toDateString() !== newEnd.toDateString()) {
        updateData.endDate = newEnd.toISOString().split('T')[0];
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
      const startTime = `${String(clickedDate.getHours()).padStart(2, '0')}:${String(clickedDate.getMinutes()).padStart(2, '0')}`;
      const endDate = new Date(clickedDate);
      endDate.setHours(clickedDate.getHours() + 1);
      const endTime = `${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
      onCreateSchedule(clickedDate, startTime, endTime);
    } else {
      // 月表示の場合は日付のみで作成
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
        timeZone="Asia/Tokyo"
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
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }}
        slotLabelFormat={{
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
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
