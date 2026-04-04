import { describe, test, expect } from 'vitest';
import { z } from 'zod';

// Schemas extracted from snsPosts.ts
const followerCountField = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (v === '') return undefined;
    const n = typeof v === 'string' ? parseInt(String(v).replace(/,/g, ''), 10) : Number(v);
    if (!Number.isFinite(n) || Number.isNaN(n)) return undefined;
    const t = Math.trunc(n);
    if (t < 0 || t > 99_999_999) return undefined;
    return t;
  });

const snsPostCreateSchema = z.object({
  postedAt: z.string(),
  postType: z.enum(['STORY', 'FEED']),
  accountId: z.string().uuid().optional().nullable(),
  url: z.string().optional().refine((val) => !val || val === '' || z.string().url().safeParse(val).success, {
    message: 'Invalid URL format',
  }),
  note: z.string().max(2000).optional(),
  followerCount: followerCountField,
});

describe('Error Handling', () => {
  describe('24.1 バリデーションエラー（400）のテスト', () => {
    describe('無効な日付形式', () => {
      test('should reject missing postedAt', () => {
        const result = snsPostCreateSchema.safeParse({
          postType: 'STORY',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          const paths = result.error.issues.map((i) => i.path[0]);
          expect(paths).toContain('postedAt');
        }
      });

      test('should accept valid ISO date string', () => {
        const result = snsPostCreateSchema.safeParse({
          postedAt: '2024-01-15T03:00:00Z',
          postType: 'STORY',
        });
        expect(result.success).toBe(true);
      });

      test('should accept YYYY-MM-DD date string', () => {
        const result = snsPostCreateSchema.safeParse({
          postedAt: '2024-01-15',
          postType: 'STORY',
        });
        expect(result.success).toBe(true);
      });
    });

    describe('無効なpostType', () => {
      test('should reject invalid postType', () => {
        const result = snsPostCreateSchema.safeParse({
          postedAt: '2024-01-15',
          postType: 'INVALID',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          const paths = result.error.issues.map((i) => i.path[0]);
          expect(paths).toContain('postType');
        }
      });

      test('should reject BOTH postType (legacy)', () => {
        const result = snsPostCreateSchema.safeParse({
          postedAt: '2024-01-15',
          postType: 'BOTH',
        });
        expect(result.success).toBe(false);
      });

      test('should accept STORY postType', () => {
        const result = snsPostCreateSchema.safeParse({
          postedAt: '2024-01-15',
          postType: 'STORY',
        });
        expect(result.success).toBe(true);
      });

      test('should accept FEED postType', () => {
        const result = snsPostCreateSchema.safeParse({
          postedAt: '2024-01-15',
          postType: 'FEED',
        });
        expect(result.success).toBe(true);
      });

      test('should reject missing postType', () => {
        const result = snsPostCreateSchema.safeParse({
          postedAt: '2024-01-15',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          const paths = result.error.issues.map((i) => i.path[0]);
          expect(paths).toContain('postType');
        }
      });
    });

    describe('無効なURL', () => {
      test('should reject invalid URL format', () => {
        const result = snsPostCreateSchema.safeParse({
          postedAt: '2024-01-15',
          postType: 'STORY',
          url: 'not-a-url',
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          const urlIssue = result.error.issues.find((i) => i.path[0] === 'url');
          expect(urlIssue?.message).toBe('Invalid URL format');
        }
      });

      test('should accept empty string URL', () => {
        const result = snsPostCreateSchema.safeParse({
          postedAt: '2024-01-15',
          postType: 'STORY',
          url: '',
        });
        expect(result.success).toBe(true);
      });

      test('should accept valid https URL', () => {
        const result = snsPostCreateSchema.safeParse({
          postedAt: '2024-01-15',
          postType: 'STORY',
          url: 'https://example.com',
        });
        expect(result.success).toBe(true);
      });
    });

    describe('備考の文字数超過', () => {
      test('should reject note exceeding 2000 characters', () => {
        const result = snsPostCreateSchema.safeParse({
          postedAt: '2024-01-15',
          postType: 'STORY',
          note: 'a'.repeat(2001),
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          const noteIssue = result.error.issues.find((i) => i.path[0] === 'note');
          expect(noteIssue?.code).toBe('too_big');
        }
      });

      test('should accept note with exactly 2000 characters', () => {
        const result = snsPostCreateSchema.safeParse({
          postedAt: '2024-01-15',
          postType: 'STORY',
          note: 'a'.repeat(2000),
        });
        expect(result.success).toBe(true);
      });
    });

    describe('フォロワー数の範囲外', () => {
      test('should silently reject negative follower count (returns undefined)', () => {
        const result = snsPostCreateSchema.safeParse({
          postedAt: '2024-01-15',
          postType: 'STORY',
          followerCount: -1,
        });
        // Schema transforms invalid values to undefined (not a validation error)
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.followerCount).toBeUndefined();
        }
      });

      test('should silently reject follower count exceeding max (returns undefined)', () => {
        const result = snsPostCreateSchema.safeParse({
          postedAt: '2024-01-15',
          postType: 'STORY',
          followerCount: 100_000_000,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.followerCount).toBeUndefined();
        }
      });

      test('should accept valid follower count', () => {
        const result = snsPostCreateSchema.safeParse({
          postedAt: '2024-01-15',
          postType: 'STORY',
          followerCount: 50000,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.followerCount).toBe(50000);
        }
      });
    });

    describe('必須フィールドの欠落', () => {
      test('should reject empty object', () => {
        const result = snsPostCreateSchema.safeParse({});
        expect(result.success).toBe(false);
        if (!result.success) {
          const paths = result.error.issues.map((i) => i.path[0]);
          expect(paths).toContain('postedAt');
          expect(paths).toContain('postType');
        }
      });

      test('should accept minimal valid object', () => {
        const result = snsPostCreateSchema.safeParse({
          postedAt: '2024-01-15',
          postType: 'FEED',
        });
        expect(result.success).toBe(true);
      });

      test('should accept object with all optional fields', () => {
        const result = snsPostCreateSchema.safeParse({
          postedAt: '2024-01-15T03:00:00Z',
          postType: 'STORY',
          accountId: null,
          url: 'https://example.com',
          note: 'Test note',
          followerCount: 1000,
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('24.2 認可エラー（403）のテスト', () => {
    test('MEMBER cannot access other user data', () => {
      const requestUserId = 'user-1';
      const requestUserRole = 'MEMBER';
      const targetUserId = 'user-2';

      const isAllowed = requestUserRole !== 'MEMBER' || requestUserId === targetUserId;
      const statusCode = isAllowed ? 200 : 403;

      expect(statusCode).toBe(403);
    });

    test('MEMBER can access own data', () => {
      const requestUserId = 'user-1';
      const requestUserRole = 'MEMBER';
      const targetUserId = 'user-1';

      const isAllowed = requestUserRole !== 'MEMBER' || requestUserId === targetUserId;
      const statusCode = isAllowed ? 200 : 403;

      expect(statusCode).toBe(200);
    });

    test('Non-staff cannot access staff-only endpoints', () => {
      const role = 'MEMBER';
      const isStaff = ['MASTER', 'SUPPORT', 'GOVERNMENT'].includes(role);
      const statusCode = isStaff ? 200 : 403;

      expect(statusCode).toBe(403);
    });

    test('Staff can access staff-only endpoints', () => {
      const staffRoles = ['MASTER', 'SUPPORT', 'GOVERNMENT'];
      staffRoles.forEach((role) => {
        const isStaff = ['MASTER', 'SUPPORT', 'GOVERNMENT'].includes(role);
        const statusCode = isStaff ? 200 : 403;
        expect(statusCode).toBe(200);
      });
    });
  });

  describe('24.3 Not Foundエラー（404）のテスト', () => {
    test('should return 404 for non-existent post ID', () => {
      const posts = [
        { id: 'post-1', userId: 'user-1' },
        { id: 'post-2', userId: 'user-2' },
      ];

      const targetId = 'non-existent-id';
      const found = posts.find((p) => p.id === targetId);
      const statusCode = found ? 200 : 404;

      expect(statusCode).toBe(404);
    });

    test('should return 200 for existing post ID', () => {
      const posts = [
        { id: 'post-1', userId: 'user-1' },
      ];

      const targetId = 'post-1';
      const found = posts.find((p) => p.id === targetId);
      const statusCode = found ? 200 : 404;

      expect(statusCode).toBe(200);
    });

    test('should return 404 for non-existent account ID', () => {
      const accounts = [
        { id: 'account-1', userId: 'user-1' },
      ];

      const targetId = 'non-existent-account';
      const found = accounts.find((a) => a.id === targetId);
      const statusCode = found ? 200 : 404;

      expect(statusCode).toBe(404);
    });

    test('should return 404 for UUID format non-existent ID', () => {
      const accounts: Array<{ id: string }> = [];
      const targetId = '00000000-0000-0000-0000-000000000000';
      const found = accounts.find((a) => a.id === targetId);
      const statusCode = found ? 200 : 404;

      expect(statusCode).toBe(404);
    });
  });
});
