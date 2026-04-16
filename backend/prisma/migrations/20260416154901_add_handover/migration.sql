-- CreateEnum (skip if exists)
DO $$ BEGIN
    CREATE TYPE "HandoverCategoryType" AS ENUM ('EVENT', 'MEETING');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "HandoverCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "HandoverCategoryType" NOT NULL DEFAULT 'EVENT',
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HandoverCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "HandoverFolder" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HandoverFolder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "HandoverDocument" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "relatedContactIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "relatedMemberIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "budget" INTEGER,
    "venue" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HandoverDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HandoverCategory_sortOrder_idx" ON "HandoverCategory"("sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HandoverCategory_type_idx" ON "HandoverCategory"("type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HandoverFolder_categoryId_idx" ON "HandoverFolder"("categoryId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HandoverFolder_fiscalYear_idx" ON "HandoverFolder"("fiscalYear");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HandoverDocument_folderId_idx" ON "HandoverDocument"("folderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HandoverDocument_createdById_idx" ON "HandoverDocument"("createdById");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "HandoverFolder" ADD CONSTRAINT "HandoverFolder_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "HandoverCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "HandoverDocument" ADD CONSTRAINT "HandoverDocument_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "HandoverFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "HandoverDocument" ADD CONSTRAINT "HandoverDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "HandoverDocument" ADD CONSTRAINT "HandoverDocument_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Fix existing NULL updatedAt values (if any)
UPDATE "HandoverCategory" SET "updatedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP) WHERE "updatedAt" IS NULL;
UPDATE "HandoverFolder" SET "updatedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP) WHERE "updatedAt" IS NULL;
UPDATE "HandoverDocument" SET "updatedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP) WHERE "updatedAt" IS NULL;

-- Insert default categories (only if not exists)
INSERT INTO "HandoverCategory" ("id", "name", "type", "description", "sortOrder")
SELECT 'cat-activity-report', '活動報告会', 'EVENT', '年度ごとの活動報告会の準備・実施記録', 1
WHERE NOT EXISTS (SELECT 1 FROM "HandoverCategory" WHERE "id" = 'cat-activity-report');

INSERT INTO "HandoverCategory" ("id", "name", "type", "description", "sortOrder")
SELECT 'cat-trial-tour', '協力隊お試しツアー', 'EVENT', '協力隊体験ツアーの企画・運営記録', 2
WHERE NOT EXISTS (SELECT 1 FROM "HandoverCategory" WHERE "id" = 'cat-trial-tour');

INSERT INTO "HandoverCategory" ("id", "name", "type", "description", "sortOrder")
SELECT 'cat-yuuyake-market', '夕やけ市', 'EVENT', '夕やけ市の出店・運営記録', 3
WHERE NOT EXISTS (SELECT 1 FROM "HandoverCategory" WHERE "id" = 'cat-yuuyake-market');

INSERT INTO "HandoverCategory" ("id", "name", "type", "description", "sortOrder")
SELECT 'cat-maoi-festival', 'ながぬまマオイ夢祭り', 'EVENT', 'マオイ夢祭りの参加・協力記録', 4
WHERE NOT EXISTS (SELECT 1 FROM "HandoverCategory" WHERE "id" = 'cat-maoi-festival');

INSERT INTO "HandoverCategory" ("id", "name", "type", "description", "sortOrder")
SELECT 'cat-internship', 'インターンシップ', 'EVENT', 'インターンシップの受け入れ記録', 5
WHERE NOT EXISTS (SELECT 1 FROM "HandoverCategory" WHERE "id" = 'cat-internship');

INSERT INTO "HandoverCategory" ("id", "name", "type", "description", "sortOrder")
SELECT 'cat-team-meeting', '協力隊MTG', 'MEETING', '協力隊ミーティングの議事録', 100
WHERE NOT EXISTS (SELECT 1 FROM "HandoverCategory" WHERE "id" = 'cat-team-meeting');
