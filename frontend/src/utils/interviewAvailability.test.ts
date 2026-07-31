import { describe, expect, it } from 'vitest';
import { canMemberEditInterviewAvailability } from './interviewAvailability';

describe('canMemberEditInterviewAvailability', () => {
  it('暫定案作成後も確定前なら回答できる', () => {
    expect(canMemberEditInterviewAvailability('COLLECTING')).toBe(true);
    expect(canMemberEditInterviewAvailability('PROPOSED')).toBe(true);
  });

  it('確定または取消後は回答できない', () => {
    expect(canMemberEditInterviewAvailability('CONFIRMED')).toBe(false);
    expect(canMemberEditInterviewAvailability('CANCELLED')).toBe(false);
  });
});
