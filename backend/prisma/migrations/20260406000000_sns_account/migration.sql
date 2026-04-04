-- CreateTable: SNSAccount
CREATE TABLE "SNSAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" VARCHAR(50) NOT NULL,
    "accountName" VARCHAR(200) NOT NULL,
    "displayName" VARCHAR(200),
    "url" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SNSAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SNSAccount_userId_idx" ON "SNSAccount"("userId");

-- AddForeignKey
ALTER TABLE "SNSAccount" ADD CONSTRAINT "SNSAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: SNSPostにaccountIdを追加
ALTER TABLE "SNSPost" ADD COLUMN IF NOT EXISTS "accountId" TEXT;

-- AddForeignKey
ALTER TABLE "SNSPost" ADD CONSTRAINT "SNSPost_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SNSAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "SNSPost_accountId_idx" ON "SNSPost"("accountId");

-- 既存のunique制約を削除して新しい制約を作成
DROP INDEX IF EXISTS "SNSPost_userId_week_postType_key";
CREATE UNIQUE INDEX IF NOT EXISTS "SNSPost_userId_week_postType_accountId" ON "SNSPost" ("userId", week, "postType", COALESCE("accountId", ''));
