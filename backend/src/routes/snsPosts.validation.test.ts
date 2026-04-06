import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Tests for SNS Post validation rules
 * 
 * These tests validate the Zod schema rules used in snsPosts.ts
 * without requiring a full API integration test.
 */

describe('SNS Post Validation', () => {
  describe('note length validation', () => {
    // Recreate the note validation schema from snsPosts.ts
    const noteSchema = z.string().max(2000).optional();

    it('should accept note with exactly 2000 characters', () => {
      const note = 'a'.repeat(2000);
      const result = noteSchema.safeParse(note);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(note);
      }
    });

    it('should accept note with less than 2000 characters', () => {
      const note = 'a'.repeat(1999);
      const result = noteSchema.safeParse(note);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(note);
      }
    });

    it('should accept note with 1 character', () => {
      const note = 'a';
      const result = noteSchema.safeParse(note);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(note);
      }
    });

    it('should accept empty string', () => {
      const note = '';
      const result = noteSchema.safeParse(note);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe(note);
      }
    });

    it('should accept undefined (optional field)', () => {
      const result = noteSchema.safeParse(undefined);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeUndefined();
      }
    });

    it('should reject note with exactly 2001 characters', () => {
      const note = 'a'.repeat(2001);
      const result = noteSchema.safeParse(note);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('too_big');
        expect(result.error.issues[0].maximum).toBe(2000);
      }
    });

    it('should reject note with more than 2001 characters', () => {
      const note = 'a'.repeat(3000);
      const result = noteSchema.safeParse(note);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('too_big');
        expect(result.error.issues[0].maximum).toBe(2000);
      }
    });

    it('should handle multi-byte characters correctly', () => {
      // Japanese characters (each character is multiple bytes in UTF-8)
      // But Zod counts by character length, not byte length
      const note = '日本語'.repeat(666) + '日本'; // 666*3 + 2 = 2000 characters
      expect(note.length).toBe(2000);
      
      const result = noteSchema.safeParse(note);
      expect(result.success).toBe(true);
    });

    it('should reject multi-byte characters exceeding 2000 character limit', () => {
      const note = '日本語'.repeat(667) + '日'; // 667*3 + 1 = 2002 characters
      expect(note.length).toBe(2002);
      
      const result = noteSchema.safeParse(note);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].code).toBe('too_big');
      }
    });

    it('should handle emoji correctly', () => {
      // Emojis like 😀 are surrogate pairs and count as 2 in JavaScript string length
      const note = '😀'.repeat(1000); // 1000 * 2 = 2000 characters
      expect(note.length).toBe(2000);
      
      const result = noteSchema.safeParse(note);
      expect(result.success).toBe(true);
    });

    it('should reject emoji exceeding 2000 character limit', () => {
      const note = '😀'.repeat(1001); // 1001 * 2 = 2002 characters
      expect(note.length).toBe(2002);
      
      const result = noteSchema.safeParse(note);
      expect(result.success).toBe(false);
    });

    it('should handle newlines and special characters', () => {
      const note = 'Line 1\nLine 2\r\nLine 3\tTabbed'.repeat(100);
      
      if (note.length <= 2000) {
        const result = noteSchema.safeParse(note);
        expect(result.success).toBe(true);
      } else {
        const result = noteSchema.safeParse(note);
        expect(result.success).toBe(false);
      }
    });
  });
});
