import { z } from 'zod';

// Extract the followerCountField schema from snsPosts.ts
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

describe('Follower Count Validation', () => {
  describe('Valid inputs', () => {
    test('should accept 0', () => {
      const result = followerCountField.parse(0);
      expect(result).toBe(0);
    });

    test('should accept 1000', () => {
      const result = followerCountField.parse(1000);
      expect(result).toBe(1000);
    });

    test('should accept 99999999 (max value)', () => {
      const result = followerCountField.parse(99999999);
      expect(result).toBe(99999999);
    });

    test('should accept string "1000"', () => {
      const result = followerCountField.parse('1000');
      expect(result).toBe(1000);
    });

    test('should accept null', () => {
      const result = followerCountField.parse(null);
      expect(result).toBe(null);
    });

    test('should accept undefined', () => {
      const result = followerCountField.parse(undefined);
      expect(result).toBe(undefined);
    });

    test('should accept empty string and return undefined', () => {
      const result = followerCountField.parse('');
      expect(result).toBe(undefined);
    });
  });

  describe('Comma-separated inputs', () => {
    test('should accept "1,000" and parse to 1000', () => {
      const result = followerCountField.parse('1,000');
      expect(result).toBe(1000);
    });

    test('should accept "10,000,000" and parse to 10000000', () => {
      const result = followerCountField.parse('10,000,000');
      expect(result).toBe(10000000);
    });

    test('should accept "99,999,999" and parse to 99999999', () => {
      const result = followerCountField.parse('99,999,999');
      expect(result).toBe(99999999);
    });

    test('should accept "1,234,567" and parse to 1234567', () => {
      const result = followerCountField.parse('1,234,567');
      expect(result).toBe(1234567);
    });
  });

  describe('Boundary values', () => {
    test('should reject -1 (negative)', () => {
      const result = followerCountField.parse(-1);
      expect(result).toBe(undefined);
    });

    test('should reject 100000000 (exceeds max)', () => {
      const result = followerCountField.parse(100000000);
      expect(result).toBe(undefined);
    });

    test('should reject "-1" as string', () => {
      const result = followerCountField.parse('-1');
      expect(result).toBe(undefined);
    });

    test('should reject "100000000" as string', () => {
      const result = followerCountField.parse('100000000');
      expect(result).toBe(undefined);
    });
  });

  describe('Invalid inputs', () => {
    test('should reject non-numeric string "abc"', () => {
      const result = followerCountField.parse('abc');
      expect(result).toBe(undefined);
    });

    test('should parse "123abc" as 123 (parseInt behavior)', () => {
      // Note: parseInt stops at first non-numeric character
      const result = followerCountField.parse('123abc');
      expect(result).toBe(123);
    });

    test('should throw ZodError for NaN', () => {
      // NaN is rejected by Zod union before reaching transform
      expect(() => followerCountField.parse(NaN)).toThrow();
    });

    test('should reject Infinity', () => {
      const result = followerCountField.parse(Infinity);
      expect(result).toBe(undefined);
    });

    test('should reject -Infinity', () => {
      const result = followerCountField.parse(-Infinity);
      expect(result).toBe(undefined);
    });

    test('should handle decimal numbers by truncating', () => {
      const result = followerCountField.parse(1234.56);
      expect(result).toBe(1234);
    });

    test('should handle string decimal numbers by truncating', () => {
      const result = followerCountField.parse('1234.56');
      expect(result).toBe(1234);
    });
  });

  describe('Edge cases', () => {
    test('should handle string with spaces', () => {
      const result = followerCountField.parse('  1000  ');
      expect(result).toBe(1000);
    });

    test('should handle string with commas and spaces', () => {
      const result = followerCountField.parse(' 1,000 ');
      expect(result).toBe(1000);
    });

    test('should handle zero as string', () => {
      const result = followerCountField.parse('0');
      expect(result).toBe(0);
    });

    test('should handle max value as string with commas', () => {
      const result = followerCountField.parse('99,999,999');
      expect(result).toBe(99999999);
    });
  });
});
