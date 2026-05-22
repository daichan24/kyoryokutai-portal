import { addDays, format, getDay } from 'date-fns';

type HolidayMap = Map<string, string>;

function nthMonday(year: number, monthIndex: number, nth: number) {
  const first = new Date(year, monthIndex, 1);
  const offset = (8 - getDay(first)) % 7;
  return new Date(year, monthIndex, 1 + offset + (nth - 1) * 7);
}

function vernalEquinoxDay(year: number) {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function autumnalEquinoxDay(year: number) {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function addHoliday(map: HolidayMap, date: Date, name: string) {
  map.set(format(date, 'yyyy-MM-dd'), name);
}

export function getJapaneseHolidays(year: number): HolidayMap {
  const holidays: HolidayMap = new Map();

  addHoliday(holidays, new Date(year, 0, 1), '元日');
  addHoliday(holidays, nthMonday(year, 0, 2), '成人の日');
  addHoliday(holidays, new Date(year, 1, 11), '建国記念の日');
  addHoliday(holidays, new Date(year, 1, 23), '天皇誕生日');
  addHoliday(holidays, new Date(year, 2, vernalEquinoxDay(year)), '春分の日');
  addHoliday(holidays, new Date(year, 3, 29), '昭和の日');
  addHoliday(holidays, new Date(year, 4, 3), '憲法記念日');
  addHoliday(holidays, new Date(year, 4, 4), 'みどりの日');
  addHoliday(holidays, new Date(year, 4, 5), 'こどもの日');
  addHoliday(holidays, nthMonday(year, 6, 3), '海の日');
  addHoliday(holidays, new Date(year, 7, 11), '山の日');
  addHoliday(holidays, nthMonday(year, 8, 3), '敬老の日');
  addHoliday(holidays, new Date(year, 8, autumnalEquinoxDay(year)), '秋分の日');
  addHoliday(holidays, nthMonday(year, 9, 2), 'スポーツの日');
  addHoliday(holidays, new Date(year, 10, 3), '文化の日');
  addHoliday(holidays, new Date(year, 10, 23), '勤労感謝の日');

  const baseKeys = [...holidays.keys()].sort();
  for (const key of baseKeys) {
    const date = new Date(`${key}T00:00:00`);
    if (getDay(date) !== 0) continue;
    let substitute = addDays(date, 1);
    while (holidays.has(format(substitute, 'yyyy-MM-dd'))) {
      substitute = addDays(substitute, 1);
    }
    addHoliday(holidays, substitute, '振替休日');
  }

  const sortedDates = [...holidays.keys()].sort();
  for (let i = 0; i < sortedDates.length - 1; i += 1) {
    const current = new Date(`${sortedDates[i]}T00:00:00`);
    const next = new Date(`${sortedDates[i + 1]}T00:00:00`);
    const between = addDays(current, 1);
    if (format(between, 'yyyy-MM-dd') === format(addDays(next, -1), 'yyyy-MM-dd') && !holidays.has(format(between, 'yyyy-MM-dd'))) {
      addHoliday(holidays, between, '国民の休日');
    }
  }

  return holidays;
}
