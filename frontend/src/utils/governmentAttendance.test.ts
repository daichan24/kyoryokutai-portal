import { describe, expect, it } from 'vitest';
import { getBusinessDaysInMonth } from './governmentAttendance';

describe('getBusinessDaysInMonth', () => {
  it('土日と祝日を除いた日だけを返す', () => {
    const days = getBusinessDaysInMonth(2026, 0);

    expect(days).not.toContain('2026-01-01');
    expect(days).not.toContain('2026-01-03');
    expect(days).not.toContain('2026-01-12');
    expect(days).toContain('2026-01-02');
    expect(days).toContain('2026-01-13');
  });
});
