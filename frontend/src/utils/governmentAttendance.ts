import { format } from 'date-fns';
import { isHolidayDate } from './date';

export function getBusinessDaysInMonth(year: number, month: number): string[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const businessDays: string[] = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, month, day);
    const isWeekend = date.getDay() === 0 || date.getDay() === 6;
    if (!isWeekend && !isHolidayDate(date)) {
      businessDays.push(format(date, 'yyyy-MM-dd'));
    }
  }

  return businessDays;
}
