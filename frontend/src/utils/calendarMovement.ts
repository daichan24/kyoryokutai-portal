import { addDaysToDateOnly } from './dateOnly';
import type { Schedule } from '../types';

export interface ScheduleMove { date: string; startTime: string; endTime: string; endDate?: string }
type MoveEvent = { start: Date; end: Date | null; allDay: boolean; startStr?: string; endStr?: string };
const getJSTDateString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const getJSTTimeString = (date: Date) => `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;

export function getScheduleMove(schedule: Pick<Schedule, 'date' | 'startDate' | 'endDate' | 'startTime' | 'endTime'>, event: MoveEvent, view: string): ScheduleMove {
  if (event.allDay) {
    const date = event.startStr?.slice(0, 10) || getJSTDateString(event.start);
    const originalStart = (schedule.startDate || schedule.date).slice(0, 10);
    const originalEnd = (schedule.endDate || schedule.startDate || schedule.date).slice(0, 10);
    const span = Math.round((Date.parse(originalEnd) - Date.parse(originalStart)) / 86400000);
    const exclusiveEnd = event.endStr?.slice(0, 10) || (event.end ? getJSTDateString(event.end) : null);
    return {
      date,
      endDate: exclusiveEnd ? addDaysToDateOnly(exclusiveEnd, -1) : addDaysToDateOnly(date, span),
      startTime: schedule.startTime,
      endTime: schedule.endTime,
    };
  }
  const oldStartDate = new Date(schedule.startDate || schedule.date);
  const oldEndDate = new Date(schedule.endDate || schedule.date);
  const newStart = event.start;
  const newEnd = event.end || newStart;
  const isMonthView = view === 'dayGridMonth';
  let updateData: ScheduleMove = { date: getJSTDateString(newStart), startTime: schedule.startTime, endTime: schedule.endTime };

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

    if (newEnd && newStart.toDateString() !== newEnd.toDateString()) {
      const newEndDateStr = getJSTDateString(newEnd);
      updateData.endDate = newEndDateStr;
    }

  }

  return updateData;
}
