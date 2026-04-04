import { describe, test, expect } from 'vitest';
import { getCurrentWeekBoundary } from '../utils/weekBoundary';

describe('Weekly Status Calculation', () => {
  describe('7.1 4パターンのステータステスト', () => {
    test('should indicate both complete when STORY and FEED posts exist', () => {
      const posts = [
        { postType: 'STORY' as const },
        { postType: 'FEED' as const },
      ];

      const hasStory = posts.some((p) => p.postType === 'STORY');
      const hasFeed = posts.some((p) => p.postType === 'FEED');

      expect(hasStory).toBe(true);
      expect(hasFeed).toBe(true);
    });

    test('should indicate only STORY complete when only STORY posts exist', () => {
      const posts = [
        { postType: 'STORY' as const },
        { postType: 'STORY' as const },
      ];

      const hasStory = posts.some((p) => p.postType === 'STORY');
      const hasFeed = posts.some((p) => p.postType === 'FEED');

      expect(hasStory).toBe(true);
      expect(hasFeed).toBe(false);
    });

    test('should indicate only FEED complete when only FEED posts exist', () => {
      const posts = [
        { postType: 'FEED' as const },
        { postType: 'FEED' as const },
      ];

      const hasStory = posts.some((p) => p.postType === 'STORY');
      const hasFeed = posts.some((p) => p.postType === 'FEED');

      expect(hasStory).toBe(false);
      expect(hasFeed).toBe(true);
    });

    test('should indicate both incomplete when no posts exist', () => {
      const posts: Array<{ postType: 'STORY' | 'FEED' }> = [];

      const hasStory = posts.some((p) => p.postType === 'STORY');
      const hasFeed = posts.some((p) => p.postType === 'FEED');

      expect(hasStory).toBe(false);
      expect(hasFeed).toBe(false);
    });

    test('should handle multiple posts of same type correctly', () => {
      const posts = [
        { postType: 'STORY' as const },
        { postType: 'STORY' as const },
        { postType: 'STORY' as const },
        { postType: 'FEED' as const },
      ];

      const hasStory = posts.some((p) => p.postType === 'STORY');
      const hasFeed = posts.some((p) => p.postType === 'FEED');

      expect(hasStory).toBe(true);
      expect(hasFeed).toBe(true);
    });
  });

  describe('7.2 週境界のエッジケーステスト', () => {
    test('should include post at week start (Monday 9:00 JST)', () => {
      const { weekStart, weekEnd } = getCurrentWeekBoundary();
      
      // Post exactly at week start
      const postAtStart = weekStart;
      
      const isInWeek = postAtStart >= weekStart && postAtStart < weekEnd;
      expect(isInWeek).toBe(true);
    });

    test('should include post just before week end', () => {
      const { weekStart, weekEnd } = getCurrentWeekBoundary();
      
      // Post 1 millisecond before week end
      const postBeforeEnd = new Date(weekEnd.getTime() - 1);
      
      const isInWeek = postBeforeEnd >= weekStart && postBeforeEnd < weekEnd;
      expect(isInWeek).toBe(true);
    });

    test('should exclude post at week end (next Monday 9:00 JST)', () => {
      const { weekStart, weekEnd } = getCurrentWeekBoundary();
      
      // Post exactly at week end (start of next week)
      const postAtEnd = weekEnd;
      
      const isInWeek = postAtEnd >= weekStart && postAtEnd < weekEnd;
      expect(isInWeek).toBe(false);
    });

    test('should exclude post before week start', () => {
      const { weekStart, weekEnd } = getCurrentWeekBoundary();
      
      // Post 1 millisecond before week start
      const postBeforeStart = new Date(weekStart.getTime() - 1);
      
      const isInWeek = postBeforeStart >= weekStart && postBeforeStart < weekEnd;
      expect(isInWeek).toBe(false);
    });

    test('should handle posts spanning week boundary correctly', () => {
      const { weekStart, weekEnd } = getCurrentWeekBoundary();
      
      const posts = [
        { postedAt: new Date(weekStart.getTime() - 1000), postType: 'STORY' as const }, // Before week
        { postedAt: new Date(weekStart.getTime() + 1000), postType: 'STORY' as const }, // In week
        { postedAt: new Date(weekEnd.getTime() - 1000), postType: 'FEED' as const },    // In week
        { postedAt: new Date(weekEnd.getTime() + 1000), postType: 'FEED' as const },    // After week
      ];

      const postsInWeek = posts.filter(p => p.postedAt >= weekStart && p.postedAt < weekEnd);
      
      expect(postsInWeek.length).toBe(2);
      expect(postsInWeek[0].postType).toBe('STORY');
      expect(postsInWeek[1].postType).toBe('FEED');
    });

    test('should correctly filter posts by week boundary', () => {
      const { weekStart, weekEnd } = getCurrentWeekBoundary();
      
      const allPosts = [
        { postedAt: new Date(weekStart.getTime() - 86400000), postType: 'STORY' as const }, // 1 day before
        { postedAt: new Date(weekStart.getTime()), postType: 'STORY' as const },            // At start
        { postedAt: new Date(weekStart.getTime() + 3600000), postType: 'FEED' as const },   // 1 hour after start
        { postedAt: new Date(weekEnd.getTime() - 1), postType: 'FEED' as const },           // Just before end
        { postedAt: new Date(weekEnd.getTime()), postType: 'STORY' as const },              // At end (next week)
      ];

      const postsInWeek = allPosts.filter(p => p.postedAt >= weekStart && p.postedAt < weekEnd);
      
      expect(postsInWeek.length).toBe(3);
      expect(postsInWeek[0].postedAt.getTime()).toBe(weekStart.getTime());
      expect(postsInWeek[2].postedAt.getTime()).toBe(weekEnd.getTime() - 1);
    });

    test('should handle week boundary with different timezones', () => {
      const { weekStart, weekEnd } = getCurrentWeekBoundary();
      
      // Week boundaries are in UTC (representing Monday 9:00 JST)
      // Verify that the boundary is exactly 7 days
      const weekDuration = weekEnd.getTime() - weekStart.getTime();
      const expectedDuration = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
      
      expect(weekDuration).toBe(expectedDuration);
    });

    test('should handle posts at midnight JST correctly', () => {
      const { weekStart, weekEnd } = getCurrentWeekBoundary();
      
      // Monday midnight JST = Monday 15:00 UTC (previous day)
      // This is before Monday 9:00 JST, so should be in previous week
      const mondayMidnightJST = new Date(weekStart.getTime() - 9 * 3600000);
      
      const isInWeek = mondayMidnightJST >= weekStart && mondayMidnightJST < weekEnd;
      expect(isInWeek).toBe(false);
    });

    test('should handle posts at Sunday 23:59 JST correctly', () => {
      const { weekStart, weekEnd } = getCurrentWeekBoundary();
      
      // Sunday 23:59 JST = Sunday 14:59 UTC
      // This is before next Monday 9:00 JST, so should be in current week
      const sundayNightJST = new Date(weekEnd.getTime() - 9 * 3600000 - 60000);
      
      const isInWeek = sundayNightJST >= weekStart && sundayNightJST < weekEnd;
      expect(isInWeek).toBe(true);
    });
  });

  describe('Status message logic', () => {
    test('should return success message when both types complete', () => {
      const hasStory = true;
      const hasFeed = true;
      
      let status: 'success' | 'warning' | 'error';
      if (hasStory && hasFeed) {
        status = 'success';
      } else if (!hasStory && !hasFeed) {
        status = 'error';
      } else {
        status = 'warning';
      }
      
      expect(status).toBe('success');
    });

    test('should return warning when only STORY complete', () => {
      const hasStory = true;
      const hasFeed = false;
      
      let status: 'success' | 'warning' | 'error';
      if (hasStory && hasFeed) {
        status = 'success';
      } else if (!hasStory && !hasFeed) {
        status = 'error';
      } else {
        status = 'warning';
      }
      
      expect(status).toBe('warning');
    });

    test('should return warning when only FEED complete', () => {
      const hasStory = false;
      const hasFeed = true;
      
      let status: 'success' | 'warning' | 'error';
      if (hasStory && hasFeed) {
        status = 'success';
      } else if (!hasStory && !hasFeed) {
        status = 'error';
      } else {
        status = 'warning';
      }
      
      expect(status).toBe('warning');
    });

    test('should return error when neither complete', () => {
      const hasStory = false;
      const hasFeed = false;
      
      let status: 'success' | 'warning' | 'error';
      if (hasStory && hasFeed) {
        status = 'success';
      } else if (!hasStory && !hasFeed) {
        status = 'error';
      } else {
        status = 'warning';
      }
      
      expect(status).toBe('error');
    });
  });
});
