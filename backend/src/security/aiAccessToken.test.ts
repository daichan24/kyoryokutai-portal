import { describe, expect, it } from 'vitest';
import {
  createAiAccessTokenValue,
  createAiOAuthAccessTokenValue,
  createAiOAuthRefreshTokenValue,
  hashAiAccessToken,
  isAiAccessToken,
  isAiOAuthAccessToken,
} from './aiAccessToken';

describe('AI access token', () => {
  it('stores only a stable hash and a non-secret display prefix', () => {
    const generated = createAiAccessTokenValue();
    expect(generated.token).toMatch(/^cbai_[a-f0-9]{10}_[A-Za-z0-9_-]{40,}$/);
    expect(generated.tokenPrefix).toMatch(/^cbai_[a-f0-9]{10}$/);
    expect(generated.tokenHash).toBe(hashAiAccessToken(generated.token));
    expect(generated.tokenHash).not.toContain(generated.token);
  });

  it('creates unique credentials and identifies only ClearBase AI tokens', () => {
    const first = createAiAccessTokenValue();
    const second = createAiAccessTokenValue();
    expect(first.token).not.toBe(second.token);
    expect(isAiAccessToken(first.token)).toBe(true);
    expect(isAiAccessToken('normal-login-password')).toBe(false);
  });

  it('uses separate opaque OAuth access and refresh token formats', () => {
    const access = createAiOAuthAccessTokenValue();
    const refresh = createAiOAuthRefreshTokenValue();
    expect(access.token).toMatch(/^cboa_[a-f0-9]{10}_[A-Za-z0-9_-]{40,}$/);
    expect(refresh.token).toMatch(/^cbor_[a-f0-9]{10}_[A-Za-z0-9_-]{40,}$/);
    expect(isAiOAuthAccessToken(access.token)).toBe(true);
    expect(isAiAccessToken(access.token)).toBe(true);
    expect(isAiAccessToken(refresh.token)).toBe(false);
  });
});
