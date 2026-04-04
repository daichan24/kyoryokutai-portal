import { describe, it, expect } from 'vitest';
import { jstWallToUtcDate, getWeekBoundaryForDate, getCurrentWeekBoundary } from './weekBoundary';
import { formatInTimeZone } from 'date-fns-tz';

const JST = 'Asia/Tokyo';

describe('weekBoundary', () => {
  describe('jstWallToUtcDate', () => {
    it('should convert JST wall clock time to UTC Date', () => {
      // 2024-01-15 12:00 JST = 2024-01-15 03:00 UTC
      const result = jstWallToUtcDate(2024, 1, 15, 12, 0, 0);
      expect(result.toISOString()).toBe('2024-01-15T03:00:00.000Z');
    });

    it('should handle midnight JST correctly', () => {
      // 2024-01-15 00:00 JST = 2024-01-14 15:00 UTC
      const result = jstWallToUtcDate(2024, 1, 15, 0, 0, 0);
      expect(result.toISOString()).toBe('2024-01-14T15:00:00.000Z');
    });

    it('should handle 9:00 JST (week boundary) correctly', () => {
      // 2024-01-15 09:00 JST = 2024-01-15 00:00 UTC
      const result = jstWallToUtcDate(2024, 1, 15, 9, 0, 0);
      expect(result.toISOString()).toBe('2024-01-15T00:00:00.000Z');
    });

    it('should handle year boundary correctly', () => {
      // 2024-01-01 00:00 JST = 2023-12-31 15:00 UTC
      const result = jstWallToUtcDate(2024, 1, 1, 0, 0, 0);
      expect(result.toISOString()).toBe('2023-12-31T15:00:00.000Z');
    });

    it('should handle leap year February correctly', () => {
      // 2024-02-29 12:00 JST = 2024-02-29 03:00 UTC
      const result = jstWallToUtcDate(2024, 2, 29, 12, 0, 0);
      expect(result.toISOString()).toBe('2024-02-29T03:00:00.000Z');
    });

    it('should handle optional minute and second parameters', () => {
      // 2024-01-15 12:30:45 JST = 2024-01-15 03:30:45 UTC
      const result = jstWallToUtcDate(2024, 1, 15, 12, 30, 45);
      expect(result.toISOString()).toBe('2024-01-15T03:30:45.000Z');
    });

    it('should default minute and second to 0 when not provided', () => {
      // 2024-01-15 12:00:00 JST = 2024-01-15 03:00:00 UTC
      const result = jstWallToUtcDate(2024, 1, 15, 12);
      expect(result.toISOString()).toBe('2024-01-15T03:00:00.000Z');
    });
  });

  describe('getWeekBoundaryForDate', () => {
    describe('basic week boundary calculation', () => {
      it('should calculate week boundary for a Monday at 9:00 JST', () => {
        // 2024-01-15 is a Monday
        // 2024-01-15 09:00 JST = 2024-01-15 00:00 UTC
        const date = jstWallToUtcDate(2024, 1, 15, 9, 0, 0);
        const { weekStart, weekEnd, weekKey } = getWeekBoundaryForDate(date);

        // Week should start at this exact moment
        expect(weekStart.toISOString()).toBe('2024-01-15T00:00:00.000Z');
        // Week should end 7 days later
        expect(weekEnd.toISOString()).toBe('2024-01-22T00:00:00.000Z');
        // Week key should be 2024-W03
        expect(weekKey).toBe('2024-W03');
      });

      it('should calculate week boundary for a Tuesday', () => {
        // 2024-01-16 is a Tuesday (day after Monday)
        const date = jstWallToUtcDate(2024, 1, 16, 12, 0, 0);
        const { weekStart, weekEnd, weekKey } = getWeekBoundaryForDate(date);

        // Week should start at previous Monday 9:00 JST
        expect(weekStart.toISOString()).toBe('2024-01-15T00:00:00.000Z');
        expect(weekEnd.toISOString()).toBe('2024-01-22T00:00:00.000Z');
        expect(weekKey).toBe('2024-W03');
      });

      it('should calculate week boundary for a Sunday', () => {
        // 2024-01-21 is a Sunday (last day of week)
        const date = jstWallToUtcDate(2024, 1, 21, 12, 0, 0);
        const { weekStart, weekEnd, weekKey } = getWeekBoundaryForDate(date);

        // Week should start at Monday 2024-01-15 9:00 JST
        expect(weekStart.toISOString()).toBe('2024-01-15T00:00:00.000Z');
        expect(weekEnd.toISOString()).toBe('2024-01-22T00:00:00.000Z');
        expect(weekKey).toBe('2024-W03');
      });
    });

    describe('timezone boundary edge cases', () => {
      it('should handle Monday before 9:00 JST (belongs to previous week)', () => {
        // 2024-01-15 08:59 JST = 2024-01-14 23:59 UTC
        const date = jstWallToUtcDate(2024, 1, 15, 8, 59, 0);
        const { weekStart, weekEnd, weekKey } = getWeekBoundaryForDate(date);

        // Should belong to previous week (starting 2024-01-08)
        expect(weekStart.toISOString()).toBe('2024-01-08T00:00:00.000Z');
        expect(weekEnd.toISOString()).toBe('2024-01-15T00:00:00.000Z');
        expect(weekKey).toBe('2024-W02');
      });

      it('should handle Monday at exactly 9:00 JST (start of new week)', () => {
        // 2024-01-15 09:00 JST = 2024-01-15 00:00 UTC
        const date = jstWallToUtcDate(2024, 1, 15, 9, 0, 0);
        const { weekStart, weekEnd, weekKey } = getWeekBoundaryForDate(date);

        // Should belong to current week
        expect(weekStart.toISOString()).toBe('2024-01-15T00:00:00.000Z');
        expect(weekEnd.toISOString()).toBe('2024-01-22T00:00:00.000Z');
        expect(weekKey).toBe('2024-W03');
      });

      it('should handle Sunday at 23:59 JST (end of week)', () => {
        // 2024-01-21 23:59 JST = 2024-01-21 14:59 UTC
        const date = jstWallToUtcDate(2024, 1, 21, 23, 59, 0);
        const { weekStart, weekEnd, weekKey } = getWeekBoundaryForDate(date);

        // Should still belong to current week
        expect(weekStart.toISOString()).toBe('2024-01-15T00:00:00.000Z');
        expect(weekEnd.toISOString()).toBe('2024-01-22T00:00:00.000Z');
        expect(weekKey).toBe('2024-W03');
      });

      it('should handle Monday at 00:00 JST (early morning)', () => {
        // 2024-01-15 00:00 JST = 2024-01-14 15:00 UTC
        const date = jstWallToUtcDate(2024, 1, 15, 0, 0, 0);
        const { weekStart, weekEnd, weekKey } = getWeekBoundaryForDate(date);

        // Should belong to previous week (before 9:00 JST)
        expect(weekStart.toISOString()).toBe('2024-01-08T00:00:00.000Z');
        expect(weekEnd.toISOString()).toBe('2024-01-15T00:00:00.000Z');
        expect(weekKey).toBe('2024-W02');
      });
    });

    describe('year boundary edge cases', () => {
      it('should handle first week of year', () => {
        // 2024-01-01 is a Monday
        const date = jstWallToUtcDate(2024, 1, 1, 12, 0, 0);
        const { weekStart, weekEnd, weekKey } = getWeekBoundaryForDate(date);

        expect(weekStart.toISOString()).toBe('2024-01-01T00:00:00.000Z');
        expect(weekEnd.toISOString()).toBe('2024-01-08T00:00:00.000Z');
        expect(weekKey).toBe('2024-W01');
      });

      it('should handle last week of year', () => {
        // 2024-12-30 is a Monday
        const date = jstWallToUtcDate(2024, 12, 30, 12, 0, 0);
        const { weekStart, weekEnd, weekKey } = getWeekBoundaryForDate(date);

        expect(weekStart.toISOString()).toBe('2024-12-30T00:00:00.000Z');
        expect(weekEnd.toISOString()).toBe('2025-01-06T00:00:00.000Z');
        expect(weekKey).toBe('2024-W53'); // 2024 has 53 weeks
      });

      it('should handle New Year transition', () => {
        // 2024-12-31 is a Tuesday
        const date = jstWallToUtcDate(2024, 12, 31, 12, 0, 0);
        const { weekStart, weekEnd, weekKey } = getWeekBoundaryForDate(date);

        // Should belong to week starting Monday 2024-12-30
        expect(weekStart.toISOString()).toBe('2024-12-30T00:00:00.000Z');
        expect(weekEnd.toISOString()).toBe('2025-01-06T00:00:00.000Z');
        expect(weekKey).toBe('2024-W53'); // 2024 has 53 weeks
      });

      it('should handle first day of year when it is not Monday', () => {
        // 2025-01-01 is a Wednesday
        const date = jstWallToUtcDate(2025, 1, 1, 12, 0, 0);
        const { weekStart, weekEnd, weekKey } = getWeekBoundaryForDate(date);

        // Should belong to week starting Monday 2024-12-30
        expect(weekStart.toISOString()).toBe('2024-12-30T00:00:00.000Z');
        expect(weekEnd.toISOString()).toBe('2025-01-06T00:00:00.000Z');
        expect(weekKey).toBe('2024-W53'); // 2024 has 53 weeks
      });
    });

    describe('month boundary edge cases', () => {
      it('should handle end of month', () => {
        // 2024-01-31 is a Wednesday
        const date = jstWallToUtcDate(2024, 1, 31, 12, 0, 0);
        const { weekStart, weekEnd, weekKey } = getWeekBoundaryForDate(date);

        expect(weekStart.toISOString()).toBe('2024-01-29T00:00:00.000Z');
        expect(weekEnd.toISOString()).toBe('2024-02-05T00:00:00.000Z');
        expect(weekKey).toBe('2024-W05');
      });

      it('should handle leap year February 29', () => {
        // 2024-02-29 is a Thursday
        const date = jstWallToUtcDate(2024, 2, 29, 12, 0, 0);
        const { weekStart, weekEnd, weekKey } = getWeekBoundaryForDate(date);

        expect(weekStart.toISOString()).toBe('2024-02-26T00:00:00.000Z');
        expect(weekEnd.toISOString()).toBe('2024-03-04T00:00:00.000Z');
        expect(weekKey).toBe('2024-W09');
      });
    });

    describe('week key format', () => {
      it('should format week key with zero-padded week number', () => {
        // First week of year
        const date1 = jstWallToUtcDate(2024, 1, 1, 12, 0, 0);
        const { weekKey: key1 } = getWeekBoundaryForDate(date1);
        expect(key1).toBe('2024-W01');

        // Tenth week
        const date10 = jstWallToUtcDate(2024, 3, 4, 12, 0, 0);
        const { weekKey: key10 } = getWeekBoundaryForDate(date10);
        expect(key10).toBe('2024-W10');

        // Last week (2024 has 53 weeks)
        const date53 = jstWallToUtcDate(2024, 12, 30, 12, 0, 0);
        const { weekKey: key53 } = getWeekBoundaryForDate(date53);
        expect(key53).toBe('2024-W53');
      });

      it('should use year from week start date for week key', () => {
        // 2025-01-01 is Wednesday, belongs to week starting 2024-12-30
        const date = jstWallToUtcDate(2025, 1, 1, 12, 0, 0);
        const { weekKey } = getWeekBoundaryForDate(date);
        
        // Week key should use 2024 (year of week start), and 2024 has 53 weeks
        expect(weekKey).toBe('2024-W53');
      });
    });

    describe('consistency across week', () => {
      it('should return same week boundary for all days in the same week', () => {
        // Week of 2024-01-15 (Monday) to 2024-01-21 (Sunday)
        const monday = jstWallToUtcDate(2024, 1, 15, 12, 0, 0);
        const tuesday = jstWallToUtcDate(2024, 1, 16, 12, 0, 0);
        const wednesday = jstWallToUtcDate(2024, 1, 17, 12, 0, 0);
        const thursday = jstWallToUtcDate(2024, 1, 18, 12, 0, 0);
        const friday = jstWallToUtcDate(2024, 1, 19, 12, 0, 0);
        const saturday = jstWallToUtcDate(2024, 1, 20, 12, 0, 0);
        const sunday = jstWallToUtcDate(2024, 1, 21, 12, 0, 0);

        const boundaries = [
          getWeekBoundaryForDate(monday),
          getWeekBoundaryForDate(tuesday),
          getWeekBoundaryForDate(wednesday),
          getWeekBoundaryForDate(thursday),
          getWeekBoundaryForDate(friday),
          getWeekBoundaryForDate(saturday),
          getWeekBoundaryForDate(sunday),
        ];

        // All should have same week start, end, and key
        boundaries.forEach((boundary) => {
          expect(boundary.weekStart.toISOString()).toBe('2024-01-15T00:00:00.000Z');
          expect(boundary.weekEnd.toISOString()).toBe('2024-01-22T00:00:00.000Z');
          expect(boundary.weekKey).toBe('2024-W03');
        });
      });
    });

    describe('UTC date input handling', () => {
      it('should correctly interpret UTC dates as JST for week calculation', () => {
        // Create a UTC date that represents Monday 2024-01-15 12:00 JST
        // 2024-01-15 12:00 JST = 2024-01-15 03:00 UTC
        const utcDate = new Date('2024-01-15T03:00:00.000Z');
        const { weekStart, weekEnd, weekKey } = getWeekBoundaryForDate(utcDate);

        expect(weekStart.toISOString()).toBe('2024-01-15T00:00:00.000Z');
        expect(weekEnd.toISOString()).toBe('2024-01-22T00:00:00.000Z');
        expect(weekKey).toBe('2024-W03');
      });

      it('should handle UTC midnight correctly', () => {
        // 2024-01-15 00:00 UTC = 2024-01-15 09:00 JST (week boundary)
        const utcDate = new Date('2024-01-15T00:00:00.000Z');
        const { weekStart, weekEnd, weekKey } = getWeekBoundaryForDate(utcDate);

        expect(weekStart.toISOString()).toBe('2024-01-15T00:00:00.000Z');
        expect(weekEnd.toISOString()).toBe('2024-01-22T00:00:00.000Z');
        expect(weekKey).toBe('2024-W03');
      });
    });
  });

  describe('getCurrentWeekBoundary', () => {
    it('should return week boundary for current date', () => {
      const result = getCurrentWeekBoundary();
      
      // Should return valid dates
      expect(result.weekStart).toBeInstanceOf(Date);
      expect(result.weekEnd).toBeInstanceOf(Date);
      
      // Week end should be 7 days after week start
      const diffMs = result.weekEnd.getTime() - result.weekStart.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      expect(diffDays).toBe(7);
      
      // Week key should match format YYYY-WNN
      expect(result.weekKey).toMatch(/^\d{4}-W\d{2}$/);
      
      // Week start should be a Monday at 9:00 JST (00:00 UTC)
      const dayOfWeek = Number(formatInTimeZone(result.weekStart, JST, 'i'));
      const hourJst = Number(formatInTimeZone(result.weekStart, JST, 'H'));
      expect(dayOfWeek).toBe(1); // Monday
      expect(hourJst).toBe(9); // 9:00 JST
    });

    it('should return consistent results when called multiple times in quick succession', () => {
      const result1 = getCurrentWeekBoundary();
      const result2 = getCurrentWeekBoundary();
      const result3 = getCurrentWeekBoundary();
      
      expect(result1.weekStart.toISOString()).toBe(result2.weekStart.toISOString());
      expect(result1.weekEnd.toISOString()).toBe(result2.weekEnd.toISOString());
      expect(result1.weekKey).toBe(result2.weekKey);
      
      expect(result2.weekStart.toISOString()).toBe(result3.weekStart.toISOString());
      expect(result2.weekEnd.toISOString()).toBe(result3.weekEnd.toISOString());
      expect(result2.weekKey).toBe(result3.weekKey);
    });
  });
});
