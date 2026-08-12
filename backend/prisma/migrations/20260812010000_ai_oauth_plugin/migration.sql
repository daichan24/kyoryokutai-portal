CREATE TABLE "AiOAuthClient" (
    "id" VARCHAR(100) NOT NULL,
    "clientName" VARCHAR(200) NOT NULL,
    "redirectUris" TEXT[] NOT NULL,
    "tokenEndpointAuthMethod" VARCHAR(50) NOT NULL DEFAULT 'none',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiOAuthClient_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AiAccessToken"
    ADD COLUMN "authType" VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN "oauthClientId" VARCHAR(100),
    ADD COLUMN "refreshTokenHash" VARCHAR(64),
    ADD COLUMN "accessTokenHash" VARCHAR(64),
    ADD COLUMN "accessTokenExpiresAt" TIMESTAMP(3);

CREATE TABLE "AiOAuthAuthorizationCode" (
    "id" TEXT NOT NULL,
    "codeHash" VARCHAR(64) NOT NULL,
    "clientId" VARCHAR(100) NOT NULL,
    "userId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "scopes" TEXT[] NOT NULL,
    "codeChallenge" VARCHAR(128) NOT NULL,
    "resource" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiOAuthAuthorizationCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiAccessToken_refreshTokenHash_key" ON "AiAccessToken"("refreshTokenHash");
CREATE UNIQUE INDEX "AiAccessToken_accessTokenHash_key" ON "AiAccessToken"("accessTokenHash");
CREATE INDEX "AiAccessToken_oauthClientId_revokedAt_idx" ON "AiAccessToken"("oauthClientId", "revokedAt");
CREATE INDEX "AiAccessToken_accessTokenExpiresAt_idx" ON "AiAccessToken"("accessTokenExpiresAt");
CREATE UNIQUE INDEX "AiOAuthAuthorizationCode_codeHash_key" ON "AiOAuthAuthorizationCode"("codeHash");
CREATE INDEX "AiOAuthAuthorizationCode_clientId_expiresAt_idx" ON "AiOAuthAuthorizationCode"("clientId", "expiresAt");
CREATE INDEX "AiOAuthAuthorizationCode_userId_createdAt_idx" ON "AiOAuthAuthorizationCode"("userId", "createdAt");

ALTER TABLE "AiAccessToken" ADD CONSTRAINT "AiAccessToken_oauthClientId_fkey"
    FOREIGN KEY ("oauthClientId") REFERENCES "AiOAuthClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiOAuthAuthorizationCode" ADD CONSTRAINT "AiOAuthAuthorizationCode_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "AiOAuthClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiOAuthAuthorizationCode" ADD CONSTRAINT "AiOAuthAuthorizationCode_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
