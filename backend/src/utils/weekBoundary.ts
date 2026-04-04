import { addDays } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';

const JST = 'Asia/Tokyo';

/** 週境界の計算結果 */
export interface WeekBoundary {
  weekStart: Date;  // 月曜 9:00 JST (UTC 0:00)
  weekEnd: Date;    // 翌月曜 9:00 JST (UTC 0:00)
  weekKey: string;  // YYYY-WNN 形式
}

/**
 * JST の壁時計（年・月・日・時…）を、その瞬間の UTC の Date に変換（日本は DST なし・常に UTC+9）
 */
export function jstWallToUtcDate(y: number, mo: number, d: number, h: number, mi = 0, se = 0): Date {
  return new Date(Date.UTC(y, mo - 1, d, h - 9, mi, se));
}

/**
 * 月曜 9:00 JST を週の始まりとする境界（Render 等 UTC サーバとブラウザで同一の weekKey になるよう、
 * `new Date(y,0,1)` / `setHours` は使わない）
 */
export function getWeekBoundaryForDate(date: Date): WeekBoundary {
  const y = Number(formatInTimeZone(date, JST, 'yyyy'));
  const mo = Number(formatInTimeZone(date, JST, 'M'));
  const da = Number(formatInTimeZone(date, JST, 'd'));

  const noonJst = jstWallToUtcDate(y, mo, da, 12, 0, 0);
  const isoDow = Number(formatInTimeZone(noonJst, JST, 'i'));
  const deltaToMonday = 1 - isoDow;
  const mondayNoon = addDays(noonJst, deltaToMonday);

  const mY = Number(formatInTimeZone(mondayNoon, JST, 'yyyy'));
  const mMo = Number(formatInTimeZone(mondayNoon, JST, 'M'));
  const mD = Number(formatInTimeZone(mondayNoon, JST, 'd'));

  let weekStart = jstWallToUtcDate(mY, mMo, mD, 9, 0, 0);
  if (date.getTime() < weekStart.getTime()) {
    weekStart = addDays(weekStart, -7);
  }

  const weekEnd = addDays(weekStart, 7);

  const wkY = Number(formatInTimeZone(weekStart, JST, 'yyyy'));
  const yearStart = jstWallToUtcDate(wkY, 1, 1, 0, 0, 0);
  const daysDiff = Math.floor((weekStart.getTime() - yearStart.getTime()) / 86400000);
  const weekNumber = Math.floor(daysDiff / 7) + 1;
  const weekKey = `${wkY}-W${String(weekNumber).padStart(2, '0')}`;

  return { weekStart, weekEnd, weekKey };
}

/** 現在日時の週境界を返す */
export function getCurrentWeekBoundary(): WeekBoundary {
  return getWeekBoundaryForDate(new Date());
}
