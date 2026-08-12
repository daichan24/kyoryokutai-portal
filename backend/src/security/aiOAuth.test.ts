import { describe, expect, it } from 'vitest';
import { isAllowedRedirectUri, pkceChallenge } from '../routes/aiOAuth';

describe('AI OAuth security', () => {
  it('accepts ChatGPT callback URLs and rejects open redirects', () => {
    expect(isAllowedRedirectUri('https://chatgpt.com/connector/oauth/test-callback')).toBe(true);
    expect(isAllowedRedirectUri('https://chatgpt.com/connector_platform_oauth_redirect')).toBe(
      true
    );
    expect(isAllowedRedirectUri('https://evil.example/connector/oauth/test-callback')).toBe(false);
    expect(
      isAllowedRedirectUri('https://chatgpt.com.evil.example/connector/oauth/test-callback')
    ).toBe(false);
    expect(isAllowedRedirectUri('https://user@chatgpt.com/connector/oauth/test-callback')).toBe(
      false
    );
    expect(isAllowedRedirectUri('https://chatgpt.com/connector/oauth/test#fragment')).toBe(false);
  });

  it('derives an RFC 7636 compatible S256 PKCE challenge', () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    expect(pkceChallenge(verifier)).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
});
