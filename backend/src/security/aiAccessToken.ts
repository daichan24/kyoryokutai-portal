import crypto from 'crypto';

const TOKEN_PREFIX = 'cbai';

export function hashAiAccessToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createAiAccessTokenValue(): { token: string; tokenPrefix: string; tokenHash: string } {
  const publicPrefix = crypto.randomBytes(5).toString('hex');
  const secret = crypto.randomBytes(32).toString('base64url');
  const token = `${TOKEN_PREFIX}_${publicPrefix}_${secret}`;
  return {
    token,
    tokenPrefix: `${TOKEN_PREFIX}_${publicPrefix}`,
    tokenHash: hashAiAccessToken(token),
  };
}

export function isAiAccessToken(token: string): boolean {
  return token.startsWith(`${TOKEN_PREFIX}_`);
}
