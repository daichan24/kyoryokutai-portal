import { describe, test, expect } from 'vitest';

// Simulate the date range filter logic from GET /api/sns-posts
function buildDateFilter(from?: string, to?: string, week?: string) {
  const where: Record<string, unknown> = {};

  if (from || to) {
    const pa: Record<string, unknown> = { not: null };
    if (from) pa.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      pa.lte = toDate;
    }
    where.postedAt = pa;
  } else if (week) {
    where.week = week;
  }

  return where;
}

// Helper: filter posts by the built where clause
function filterPosts(
  posts: Array<{ postedAt: Date; week: string }>,
  where: Record<string, unknown>
) {
  return posts.filter((post) => {
    if (where.postedAt) {
      const pa = where.postedAt as Record<string, unknown>;
      if (pa.gte && post.postedAt < (pa.gte as Date)) return false;
      if (pa.lte && post.postedAt > (pa.lte as Date)) return false;
    }
    if (where.week && post.week !== where.week) return false;
    return true;
  });
}

const samplePosts = [
  { postedAt: new Date('2024-01-01T03:00:00Z'), week: '2024-W01' },
  { postedAt: new Date('2024-01-15T03:00:00Z'), week: '2024-W03' },
  { postedAt: new Date('2024-01-31T03:00:00Z'), week: '2024-W05' },
  { postedAt: new Date('2024-06-15T03:00:00Z'), week: '2024-W24' },
  { postedAt: new Date('2024-12-31T03:00:00Z'), week: '2024-W53' },
];

