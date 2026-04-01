import { addDays } from 'date-fns';
import { format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { ja } from 'date-fns/locale';

const TZ = 'Asia/Tokyo';

/** バックエンド weekBoundary.ts と同一（UTC サーバとブラウザで weekKey が一致） */
function jstWallToUtcDate(y: number, mo: number, d: number, h: number, mi = 0, se = 0): Date {
  return new Date(Date.UTC(y, mo - 1, d, h - 9, mi, se));
}

export function getWeekMetaForDate(d: Date): { weekKey: string; weekStart: Date; weekEnd: Date } {
  const y = Number(formatInTimeZone(d, TZ, 'yyyy'));
  const mo = Number(formatInTimeZone(d, TZ, 'M'));
  const da = Number(formatInTimeZone(d, TZ, 'd'));

  const noonJst = jstWallToUtcDate(y, mo, da, 12, 0, 0);
  const isoDow = Number(formatInTimeZone(noonJst, TZ, 'i'));
  const deltaToMonday = 1 - isoDow;
  const mondayNoon = addDays(noonJst, deltaToMonday);

  const mY = Number(formatInTimeZone(mondayNoon, TZ, 'yyyy'));
  const mMo = Number(formatInTimeZone(mondayNoon, TZ, 'M'));
  const mD = Number(formatInTimeZone(mondayNoon, TZ, 'd'));

  let weekStart = jstWallToUtcDate(mY, mMo, mD, 9, 0, 0);
  if (d.getTime() < weekStart.getTime()) {
    weekStart = addDays(weekStart, -7);
  }

  const weekEnd = addDays(weekStart, 7);

  const wkY = Number(formatInTimeZone(weekStart, TZ, 'yyyy'));
  const yearStart = jstWallToUtcDate(wkY, 1, 1, 0, 0, 0);
  const daysDiff = Math.floor((weekStart.getTime() - yearStart.getTime()) / 86400000);
  const weekNumber = Math.floor(daysDiff / 7) + 1;
  const weekKey = `${wkY}-W${String(weekNumber).padStart(2, '0')}`;

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
