import crypto from 'crypto';

const TOKEN_PREFIX = 'cbai';
const OAUTH_ACCESS_TOKEN_PREFIX = 'cboa';
const OAUTH_REFRESH_TOKEN_PREFIX = 'cbor';

export function hashAiAccessToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createAiAccessTokenValue(): {
  token: string;
  tokenPrefix: string;
  tokenHash: string;
} {
  const publicPrefix = crypto.randomBytes(5).toString('hex');
  const secret = crypto.randomBytes(32).toString('base64url');
  const token = `${TOKEN_PREFIX}_${publicPrefix}_${secret}`;
  return {
    token,
    tokenPrefix: `${TOKEN_PREFIX}_${publicPrefix}`,
    tokenHash: hashAiAccessToken(token),
  };
}

function createPrefixedToken(prefix: string): {
  token: string;
  tokenPrefix: string;
  tokenHash: string;
} {
  const publicPrefix = crypto.randomBytes(5).toString('hex');
  const secret = crypto.randomBytes(32).toString('base64url');
  const token = `${prefix}_${publicPrefix}_${secret}`;
  return {
    token,
    tokenPrefix: `${prefix}_${publicPrefix}`,
    tokenHash: hashAiAccessToken(token),
  };
}

export function createAiOAuthAccessTokenValue() {
  return createPrefixedToken(OAUTH_ACCESS_TOKEN_PREFIX);
}

export function createAiOAuthRefreshTokenValue() {
  return createPrefixedToken(OAUTH_REFRESH_TOKEN_PREFIX);
}

export function isAiOAuthAccessToken(token: string): boolean {
  return token.startsWith(`${OAUTH_ACCESS_TOKEN_PREFIX}_`);
}

export function isAiAccessToken(token: string): boolean {
  return token.startsWith(`${TOKEN_PREFIX}_`) || isAiOAuthAccessToken(token);
}
