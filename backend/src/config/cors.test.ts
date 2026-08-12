import { describe, expect, it } from 'vitest';
import {
  CHATGPT_ORIGIN,
  isChatGptConnectionPath,
  isCorsOriginAllowed,
} from './cors';

const productionInput = {
  allowedOrigins: ['https://clearbase.example.com'],
  isDevelopment: false,
};

describe('ClearBase CORS policy', () => {
  it.each([
    '/mcp',
    '/oauth/register',
    '/oauth/authorize',
    '/oauth/token',
    '/oauth/revoke',
    '/.well-known/oauth-authorization-server',
    '/.well-known/oauth-protected-resource',
    '/.well-known/oauth-protected-resource/mcp',
  ])('allows ChatGPT only on connection path %s', (path) => {
    expect(isChatGptConnectionPath(path)).toBe(true);
    expect(
      isCorsOriginAllowed({ origin: CHATGPT_ORIGIN, path, ...productionInput })
    ).toBe(true);
  });

  it.each(['/api/users', '/api/schedules', '/health', '/oauthish/token'])(
    'blocks ChatGPT from normal ClearBase path %s',
    (path) => {
      expect(isChatGptConnectionPath(path)).toBe(false);
      expect(
        isCorsOriginAllowed({ origin: CHATGPT_ORIGIN, path, ...productionInput })
      ).toBe(false);
    }
  );

  it('keeps the configured frontend origin available on every route', () => {
    expect(
      isCorsOriginAllowed({
        origin: 'https://clearbase.example.com',
        path: '/api/users',
        ...productionInput,
      })
    ).toBe(true);
  });

  it('allows requests without a browser origin and development origins', () => {
    expect(
      isCorsOriginAllowed({
        origin: undefined,
        path: '/api/users',
        ...productionInput,
      })
    ).toBe(true);
    expect(
      isCorsOriginAllowed({
        origin: 'http://localhost:5173',
        path: '/api/users',
        allowedOrigins: [],
        isDevelopment: true,
      })
    ).toBe(true);
  });

  it('rejects lookalike ChatGPT origins', () => {
    expect(
      isCorsOriginAllowed({
        origin: 'https://evil.chatgpt.com',
        path: '/oauth/token',
        ...productionInput,
      })
    ).toBe(false);
  });
});
