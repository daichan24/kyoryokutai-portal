import { format, startOfWeek, endOfWeek, addDays, parse, startOfMonth, endOfMonth, eachDayOfInterval, startOfDay } from 'date-fns';
import { ja } from 'date-fns/locale/ja';

export const formatDate = (date: Date | string, formatStr: string = 'yyyy-MM-dd'): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, formatStr, { locale: ja });
};

export const formatTime = (time: string): string => {
  return time;
};

export const getWeekRange = (date: Date = new Date()): { start: Date; end: Date } => {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  return { start, end };
};

export const getWeekDates = (date: Date = new Date()): Date[] => {
  const { start } = getWeekRange(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
};

export const getWeekString = (date: Date = new Date()): string => {
  return format(date, "yyyy-'W'II");
};

export const parseWeekString = (weekStr: string): Date => {
  return parse(weekStr, "yyyy-'W'II", new Date());
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
  return eachDayOfInterval({ start, end });
};

export const getDayDate = (date: Date = new Date()): Date[] => {
  return [startOfDay(date)];
};
