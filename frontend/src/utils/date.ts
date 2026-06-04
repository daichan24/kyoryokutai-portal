import { format, startOfWeek, endOfWeek, addDays, parse, startOfMonth, endOfMonth, eachDayOfInterval, startOfDay } from 'date-fns';
import { ja } from 'date-fns/locale/ja';
import { isHoliday } from 'japanese-holidays';

export const formatDate = (date: Date | string, formatStr: string = 'yyyy-MM-dd'): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, formatStr, { locale: ja });
};

export const formatTime = (time: string): string => {
  if (!time) return time;
  const [h, m] = time.split(':');
  return `${parseInt(h, 10)}:${m}`;
};

export type WeekStartsOn = 0 | 1;

export const getWeekRange = (date: Date = new Date(), weekStartsOn: WeekStartsOn = 0): { start: Date; end: Date } => {
  const start = startOfWeek(date, { weekStartsOn });
  const end = endOfWeek(date, { weekStartsOn });
  return { start, end };
};

export const getWeekDates = (date: Date = new Date(), weekStartsOn: WeekStartsOn = 0): Date[] => {
  const { start } = getWeekRange(date, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

// 日付が祝日かどうかを判定
export const isHolidayDate = (date: Date | string): boolean => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return isHoliday(d) !== undefined;
};

// 日付が日曜日かどうか
export const isSunday = (date: Date | string): boolean => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getDay() === 0;
};

// 日付が土曜日かどうか
export const isSaturday = (date: Date | string): boolean => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.getDay() === 6;
};

const getIsoWeekStart = (year: number, weekNum: number): Date => {
  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const firstIsoMonday = new Date(jan4);
  firstIsoMonday.setDate(jan4.getDate() - jan4Day + 1);

  const weekStart = new Date(firstIsoMonday);
  weekStart.setDate(firstIsoMonday.getDate() + (weekNum - 1) * 7);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
};

export const normalizeWeekString = (weekStr: string): string => {
  const match = weekStr.trim().match(/^(\d{4})-W?(\d{2})$/);
  if (!match) return weekStr;
  return `${match[1]}-${match[2]}`;
};

export const toWeekInputValue = (weekStr: string): string => {
  const normalized = normalizeWeekString(weekStr);
  const match = normalized.match(/^(\d{4})-(\d{2})$/);
  if (!match) return weekStr;
  return `${match[1]}-W${match[2]}`;
};

export const getWeekString = (date: Date = new Date()): string => {
  return format(date, 'RRRR-II');
};

export const parseWeekString = (weekStr: string): Date => {
  try {
    // YYYY-WW / YYYY-Www形式（例: 2024-01 / 2024-W01）をISO週としてパース
    const match = weekStr.match(/^(\d{4})-W?(\d{2})$/);
    if (match) {
      const year = parseInt(match[1], 10);
      const weekNum = parseInt(match[2], 10);
      return getIsoWeekStart(year, weekNum);
    }
    
    // フォールバック: 既存のパース方法を試す
    return parse(weekStr, "yyyy-'W'II", new Date());
  } catch (error) {
    console.error('Failed to parse week string:', weekStr, error);
    // エラー時は現在の日付を返す
    return new Date();
  }
};

export const formatWeekLabel = (weekStr: string, options: { includeYear?: boolean; suffix?: string } = {}): string => {
  const { includeYear = true, suffix = 'の週' } = options;
  try {
    const weekStart = parseWeekString(weekStr);
    if (isNaN(weekStart.getTime())) return weekStr;
    const formatStr = includeYear ? 'yyyy年M月d日' : 'M月d日';
    return `${formatDate(weekStart, formatStr)}${suffix}`;
  } catch {
    return weekStr;
  }
};

export const getFiscalYear = (date: Date = new Date()): number => {
  const year = date.getFullYear();
  return date.getMonth() >= 3 ? year : year - 1;
};

export const formatFiscalYear = (fiscalYear: number): string => {
  return `${fiscalYear}年度`;
};

export const isToday = (date: Date | string): boolean => {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
};

export const isSameDay = (date1: Date | string, date2: Date | string): boolean => {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

export const getMonthDates = (date: Date = new Date(), weekStartsOn: WeekStartsOn = 0): Date[] => {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  
  // 月の最初の日が設定した開始曜日になるように調整
  const firstDayOfWeek = (start.getDay() - weekStartsOn + 7) % 7;
  const monthDays = eachDayOfInterval({ start, end });
  
  // 月の最初の日より前の日を追加
  const daysBeforeMonth: Date[] = [];
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const prevDate = new Date(start);
    prevDate.setDate(prevDate.getDate() - (i + 1));
    daysBeforeMonth.push(prevDate);
  }
  
  // 月の最後の日より後の日を追加（最後の週を7日にする）
  const lastDayOfWeek = (end.getDay() - weekStartsOn + 7) % 7;
  const daysAfterMonth: Date[] = [];
  for (let i = 1; i <= (6 - lastDayOfWeek); i++) {
    const nextDate = new Date(end);
    nextDate.setDate(nextDate.getDate() + i);
    daysAfterMonth.push(nextDate);
  }
  
  return [...daysBeforeMonth, ...monthDays, ...daysAfterMonth];
};

export const getDayDate = (date: Date = new Date()): Date[] => {
  return [startOfDay(date)];
};
