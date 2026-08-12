import { describe, expect, it } from 'vitest';
import { isSessionPasswordVersionValid } from './sessionVersion';

describe('session password version', () => {
  it('accepts an exact password version and rejects a changed password', () => {
    const current = new Date('2026-08-12T00:00:00.123Z');
    expect(isSessionPasswordVersionValid({ passwordUpdatedAt: current.getTime() }, current)).toBe(true);
    expect(isSessionPasswordVersionValid({ passwordUpdatedAt: current.getTime() - 1 }, current)).toBe(false);
  });

  it('supports legacy JWTs while invalidating those issued before a password change', () => {
    expect(isSessionPasswordVersionValid({ iat: 100 }, new Date(102_000))).toBe(false);
    expect(isSessionPasswordVersionValid({ iat: 102 }, new Date(102_000))).toBe(true);
  });
});
