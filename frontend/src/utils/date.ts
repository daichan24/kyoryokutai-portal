import { format, startOfWeek, endOfWeek, addDays, parse, startOfMonth, endOfMonth, eachDayOfInterval, startOfDay } from 'date-fns';
import { ja } from 'date-fns/locale/ja';
import { isHoliday } from 'japanese-holidays';

export const formatDate = (date: Date | string, formatStr: string = 'yyyy-MM-dd'): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, formatStr, { locale: ja });
};

export const formatTime = (time: string): string => {
  return time;
};

export const getWeekRange = (date: Date = new Date()): { start: Date; end: Date } => {
  const start = startOfWeek(date, { weekStartsOn: 0 }); // 日曜始まり
  const end = endOfWeek(date, { weekStartsOn: 0 });
  return { start, end };
};

export const getWeekDates = (date: Date = new Date()): Date[] => {
  const { start } = getWeekRange(date);
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

export const getWeekString = (date: Date = new Date()): string => {
  return format(date, "yyyy-'W'II");
};

export const parseWeekString = (weekStr: string): Date => {
  try {
    // YYYY-WW形式（例: 2024-01）をパース
    const match = weekStr.match(/^(\d{4})-(\d{2})$/);
    if (match) {
      const year = parseInt(match[1], 10);
      const weekNum = parseInt(match[2], 10);
      
      // 年の最初の月曜日を基準に週を計算
      const yearStart = new Date(year, 0, 1);
      const firstMonday = new Date(yearStart);
      const dayOfWeek = yearStart.getDay();
      const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7;
      firstMonday.setDate(yearStart.getDate() + daysToMonday);
      
      // 指定された週の開始日
      const weekStart = new Date(firstMonday);
      weekStart.setDate(firstMonday.getDate() + (weekNum - 1) * 7);
      
      return weekStart;
    }
    
    // フォールバック: 既存のパース方法を試す
    return parse(weekStr, "yyyy-'W'II", new Date());
  } catch (error) {
    console.error('Failed to parse week string:', weekStr, error);
    // エラー時は現在の日付を返す
    return new Date();
  }
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

export const getMonthDates = (date: Date = new Date()): Date[] => {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  
  // 月の最初の日が日曜日になるように調整
  const firstDayOfWeek = start.getDay(); // 0=日曜, 1=月曜, ...
  const monthDays = eachDayOfInterval({ start, end });
  
  // 月の最初の日より前の日を追加（日曜始まり）
  const daysBeforeMonth: Date[] = [];
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const prevDate = new Date(start);
    prevDate.setDate(prevDate.getDate() - (i + 1));
    daysBeforeMonth.push(prevDate);
  }
  
  // 月の最後の日より後の日を追加（最後の週を7日にする）
  const lastDayOfWeek = end.getDay(); // 0=日曜, 1=月曜, ...
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
