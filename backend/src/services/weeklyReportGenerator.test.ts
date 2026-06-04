import { describe, expect, it } from 'vitest';
import { normalizeWeeklyReportWeek } from './weeklyReportGenerator';

describe('normalizeWeeklyReportWeek', () => {
  it('accepts stored and browser week input formats', () => {
    expect(normalizeWeeklyReportWeek('2026-22')).toBe('2026-22');
    expect(normalizeWeeklyReportWeek('2026-W22')).toBe('2026-22');
  });

  it('rejects invalid week values', () => {
    expect(normalizeWeeklyReportWeek('2026-00')).toBeNull();
    expect(normalizeWeeklyReportWeek('2026-54')).toBeNull();
    expect(normalizeWeeklyReportWeek('2026-5')).toBeNull();
  });
});
