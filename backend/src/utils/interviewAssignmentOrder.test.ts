import { describe, expect, test } from 'vitest';
import { isCompleteAssignmentOrder } from './interviewAssignmentOrder';

describe('interview assignment ordering', () => {
  test('accepts the same assignments in a different order', () => {
    expect(isCompleteAssignmentOrder(['a', 'b', 'c'], ['c', 'a', 'b'])).toBe(true);
  });

  test('rejects duplicate assignment ids', () => {
    expect(isCompleteAssignmentOrder(['a', 'b', 'c'], ['a', 'a', 'c'])).toBe(false);
  });

  test('rejects missing or unrelated assignment ids', () => {
    expect(isCompleteAssignmentOrder(['a', 'b'], ['a'])).toBe(false);
    expect(isCompleteAssignmentOrder(['a', 'b'], ['a', 'c'])).toBe(false);
  });
});
