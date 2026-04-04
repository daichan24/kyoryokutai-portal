import { z } from 'zod';
import { describe, test, expect } from 'vitest';

// Extract the URL validation schema from snsPosts.ts
// This matches the validation logic in snsPostCreateSchema
const urlField = z
  .string()
  .optional()
  .refine((val) => !val || val === '' || z.string().url().safeParse(val).success, {
    message: 'Invalid URL format',
  });

describe('URL Validation', () => {
  describe('Valid URLs', () => {
    test('should accept valid http URL', () => {
      const result = urlField.safeParse('http://example.com');
      expect(result.success).toBe(true);
    });

    test('should accept valid https URL', () => {
      const result = urlField.safeParse('https://example.com');
      expect(result.success).toBe(true);
    });

    test('should accept URL with path', () => {
      const result = urlField.safeParse('https://example.com/path/to/post');
      expect(result.success).toBe(true);
    });

    test('should accept URL with query parameters', () => {
      const result = urlField.safeParse('https://example.com/post?id=123&ref=twitter');
      expect(result.success).toBe(true);
    });

    test('should accept URL with fragment', () => {
      const result = urlField.safeParse('https://example.com/post#section');
      expect(result.success).toBe(true);
    });

    test('should accept URL with port', () => {
      const result = urlField.safeParse('https://example.com:8080/post');
      expect(result.success).toBe(true);
    });

    test('should accept URL with subdomain', () => {
      const result = urlField.safeParse('https://www.example.com');
      expect(result.success).toBe(true);
    });

    test('should accept URL with authentication', () => {
      const result = urlField.safeParse('https://user:pass@example.com');
      expect(result.success).toBe(true);
    });

    test('should accept common social media URLs', () => {
      const urls = [
        'https://twitter.com/user/status/123456789',
        'https://www.instagram.com/p/ABC123/',
        'https://www.facebook.com/user/posts/123456',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        'https://www.tiktok.com/@user/video/123456789',
      ];

      urls.forEach((url) => {
        const result = urlField.safeParse(url);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Empty string', () => {
    test('should accept empty string', () => {
      const result = urlField.safeParse('');
      expect(result.success).toBe(true);
    });

    test('should accept undefined', () => {
      const result = urlField.safeParse(undefined);
      expect(result.success).toBe(true);
    });
  });

  describe('Invalid URLs', () => {
    test('should reject URL without protocol', () => {
      const result = urlField.safeParse('example.com');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid URL format');
      }
    });

    test('should reject plain text', () => {
      const result = urlField.safeParse('not a url');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid URL format');
      }
    });

    test('should reject malformed URL', () => {
      const result = urlField.safeParse('https://');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid URL format');
      }
    });

    test('should reject URL with only protocol', () => {
      const result = urlField.safeParse('http://');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid URL format');
      }
    });

    test('should reject relative URL', () => {
      const result = urlField.safeParse('/path/to/resource');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid URL format');
      }
    });

    test('should reject just a slash', () => {
      const result = urlField.safeParse('/');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid URL format');
      }
    });
  });

  describe('Edge cases', () => {
    test('should accept URL with international domain', () => {
      const result = urlField.safeParse('https://例え.jp');
      expect(result.success).toBe(true);
    });

    test('should accept URL with encoded characters', () => {
      const result = urlField.safeParse('https://example.com/path%20with%20spaces');
      expect(result.success).toBe(true);
    });

    test('should accept localhost URL', () => {
      const result = urlField.safeParse('http://localhost:3000');
      expect(result.success).toBe(true);
    });

    test('should accept IP address URL', () => {
      const result = urlField.safeParse('http://192.168.1.1');
      expect(result.success).toBe(true);
    });

    test('should accept very long URL', () => {
      const longPath = 'a'.repeat(1000);
      const result = urlField.safeParse(`https://example.com/${longPath}`);
      expect(result.success).toBe(true);
    });

    // Note: Zod's URL validator uses JavaScript's URL constructor,
    // which is permissive and accepts various protocols (ftp, file, etc.)
    // and automatically encodes spaces and special characters
    test('should accept FTP URLs (URL constructor is permissive)', () => {
      const result = urlField.safeParse('ftp://example.com');
      expect(result.success).toBe(true);
    });

    test('should accept file URLs', () => {
      const result = urlField.safeParse('file:///path/to/file');
      expect(result.success).toBe(true);
    });
  });
});
