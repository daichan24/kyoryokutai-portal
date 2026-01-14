-- AlterTable: UserにsnsLinksを追加
ALTER TABLE "User" ADD COLUMN "snsLinks" JSONB;

-- AlterTable: SNSPostに詳細フィールドを追加
ALTER TABLE "SNSPost" ADD COLUMN "postedAt" TIMESTAMPTZ;
ALTER TABLE "SNSPost" ADD COLUMN "url" TEXT;
ALTER TABLE "SNSPost" ADD COLUMN "theme" VARCHAR(200);
ALTER TABLE "SNSPost" ADD COLUMN "followerDelta" INTEGER;
ALTER TABLE "SNSPost" ADD COLUMN "views" INTEGER;
ALTER TABLE "SNSPost" ADD COLUMN "likes" INTEGER;
ALTER TABLE "SNSPost" ADD COLUMN "note" TEXT;

-- 既存データの移行: postDateとisPostedからpostedAtを生成
UPDATE "SNSPost"
SET "postedAt" = COALESCE("postDate"::timestamptz, "createdAt")
WHERE "postedAt" IS NULL AND "isPosted" = true;

-- インデックス追加
CREATE INDEX IF NOT EXISTS "SNSPost_userId_postedAt_idx" ON "SNSPost"("userId", "postedAt");

