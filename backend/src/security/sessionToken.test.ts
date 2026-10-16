import jwt from 'jsonwebtoken';
import { beforeAll, describe, expect, it } from 'vitest';
import { SESSION_TOKEN_TTL_SECONDS, shouldRenewSessionToken, signSessionToken } from './sessionToken';

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret-for-session-token-0123456789';
});

describe('signSessionToken', () => {
  it('issues a token valid for 30 days with the password version claim', () => {
    const token = signSessionToken({ id: 'u1', email: 'a@b.test', role: 'MEMBER', passwordUpdatedAt: new Date(1000) });
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { iat: number; exp: number; passwordUpdatedAt: number };
    expect(decoded.exp - decoded.iat).toBe(SESSION_TOKEN_TTL_SECONDS);
    expect(SESSION_TOKEN_TTL_SECONDS).toBe(30 * 24 * 60 * 60);
    expect(decoded.passwordUpdatedAt).toBe(1000);
  });
});

describe('shouldRenewSessionToken', () => {
  it('renews only tokens issued more than a day ago', () => {
    const iat = 1_800_000_000;
    const token = jwt.sign({ id: 'u1', iat }, 'x');
    expect(shouldRenewSessionToken(token, (iat + 60 * 60) * 1000)).toBe(false);
    expect(shouldRenewSessionToken(token, (iat + 24 * 60 * 60) * 1000)).toBe(true);
  });
});
