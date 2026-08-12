export type SessionPasswordClaims = {
  iat?: number;
  passwordUpdatedAt?: number | null;
};

export function isSessionPasswordVersionValid(
  claims: SessionPasswordClaims,
  currentPasswordUpdatedAt: Date | null,
): boolean {
  const currentVersion = currentPasswordUpdatedAt?.getTime() ?? null;
  if (claims.passwordUpdatedAt !== undefined) {
    return claims.passwordUpdatedAt === currentVersion;
  }

  // Backward compatibility for JWTs issued before the exact password version claim existed.
  if (!currentVersion || !claims.iat) return true;
  return currentVersion < (claims.iat + 1) * 1000;
}
