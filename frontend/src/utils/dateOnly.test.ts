import { describe, expect, it } from 'vitest';
import { addDaysToDateOnly } from './dateOnly';

describe('addDaysToDateOnly', () => {
  it('keeps an inclusive July 30 end date visible by returning July 31 as the exclusive end', () => {
    expect(addDaysToDateOnly('2026-07-30', 1)).toBe('2026-07-31');
  });

  it('crosses month, year, and leap-day boundaries', () => {
    expect(addDaysToDateOnly('2026-07-31', 1)).toBe('2026-08-01');
    expect(addDaysToDateOnly('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDaysToDateOnly('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('supports negative offsets used by exclusive Google Calendar end dates', () => {
    expect(addDaysToDateOnly('2026-08-01', -1)).toBe('2026-07-31');
  });

  it('rejects invalid calendar dates instead of silently normalizing them', () => {
    expect(() => addDaysToDateOnly('2026-02-30', 1)).toThrow(RangeError);
    expect(() => addDaysToDateOnly('2026/07/30', 1)).toThrow(RangeError);
  });
});
