import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/security';

/** ログイン状態の有効期間。最後に使ってからこの期間を過ぎると再ログインが必要 */
export const SESSION_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
/** 発行からこの時間を過ぎたトークンは /api/auth/me で新しいものに取り替える（1日1回程度） */
export const SESSION_TOKEN_RENEW_AFTER_SECONDS = 24 * 60 * 60;

export function signSessionToken(user: {
  id: string;
  email: string;
  role: string;
  passwordUpdatedAt: Date | null;
}): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      passwordUpdatedAt: user.passwordUpdatedAt?.getTime() ?? null,
    },
    getJwtSecret(),
    { expiresIn: SESSION_TOKEN_TTL_SECONDS },
  );
}

/** 有効なトークンが発行から一定時間たっていれば true（期限の自動延長に使う） */
export function shouldRenewSessionToken(token: string, nowMs: number = Date.now()): boolean {
  const decoded = jwt.decode(token) as { iat?: number } | null;
  if (!decoded?.iat) return true;
  return nowMs / 1000 - decoded.iat >= SESSION_TOKEN_RENEW_AFTER_SECONDS;
}
