import { z } from 'zod';
import { describe, test, expect } from 'vitest';

// Extract the note validation schema from snsPosts.ts
const noteField = z.string().max(2000).optional();

describe('Note Length Validation', () => {
  describe('Valid note lengths', () => {
    test('should accept empty string', () => {
      const result = noteField.safeParse('');
      expect(result.success).toBe(true);
    });

    test('should accept undefined', () => {
      const result = noteField.safeParse(undefined);
      expect(result.success).toBe(true);
    });

    test('should accept short note', () => {
      const result = noteField.safeParse('This is a short note');
      expect(result.success).toBe(true);
    });

    test('should accept note with exactly 2000 characters', () => {
      const note = 'a'.repeat(2000);
      const result = noteField.safeParse(note);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.length).toBe(2000);
      }
    });

    test('should accept note with 1999 characters', () => {
      const note = 'a'.repeat(1999);
      const result = noteField.safeParse(note);
      expect(result.success).toBe(true);
    });

    test('should accept note with 1 character', () => {
      const result = noteField.safeParse('a');
      expect(result.success).toBe(true);
    });

    test('should accept note with Japanese characters', () => {
      const note = 'これは日本語のメモです。'.repeat(100); // ~1300 chars
      const result = noteField.safeParse(note);
      expect(result.success).toBe(true);
    });

    test('should accept note with emojis', () => {
      const note = '😀'.repeat(100);
      const result = noteField.safeParse(note);
      expect(result.success).toBe(true);
    });

    test('should accept note with newlines', () => {
      const note = 'Line 1\nLine 2\nLine 3\n'.repeat(50);
      const result = noteField.safeParse(note);
      expect(result.success).toBe(true);
    });
  });

  describe('Invalid note lengths', () => {
    test('should reject note with 2001 characters', () => {
      const note = 'a'.repeat(2001);
      const result = noteField.safeParse(note);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('too_big');
        expect(result.error.issues[0].maximum).toBe(2000);
      }
    });

    test('should reject note with 2002 characters', () => {
      const note = 'a'.repeat(2002);
      const result = noteField.safeParse(note);
      expect(result.success).toBe(false);
    });

    test('should reject note with 3000 characters', () => {
      const note = 'a'.repeat(3000);
      const result = noteField.safeParse(note);
      expect(result.success).toBe(false);
    });

    test('should reject very long note (10000 characters)', () => {
      const note = 'a'.repeat(10000);
      const result = noteField.safeParse(note);
      expect(result.success).toBe(false);
    });
  });

  describe('Edge cases', () => {
    test('should count multi-byte characters correctly', () => {
      // Japanese characters are counted as 1 character each, not by byte size
      const note = 'あ'.repeat(2000);
      const result = noteField.safeParse(note);
      expect(result.success).toBe(true);
    });

    test('should reject multi-byte characters over limit', () => {
      const note = 'あ'.repeat(2001);
      const result = noteField.safeParse(note);
      expect(result.success).toBe(false);
    });

    test('should count emojis correctly', () => {
      // Some emojis are composed of multiple code points
      // Family emoji '👨‍👩‍👧‍👦' is actually 7 code points (counts as 7 characters)
      const note = '😀'.repeat(500); // Simple emoji, 1 code point each
      const result = noteField.safeParse(note);
      expect(result.success).toBe(true);
    });

    test('should handle note with only whitespace', () => {
      const note = ' '.repeat(2000);
      const result = noteField.safeParse(note);
      expect(result.success).toBe(true);
    });

    test('should reject note with only whitespace over limit', () => {
      const note = ' '.repeat(2001);
      const result = noteField.safeParse(note);
      expect(result.success).toBe(false);
    });

    test('should handle note with mixed content at boundary', () => {
      const note = 'a'.repeat(1000) + '日本語'.repeat(200) + '😀'.repeat(100);
      const result = noteField.safeParse(note);
      // Total should be 1000 + 600 + 100 = 1700 characters
      expect(result.success).toBe(true);
    });
  });
});
