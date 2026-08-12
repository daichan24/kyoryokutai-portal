import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  assertProductionSecurityConfiguration,
  getGoogleTokenDecryptionSecrets,
  getJwtSecret,
  isPublicRegistrationAllowed,
} from './security';

const ORIGINAL_ENV = { ...process.env };

describe.sequential('production security configuration', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.JWT_SECRET;
    delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
    delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY_PREVIOUS;
    delete process.env.ALLOW_PUBLIC_REGISTRATION;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('rejects a production boot without a JWT secret', () => {
    process.env.NODE_ENV = 'production';
    expect(() => assertProductionSecurityConfiguration()).toThrow(/JWT_SECRET/);

    process.env.JWT_SECRET = 'production-jwt-secret-that-is-long-enough-123';
    expect(() => assertProductionSecurityConfiguration()).not.toThrow();
  });

  it('accepts dedicated production secrets and supports explicit key rotation', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'production-jwt-secret-that-is-long-enough-123';
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY = 'current-google-key-that-is-long-enough-456';
    process.env.GOOGLE_TOKEN_ENCRYPTION_KEY_PREVIOUS = 'previous-google-key-that-is-long-enough-789';

    expect(() => assertProductionSecurityConfiguration()).not.toThrow();
    expect(getGoogleTokenDecryptionSecrets()).toEqual([
      'current-google-key-that-is-long-enough-456',
      'previous-google-key-that-is-long-enough-789',
    ]);
  });

  it('uses a clearly development-only JWT secret outside production', () => {
    process.env.NODE_ENV = 'test';
    expect(getJwtSecret()).toContain('development-only');
  });

  it('never enables public registration in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_PUBLIC_REGISTRATION = 'true';
    expect(isPublicRegistrationAllowed()).toBe(false);
  });
});
