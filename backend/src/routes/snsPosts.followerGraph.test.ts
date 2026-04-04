import { describe, test, expect } from 'vitest';

// Data point generation logic extracted from FollowerGraph.tsx
interface DataPoint {
  date: string;
  count: number;
  postType: 'STORY' | 'FEED';
}

function generateDataPoints(
  posts: Array<{ postedAt: string; followerCount?: number | null; postType: 'STORY' | 'FEED' }>
): DataPoint[] {
  return posts
    .filter((p) => p.followerCount != null)
    .map((p) => ({
      date: p.postedAt.slice(0, 10),
      count: p.followerCount!,
      postType: p.postType,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Coordinate calculation logic extracted from FollowerGraph.tsx
const W = 600;
const H = 160;
const PAD = { top: 16, right: 16, bottom: 32, left: 56 };
const innerW = W - PAD.left - PAD.right;
const innerH = H - PAD.top - PAD.bottom;

function calculateCoordinates(dataPoints: DataPoint[]) {
  if (dataPoints.length === 0) return [];

  const maxCount = Math.max(...dataPoints.map((d) => d.count));
  const minCount = Math.min(...dataPoints.map((d) => d.count));
  const range = maxCount - minCount || 1;

  const xStep = dataPoints.length > 1 ? innerW / (dataPoints.length - 1) : innerW;

  const toX = (i: number) => PAD.left + (dataPoints.length > 1 ? i * xStep : innerW / 2);
  const toY = (v: number) => PAD.top + innerH - ((v - minCount) / range) * innerH;

  return dataPoints.map((d, i) => ({
    x: toX(i),
    y: toY(d.count),
    count: d.count,
    postType: d.postType,
  }));
}

describe('Follower Graph', () => {
  describe('19.1 データポイント生成テスト', () => {
    test('should exclude posts with null followerCount', () => {
      const posts = [
        { postedAt: '2024-01-15T03:00:00Z', followerCount: null, postType: 'STORY' as const },
        { postedAt: '2024-01-16T03:00:00Z', followerCount: 1000, postType: 'FEED' as const },
        { postedAt: '2024-01-17T03:00:00Z', followerCount: undefined, postType: 'STORY' as const },
      ];

      const dataPoints = generateDataPoints(posts);

      expect(dataPoints.length).toBe(1);
      expect(dataPoints[0].count).toBe(1000);
    });

    test('should exclude posts with undefined followerCount', () => {
      const posts = [
        { postedAt: '2024-01-15T03:00:00Z', followerCount: undefined, postType: 'STORY' as const },
        { postedAt: '2024-01-16T03:00:00Z', followerCount: 500, postType: 'FEED' as const },
      ];

      const dataPoints = generateDataPoints(posts);

      expect(dataPoints.length).toBe(1);
      expect(dataPoints[0].count).toBe(500);
    });

    test('should include posts with followerCount = 0', () => {
      const posts = [
        { postedAt: '2024-01-15T03:00:00Z', followerCount: 0, postType: 'STORY' as const },
      ];

      const dataPoints = generateDataPoints(posts);

      expect(dataPoints.length).toBe(1);
      expect(dataPoints[0].count).toBe(0);
    });

    test('should sort data points by date in ascending order', () => {
      const posts = [
        { postedAt: '2024-03-01T03:00:00Z', followerCount: 3000, postType: 'FEED' as const },
        { postedAt: '2024-01-15T03:00:00Z', followerCount: 1000, postType: 'STORY' as const },
        { postedAt: '2024-02-10T03:00:00Z', followerCount: 2000, postType: 'FEED' as const },
      ];

      const dataPoints = generateDataPoints(posts);

      expect(dataPoints.length).toBe(3);
      expect(dataPoints[0].date).toBe('2024-01-15');
      expect(dataPoints[1].date).toBe('2024-02-10');
      expect(dataPoints[2].date).toBe('2024-03-01');
    });

    test('should extract date as YYYY-MM-DD from ISO string', () => {
      const posts = [
        { postedAt: '2024-01-15T03:00:00.000Z', followerCount: 1000, postType: 'STORY' as const },
      ];

      const dataPoints = generateDataPoints(posts);

      expect(dataPoints[0].date).toBe('2024-01-15');
    });

    test('should preserve postType in data points', () => {
      const posts = [
        { postedAt: '2024-01-15T03:00:00Z', followerCount: 1000, postType: 'STORY' as const },
        { postedAt: '2024-01-16T03:00:00Z', followerCount: 2000, postType: 'FEED' as const },
      ];

      const dataPoints = generateDataPoints(posts);

      expect(dataPoints[0].postType).toBe('STORY');
      expect(dataPoints[1].postType).toBe('FEED');
    });

    test('should return empty array when all posts have null followerCount', () => {
      const posts = [
        { postedAt: '2024-01-15T03:00:00Z', followerCount: null, postType: 'STORY' as const },
        { postedAt: '2024-01-16T03:00:00Z', followerCount: null, postType: 'FEED' as const },
      ];

      const dataPoints = generateDataPoints(posts);

      expect(dataPoints.length).toBe(0);
    });

    test('should return empty array for empty posts', () => {
      const dataPoints = generateDataPoints([]);
      expect(dataPoints.length).toBe(0);
    });
  });

  describe('19.2 グラフ座標計算テスト', () => {
    test('should calculate X coordinates correctly for multiple points', () => {
      const dataPoints: DataPoint[] = [
        { date: '2024-01-01', count: 100, postType: 'STORY' },
        { date: '2024-01-15', count: 200, postType: 'FEED' },
        { date: '2024-01-31', count: 300, postType: 'STORY' },
      ];

      const coords = calculateCoordinates(dataPoints);

      // First point should be at left padding
      expect(coords[0].x).toBe(PAD.left);
      // Last point should be at right edge
      expect(coords[2].x).toBe(W - PAD.right);
      // Middle point should be in between
      expect(coords[1].x).toBeGreaterThan(PAD.left);
      expect(coords[1].x).toBeLessThan(W - PAD.right);
    });

    test('should calculate Y coordinates correctly - max value at top', () => {
      const dataPoints: DataPoint[] = [
        { date: '2024-01-01', count: 100, postType: 'STORY' },
        { date: '2024-01-15', count: 1000, postType: 'FEED' },
      ];

      const coords = calculateCoordinates(dataPoints);

      // Higher count should have lower Y value (closer to top)
      expect(coords[1].y).toBeLessThan(coords[0].y);
    });

    test('should calculate Y coordinates correctly - min value at bottom', () => {
      const dataPoints: DataPoint[] = [
        { date: '2024-01-01', count: 100, postType: 'STORY' },
        { date: '2024-01-15', count: 1000, postType: 'FEED' },
      ];

      const coords = calculateCoordinates(dataPoints);

      // Min value should be at bottom (PAD.top + innerH)
      expect(coords[0].y).toBe(PAD.top + innerH);
      // Max value should be at top (PAD.top)
      expect(coords[1].y).toBe(PAD.top);
    });

    test('should handle single data point (centered X)', () => {
      const dataPoints: DataPoint[] = [
        { date: '2024-01-01', count: 500, postType: 'STORY' },
      ];

      const coords = calculateCoordinates(dataPoints);

      // Single point should be centered horizontally
      expect(coords[0].x).toBe(PAD.left + innerW / 2);
    });

    test('should handle all same count values (range = 1 fallback)', () => {
      const dataPoints: DataPoint[] = [
        { date: '2024-01-01', count: 500, postType: 'STORY' },
        { date: '2024-01-15', count: 500, postType: 'FEED' },
        { date: '2024-01-31', count: 500, postType: 'STORY' },
      ];

      const coords = calculateCoordinates(dataPoints);

      // All Y values should be the same (at bottom since range=1 and all values equal min)
      expect(coords[0].y).toBe(coords[1].y);
      expect(coords[1].y).toBe(coords[2].y);
    });

    test('should return empty array for empty data points', () => {
      const coords = calculateCoordinates([]);
      expect(coords.length).toBe(0);
    });

    test('should scale Y coordinates within graph bounds', () => {
      const dataPoints: DataPoint[] = [
        { date: '2024-01-01', count: 0, postType: 'STORY' },
        { date: '2024-01-15', count: 99999999, postType: 'FEED' },
      ];

      const coords = calculateCoordinates(dataPoints);

      // All Y values should be within graph bounds
      coords.forEach((c) => {
        expect(c.y).toBeGreaterThanOrEqual(PAD.top);
        expect(c.y).toBeLessThanOrEqual(PAD.top + innerH);
      });
    });

    test('should evenly space X coordinates', () => {
      const dataPoints: DataPoint[] = [
        { date: '2024-01-01', count: 100, postType: 'STORY' },
        { date: '2024-01-10', count: 200, postType: 'FEED' },
        { date: '2024-01-20', count: 300, postType: 'STORY' },
        { date: '2024-01-31', count: 400, postType: 'FEED' },
      ];

      const coords = calculateCoordinates(dataPoints);

      // X spacing should be equal between consecutive points
      const spacing1 = coords[1].x - coords[0].x;
      const spacing2 = coords[2].x - coords[1].x;
      const spacing3 = coords[3].x - coords[2].x;

      expect(Math.abs(spacing1 - spacing2)).toBeLessThan(0.001);
      expect(Math.abs(spacing2 - spacing3)).toBeLessThan(0.001);
    });
  });
});
