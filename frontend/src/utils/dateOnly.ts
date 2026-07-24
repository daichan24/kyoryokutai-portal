const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const parseDateOnly = (value: string): { year: number; month: number; day: number } => {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) {
    throw new RangeError(`Invalid date-only value: ${value}`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utcDate = new Date(Date.UTC(year, month - 1, day));

  if (
    utcDate.getUTCFullYear() !== year
    || utcDate.getUTCMonth() !== month - 1
    || utcDate.getUTCDate() !== day
  ) {
    throw new RangeError(`Invalid date-only value: ${value}`);
  }

  return { year, month, day };
};

/**
 * YYYY-MM-DD をタイムゾーンに依存せず日数加算する。
 * Date のローカル時刻と toISOString() を混在させないことで、JST の前日ずれを防ぐ。
 */
export const addDaysToDateOnly = (value: string, amount: number): string => {
  const { year, month, day } = parseDateOnly(value);
  const utcDate = new Date(Date.UTC(year, month - 1, day));
  utcDate.setUTCDate(utcDate.getUTCDate() + amount);
  return utcDate.toISOString().slice(0, 10);
};
