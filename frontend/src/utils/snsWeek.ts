import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

const TZ = 'Asia/Tokyo';

/** バックエンド weekBoundary.ts と同じく「月曜 9:00 JST」を週の始まりとする */
export function getWeekMetaForDate(d: Date): { weekKey: string; weekStart: Date; weekEnd: Date } {
  const dateJST = toZonedTime(d, TZ);
  const dayOfWeek = dateJST.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday9amJST = new Date(dateJST);
  monday9amJST.setDate(dateJST.getDate() + mondayOffset);
  monday9amJST.setHours(9, 0, 0, 0);
  if (dateJST < monday9amJST) {
    monday9amJST.setDate(monday9amJST.getDate() - 7);
  }
  const nextMonday9amJST = new Date(monday9amJST);
  nextMonday9amJST.setDate(monday9amJST.getDate() + 7);
  const weekStart = fromZonedTime(monday9amJST, TZ);
  const weekEnd = fromZonedTime(nextMonday9amJST, TZ);
  const year = monday9amJST.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const daysDiff = Math.floor((monday9amJST.getTime() - startOfYear.getTime()) / 86400000);
  const weekNumber = Math.floor(daysDiff / 7) + 1;
  const weekKey = `${year}-W${String(weekNumber).padStart(2, '0')}`;
  return { weekKey, weekStart, weekEnd };
}

export function getRecentWeekRows(count: number): Array<{
  weekKey: string;
  weekStart: Date;
  weekEnd: Date;
  label: string;
}> {
  const rows: Array<{ weekKey: string; weekStart: Date; weekEnd: Date; label: string }> = [];
  let ref = new Date();
  for (let i = 0; i < count; i++) {
    const m = getWeekMetaForDate(ref);
    const endDay = new Date(m.weekEnd.getTime() - 1);
    rows.push({
      ...m,
      label: `${format(m.weekStart, 'M/d', { locale: ja })}〜${format(endDay, 'M/d', { locale: ja })}`,
    });
    ref = new Date(m.weekStart.getTime() - 1);
  }
  return rows;
}
