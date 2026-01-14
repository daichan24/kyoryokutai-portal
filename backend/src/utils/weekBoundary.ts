import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';

const JST_TIMEZONE = 'Asia/Tokyo';

/**
 * 週境界計算（月曜9:00 JST基準）
 * 
 * 現状仕様（変更前）:
 * - 週のキー: YYYY-WW形式（年始からの簡易計算）
 * - 週判定: 年始からの日数で週番号を計算（ISO週番号ではない）
 * 
 * 新仕様:
 * - 週の開始: 月曜 9:00 JST
 * - 週の終了: 次の月曜 9:00 JST（未満）
 * - 週のキー: YYYY-WW形式（月曜9:00基準で週を判定）
 */
export function getCurrentWeekBoundary(): { weekStart: Date; weekEnd: Date; weekKey: string } {
  const now = new Date();
  const nowJST = utcToZonedTime(now, JST_TIMEZONE);
  
  // 月曜日を取得（0=日曜, 1=月曜, ...）
  const dayOfWeek = nowJST.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 日曜の場合は-6、月曜は0
  
  // 今週の月曜9:00 JSTを計算
  const monday9amJST = new Date(nowJST);
  monday9amJST.setDate(nowJST.getDate() + mondayOffset);
  monday9amJST.setHours(9, 0, 0, 0);
  
  // 現在時刻が月曜9:00より前なら、前週の月曜9:00を基準にする
  if (nowJST < monday9amJST) {
    monday9amJST.setDate(monday9amJST.getDate() - 7);
  }
  
  // 週の終了（次の月曜9:00 JST、未満）
  const nextMonday9amJST = new Date(monday9amJST);
  nextMonday9amJST.setDate(monday9amJST.getDate() + 7);
  
  // UTCに変換
  const weekStart = zonedTimeToUtc(monday9amJST, JST_TIMEZONE);
  const weekEnd = zonedTimeToUtc(nextMonday9amJST, JST_TIMEZONE);
  
  // 週のキーを生成（YYYY-WW形式）
  const year = monday9amJST.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const daysDiff = Math.floor((monday9amJST.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.floor(daysDiff / 7) + 1;
  const weekKey = `${year}-W${weekNumber.toString().padStart(2, '0')}`;
  
  return { weekStart, weekEnd, weekKey };
}

/**
 * 指定日時が属する週の境界を取得
 */
export function getWeekBoundaryForDate(date: Date): { weekStart: Date; weekEnd: Date; weekKey: string } {
  const dateJST = utcToZonedTime(date, JST_TIMEZONE);
  
  const dayOfWeek = dateJST.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const monday9amJST = new Date(dateJST);
  monday9amJST.setDate(dateJST.getDate() + mondayOffset);
  monday9amJST.setHours(9, 0, 0, 0);
  
  // 指定日時が月曜9:00より前なら、前週の月曜9:00を基準にする
  if (dateJST < monday9amJST) {
    monday9amJST.setDate(monday9amJST.getDate() - 7);
  }
  
  const nextMonday9amJST = new Date(monday9amJST);
  nextMonday9amJST.setDate(monday9amJST.getDate() + 7);
  
  const weekStart = zonedTimeToUtc(monday9amJST, JST_TIMEZONE);
  const weekEnd = zonedTimeToUtc(nextMonday9amJST, JST_TIMEZONE);
  
  const year = monday9amJST.getFullYear();
  const startOfYear = new Date(year, 0, 1);
  const daysDiff = Math.floor((monday9amJST.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  const weekNumber = Math.floor(daysDiff / 7) + 1;
  const weekKey = `${year}-W${weekNumber.toString().padStart(2, '0')}`;
  
  return { weekStart, weekEnd, weekKey };
}

