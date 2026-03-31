-- やりたいこと100: デフォルトOFF、Wish が1件以上あるユーザーはON
ALTER TABLE "User" ALTER COLUMN "wishesEnabled" SET DEFAULT false;
UPDATE "User" u
SET "wishesEnabled" = EXISTS (SELECT 1 FROM "Wish" w WHERE w."userId" = u.id);

-- SNS: 週×種別で一意（ストーリーズとフィードを同一週に両方記録可能に）
ALTER TABLE "SNSPost" DROP CONSTRAINT IF EXISTS "SNSPost_userId_week_key";

INSERT INTO "SNSPost" (
  "id", "userId", "week", "postedAt", "postType", "url", "theme", "followerDelta", "views", "likes", "note", "postDate", "isPosted", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  "userId",
  "week",
  "postedAt",
  'FEED'::"PostType",
  "url",
  "theme",
  "followerDelta",
  "views",
  "likes",
  "note",
  "postDate",
  "isPosted",
  NOW(),
  NOW()
FROM "SNSPost"
WHERE "postType" = 'BOTH';

UPDATE "SNSPost" SET "postType" = 'STORY' WHERE "postType" = 'BOTH';

CREATE UNIQUE INDEX "SNSPost_userId_week_postType_key" ON "SNSPost"("userId", "week", "postType");

-- 活動経費: 手順文・チェックリスト・具体例・エントリのプロジェクト紐づけ
CREATE TABLE "ActivityExpenseGuidance" (
    "id" TEXT NOT NULL,
    "procedureText" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityExpenseGuidance_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ActivityExpenseGuidance" ("id", "procedureText", "updatedAt")
VALUES ('default', '', NOW());

CREATE TABLE "ActivityExpenseChecklistItem" (
    "id" TEXT NOT NULL,
    "label" VARCHAR(500) NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityExpenseChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ActivityExpenseApprovedExample" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "summary" VARCHAR(500) NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityExpenseApprovedExample_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ActivityExpenseApprovedExample_missionId_idx" ON "ActivityExpenseApprovedExample"("missionId");

ALTER TABLE "ActivityExpenseApprovedExample" ADD CONSTRAINT "ActivityExpenseApprovedExample_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityExpenseApprovedExample" ADD CONSTRAINT "ActivityExpenseApprovedExample_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ActivityExpenseEntry" ADD COLUMN "projectId" TEXT;
CREATE INDEX "ActivityExpenseEntry_projectId_idx" ON "ActivityExpenseEntry"("projectId");
ALTER TABLE "ActivityExpenseEntry" ADD CONSTRAINT "ActivityExpenseEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
