-- Passwords must never be stored in recoverable plaintext.
ALTER TABLE "User" DROP COLUMN IF EXISTS "passwordPlainForMaster";

CREATE TABLE "AiAccessToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "tokenPrefix" VARCHAR(24) NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "scopes" TEXT[] NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiAccessToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiOperationAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessTokenId" TEXT,
    "method" VARCHAR(10) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "resourceType" VARCHAR(100),
    "resourceId" VARCHAR(100),
    "requestId" VARCHAR(100),
    "statusCode" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "inputSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AiOperationAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiIdempotencyKey" (
    "id" TEXT NOT NULL,
    "accessTokenId" TEXT NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "method" VARCHAR(10) NOT NULL,
    "path" VARCHAR(500) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "statusCode" INTEGER,
    "responseBody" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AiIdempotencyKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiAccessToken_tokenHash_key" ON "AiAccessToken"("tokenHash");
CREATE INDEX "AiAccessToken_userId_revokedAt_idx" ON "AiAccessToken"("userId", "revokedAt");
CREATE INDEX "AiAccessToken_expiresAt_idx" ON "AiAccessToken"("expiresAt");
CREATE INDEX "AiOperationAudit_userId_createdAt_idx" ON "AiOperationAudit"("userId", "createdAt");
CREATE INDEX "AiOperationAudit_accessTokenId_createdAt_idx" ON "AiOperationAudit"("accessTokenId", "createdAt");
CREATE UNIQUE INDEX "AiIdempotencyKey_accessTokenId_key_key" ON "AiIdempotencyKey"("accessTokenId", "key");
CREATE INDEX "AiIdempotencyKey_expiresAt_idx" ON "AiIdempotencyKey"("expiresAt");

ALTER TABLE "AiAccessToken" ADD CONSTRAINT "AiAccessToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiOperationAudit" ADD CONSTRAINT "AiOperationAudit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiOperationAudit" ADD CONSTRAINT "AiOperationAudit_accessTokenId_fkey" FOREIGN KEY ("accessTokenId") REFERENCES "AiAccessToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiIdempotencyKey" ADD CONSTRAINT "AiIdempotencyKey_accessTokenId_fkey" FOREIGN KEY ("accessTokenId") REFERENCES "AiAccessToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;
