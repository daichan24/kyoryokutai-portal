const DEVELOPMENT_JWT_SECRET = 'clearbase-development-only-secret-do-not-use-in-production';

export function getJwtSecret(): string {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured) {
    if (
      process.env.NODE_ENV === 'production'
      && (configured.length < 32 || configured === 'secret' || configured.startsWith('your-secret'))
    ) {
      throw new Error('JWT_SECRET must be a strong random value of at least 32 characters in production');
    }
    return configured;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured in production');
  }

  return DEVELOPMENT_JWT_SECRET;
}

export function getGoogleTokenEncryptionSecret(): string {
  const configured = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY?.trim();
  if (configured) {
    if (process.env.NODE_ENV === 'production') {
      if (configured.length < 32 || configured.startsWith('change-me')) {
        throw new Error('GOOGLE_TOKEN_ENCRYPTION_KEY must be a strong random value of at least 32 characters');
      }
    }
    return configured;
  }

  // Existing deployments historically derived this key from JWT_SECRET.
  // Keep that path for a non-breaking migration; new deployments should set a dedicated key.
  return getJwtSecret();
}

export function getGoogleTokenDecryptionSecrets(): string[] {
  const current = getGoogleTokenEncryptionSecret();
  const previous = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY_PREVIOUS?.trim();
  return previous && previous !== current ? [current, previous] : [current];
}

export function assertProductionSecurityConfiguration(): void {
  getJwtSecret();
  getGoogleTokenEncryptionSecret();
}

export function isPublicRegistrationAllowed(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ALLOW_PUBLIC_REGISTRATION === 'true';
}
