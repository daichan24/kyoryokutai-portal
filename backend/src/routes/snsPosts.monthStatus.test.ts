import { describe, test, expect } from 'vitest';

// Month status calculation logic extracted from SNSPosts.tsx
function getMonthBoundaries(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function calculateMonthStatus(
  posts: Array<{ postedAt: string; postType: 'STORY' | 'FEED' }>,
  referenceDate: Date
): { story: boolean; feed: boolean } {
  const { start, end } = getMonthBoundaries(referenceDate);
  const inMonth = (d: string) => {
    const t = new Date(d).getTime();
    return t >= start.getTime() && t <= end.getTime();
  };
  return {
    story: posts.some((p) => p.postType === 'STORY' && inMonth(p.postedAt)),
    feed: posts.some((p) => p.postType === 'FEED' && inMonth(p.postedAt)),
  };
}

// Fiscal year month list logic extracted from SNSPosts.tsx
function getAvailableMonths(now: Date, existingMonths: string[] = []): string[] {
  const months = new Set<string>(existingMonths);

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  const fiscalYearStart = currentMonth >= 4 ? currentYear : currentYear - 1;
  const fiscalYearEnd = fiscalYearStart + 1;

  // Current fiscal year months (April to March)
  for (let month = 4; month <= 12; month++) {
    months.add(`${fiscalYearStart}-${String(month).padStart(2, '0')}`);
  }
  for (let month = 1; month <= 3; month++) {
    months.add(`${fiscalYearEnd}-${String(month).padStart(2, '0')}`);
  }

  // Previous fiscal year's last 3 months (Jan, Feb, Mar)
  const prevFiscalYearEnd = fiscalYearStart;
  for (let month = 1; month <= 3; month++) {
    months.add(`${prevFiscalYearEnd}-${String(month).padStart(2, '0')}`);
  }

  return Array.from(months).sort().reverse();
}

describe('Month Status Calculation', () => {
  describe('15.1 今月の投稿有無判定テスト', () => {
    const referenceDate = new Date('2024-06-15T03:00:00Z');

    test('should return story=true when STORY post exists in current month', () => {
      const posts = [
        { postedAt: '2024-06-10T03:00:00Z', postType: 'STORY' as const },
      ];
      const status = calculateMonthStatus(posts, referenceDate);
      expect(status.story).toBe(true);
      expect(status.feed).toBe(false);
    });

    test('should return feed=true when FEED post exists in current month', () => {
      const posts = [
        { postedAt: '2024-06-20T03:00:00Z', postType: 'FEED' as const },
      ];
      const status = calculateMonthStatus(posts, referenceDate);
      expect(status.story).toBe(false);
      expect(status.feed).toBe(true);
    });

    test('should return both true when both types exist in current month', () => {
      const posts = [
        { postedAt: '2024-06-10T03:00:00Z', postType: 'STORY' as const },
        { postedAt: '2024-06-20T03:00:00Z', postType: 'FEED' as const },
      ];
      const status = calculateMonthStatus(posts, referenceDate);
      expect(status.story).toBe(true);
      expect(status.feed).toBe(true);
    });

    test('should return both false when no posts in current month', () => {
      const posts: Array<{ postedAt: string; postType: 'STORY' | 'FEED' }> = [];
      const status = calculateMonthStatus(posts, referenceDate);
      expect(status.story).toBe(false);
      expect(status.feed).toBe(false);
    });

    test('should ignore posts from previous month', () => {
      const posts = [
        { postedAt: '2024-05-31T03:00:00Z', postType: 'STORY' as const },
        { postedAt: '2024-05-15T03:00:00Z', postType: 'FEED' as const },
      ];
      const status = calculateMonthStatus(posts, referenceDate);
      expect(status.story).toBe(false);
      expect(status.feed).toBe(false);
    });

    test('should ignore posts from next month', () => {
      const posts = [
        { postedAt: '2024-07-01T03:00:00Z', postType: 'STORY' as const },
        { postedAt: '2024-07-15T03:00:00Z', postType: 'FEED' as const },
      ];
      const status = calculateMonthStatus(posts, referenceDate);
      expect(status.story).toBe(false);
      expect(status.feed).toBe(false);
    });

    test('should include post on first day of month', () => {
      const posts = [
        { postedAt: '2024-06-01T00:00:00Z', postType: 'STORY' as const },
      ];
      const status = calculateMonthStatus(posts, referenceDate);
      expect(status.story).toBe(true);
    });

    test('should include post on last day of month', () => {
      // Use local time to avoid timezone boundary issues
      const lastDay = new Date(2024, 5, 30, 12, 0, 0); // June 30, 2024 noon local time
      const posts = [
        { postedAt: lastDay.toISOString(), postType: 'FEED' as const },
      ];
      const status = calculateMonthStatus(posts, referenceDate);
      expect(status.feed).toBe(true);
    });

    test('should handle month boundary edge cases', () => {
      // Post at exactly midnight of first day
      const posts = [
        { postedAt: '2024-06-01T00:00:00.000Z', postType: 'STORY' as const },
      ];
      const status = calculateMonthStatus(posts, referenceDate);
      expect(status.story).toBe(true);
    });

    test('should handle leap year February correctly', () => {
      const leapYearRef = new Date('2024-02-15T03:00:00Z');
      const posts = [
        { postedAt: '2024-02-29T03:00:00Z', postType: 'STORY' as const },
      ];
      const status = calculateMonthStatus(posts, leapYearRef);
      expect(status.story).toBe(true);
    });

    test('should handle non-leap year February correctly', () => {
      const nonLeapRef = new Date('2023-02-15T03:00:00Z');
      const posts = [
        { postedAt: '2023-02-28T03:00:00Z', postType: 'STORY' as const },
        { postedAt: '2023-03-01T03:00:00Z', postType: 'FEED' as const }, // Next month
      ];
      const status = calculateMonthStatus(posts, nonLeapRef);
      expect(status.story).toBe(true);
      expect(status.feed).toBe(false);
    });
  });
});

describe('Fiscal Year Month Selection', () => {
  describe('17.1 利用可能な月リスト生成テスト', () => {
    test('should include all months of current fiscal year (April to March) - April start', () => {
      const now = new Date('2024-06-15'); // June 2024 → fiscal year 2024 (Apr 2024 - Mar 2025)
      const months = getAvailableMonths(now);

      // Current fiscal year: Apr 2024 - Mar 2025
      expect(months).toContain('2024-04');
      expect(months).toContain('2024-05');
      expect(months).toContain('2024-06');
      expect(months).toContain('2024-07');
      expect(months).toContain('2024-08');
      expect(months).toContain('2024-09');
      expect(months).toContain('2024-10');
      expect(months).toContain('2024-11');
      expect(months).toContain('2024-12');
      expect(months).toContain('2025-01');
      expect(months).toContain('2025-02');
      expect(months).toContain('2025-03');
    });

    test('should include previous fiscal year last 3 months', () => {
      const now = new Date('2024-06-15'); // Fiscal year 2024
      const months = getAvailableMonths(now);

      // Previous fiscal year (2023) last 3 months: Jan-Mar 2024
      expect(months).toContain('2024-01');
      expect(months).toContain('2024-02');
      expect(months).toContain('2024-03');
    });

    test('should return months in descending order', () => {
      const now = new Date('2024-06-15');
      const months = getAvailableMonths(now);

      for (let i = 0; i < months.length - 1; i++) {
        expect(months[i] >= months[i + 1]).toBe(true);
      }
    });

    test('should handle fiscal year boundary (March = previous fiscal year)', () => {
      const now = new Date('2024-03-15'); // March 2024 → fiscal year 2023 (Apr 2023 - Mar 2024)
      const months = getAvailableMonths(now);

      // Current fiscal year: Apr 2023 - Mar 2024
      expect(months).toContain('2023-04');
      expect(months).toContain('2024-03');

      // Previous fiscal year last 3 months: Jan-Mar 2023
      expect(months).toContain('2023-01');
      expect(months).toContain('2023-02');
      expect(months).toContain('2023-03');
    });

    test('should handle fiscal year boundary (April = new fiscal year)', () => {
      const now = new Date('2024-04-01'); // April 2024 → fiscal year 2024 (Apr 2024 - Mar 2025)
      const months = getAvailableMonths(now);

      // Current fiscal year: Apr 2024 - Mar 2025
      expect(months).toContain('2024-04');
      expect(months).toContain('2025-03');

      // Previous fiscal year last 3 months: Jan-Mar 2024
      expect(months).toContain('2024-01');
      expect(months).toContain('2024-02');
      expect(months).toContain('2024-03');
    });

    test('should include existing post months even outside fiscal year range', () => {
      const now = new Date('2024-06-15');
      const existingMonths = ['2022-01', '2021-12']; // Old months
      const months = getAvailableMonths(now, existingMonths);

      expect(months).toContain('2022-01');
      expect(months).toContain('2021-12');
    });

    test('should have exactly 15 months for standard fiscal year (12 current + 3 previous)', () => {
      const now = new Date('2024-06-15');
      const months = getAvailableMonths(now);

      // 12 months current fiscal year + 3 months previous fiscal year
      // But Jan-Mar 2024 are in both current fiscal year (as end) and previous fiscal year last 3
      // Actually: Apr 2024 - Mar 2025 (12) + Jan 2024 - Mar 2024 (3) = 15 unique months
      expect(months.length).toBe(15);
    });
  });
});