describe('Date Range Filtering', () => {
  describe('9.1 期間指定検索のテスト', () => {
    describe('fromのみ指定', () => {
      test('should return posts on or after from date', () => {
        const where = buildDateFilter('2024-06-01');
        const result = filterPosts(samplePosts, where);

        expect(result.length).toBe(2);
        result.forEach((p) => {
          expect(p.postedAt >= new Date('2024-06-01')).toBe(true);
        });
      });

      test('should include post on exact from date', () => {
        const where = buildDateFilter('2024-01-15');
        const result = filterPosts(samplePosts, where);

        expect(result.some((p) => p.week === '2024-W03')).toBe(true);
      });

      test('should return all posts when from is very early', () => {
        const where = buildDateFilter('2000-01-01');
        const result = filterPosts(samplePosts, where);

        expect(result.length).toBe(samplePosts.length);
      });

      test('should return no posts when from is in the future', () => {
        const where = buildDateFilter('2099-01-01');
        const result = filterPosts(samplePosts, where);

        expect(result.length).toBe(0);
      });
    });

    describe('toのみ指定', () => {
      test('should return posts on or before to date (end of day)', () => {
        const where = buildDateFilter(undefined, '2024-01-31');
        const result = filterPosts(samplePosts, where);

        expect(result.length).toBe(3);
        const toDate = new Date('2024-01-31');
        toDate.setHours(23, 59, 59, 999);
        result.forEach((p) => {
          expect(p.postedAt <= toDate).toBe(true);
        });
      });

      test('should include post on exact to date', () => {
        const where = buildDateFilter(undefined, '2024-01-15');
        const result = filterPosts(samplePosts, where);

        expect(result.some((p) => p.week === '2024-W03')).toBe(true);
      });

      test('should return all posts when to is in the future', () => {
        const where = buildDateFilter(undefined, '2099-12-31');
        const result = filterPosts(samplePosts, where);

        expect(result.length).toBe(samplePosts.length);
      });

      test('should return no posts when to is very early', () => {
        const where = buildDateFilter(undefined, '2000-01-01');
        const result = filterPosts(samplePosts, where);

        expect(result.length).toBe(0);
      });
    });

    describe('from + to指定', () => {
      test('should return posts within inclusive range', () => {
        const where = buildDateFilter('2024-01-15', '2024-06-15');
        const result = filterPosts(samplePosts, where);

        expect(result.length).toBe(3);
        expect(result.some((p) => p.week === '2024-W03')).toBe(true);
        expect(result.some((p) => p.week === '2024-W05')).toBe(true);
        expect(result.some((p) => p.week === '2024-W24')).toBe(true);
      });

      test('should return empty when from > to', () => {
        const where = buildDateFilter('2024-12-31', '2024-01-01');
        const result = filterPosts(samplePosts, where);

        expect(result.length).toBe(0);
      });

      test('should return single post when from = to', () => {
        const where = buildDateFilter('2024-01-15', '2024-01-15');
        const result = filterPosts(samplePosts, where);

        expect(result.length).toBe(1);
        expect(result[0].week).toBe('2024-W03');
      });
    });

    describe('境界値（月末、年末）', () => {
      test('should handle end of month boundary', () => {
        const where = buildDateFilter('2024-01-01', '2024-01-31');
        const result = filterPosts(samplePosts, where);

        expect(result.length).toBe(3);
        expect(result.some((p) => p.week === '2024-W01')).toBe(true);
        expect(result.some((p) => p.week === '2024-W03')).toBe(true);
        expect(result.some((p) => p.week === '2024-W05')).toBe(true);
      });

      test('should handle year end boundary', () => {
        const where = buildDateFilter('2024-12-01', '2024-12-31');
        const result = filterPosts(samplePosts, where);

        expect(result.length).toBe(1);
        expect(result[0].week).toBe('2024-W53');
      });

      test('should handle to date at end of day (23:59:59.999)', () => {
        const where = buildDateFilter(undefined, '2024-01-31');
        const toFilter = where.postedAt as Record<string, unknown>;
        const toDate = toFilter.lte as Date;

        expect(toDate.getHours()).toBe(23);
        expect(toDate.getMinutes()).toBe(59);
        expect(toDate.getSeconds()).toBe(59);
        expect(toDate.getMilliseconds()).toBe(999);
      });

      test('should handle leap year February boundary', () => {
        const leapYearPosts = [
          { postedAt: new Date('2024-02-28T03:00:00Z'), week: '2024-W09' },
          { postedAt: new Date('2024-02-29T03:00:00Z'), week: '2024-W09' },
          { postedAt: new Date('2024-03-01T03:00:00Z'), week: '2024-W09' },
        ];

        const where = buildDateFilter('2024-02-01', '2024-02-29');
        const result = filterPosts(leapYearPosts, where);

        expect(result.length).toBe(2);
        expect(result.some((p) => p.postedAt.toISOString().startsWith('2024-02-28'))).toBe(true);
        expect(result.some((p) => p.postedAt.toISOString().startsWith('2024-02-29'))).toBe(true);
      });
    });
  });

  describe('9.2 週指定検索のテスト（後方互換性）', () => {
    test('should filter by week key when week param provided', () => {
      const where = buildDateFilter(undefined, undefined, '2024-W03');
      const result = filterPosts(samplePosts, where);

      expect(result.length).toBe(1);
      expect(result[0].week).toBe('2024-W03');
    });

    test('should return empty when week key not found', () => {
      const where = buildDateFilter(undefined, undefined, '2024-W99');
      const result = filterPosts(samplePosts, where);

      expect(result.length).toBe(0);
    });

    test('should prefer date range over week when both provided', () => {
      // from/to takes priority over week
      const where = buildDateFilter('2024-01-01', '2024-01-31', '2024-W03');
      
      // Should use postedAt filter, not week filter
      expect(where.postedAt).toBeDefined();
      expect(where.week).toBeUndefined();
    });

    test('should use week filter when no date range provided', () => {
      const where = buildDateFilter(undefined, undefined, '2024-W03');
      
      expect(where.week).toBe('2024-W03');
      expect(where.postedAt).toBeUndefined();
    });

    test('should return empty filter when no params provided', () => {
      const where = buildDateFilter();
      
      expect(Object.keys(where).length).toBe(0);
    });

    test('should handle various week key formats', () => {
      const weekPosts = [
        { postedAt: new Date('2024-01-15T03:00:00Z'), week: '2024-W03' },
        { postedAt: new Date('2024-01-15T03:00:00Z'), week: '2024-W3' }, // old format
      ];

      const where = buildDateFilter(undefined, undefined, '2024-W03');
      const result = filterPosts(weekPosts, where);

      expect(result.length).toBe(1);
      expect(result[0].week).toBe('2024-W03');
    });
  });
});
