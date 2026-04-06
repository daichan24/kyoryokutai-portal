-- AlterTable: Project に isAchieved, achievedAt, relatedContactIds を追加
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "isAchieved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "achievedAt" TIMESTAMP(3);
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "relatedContactIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
