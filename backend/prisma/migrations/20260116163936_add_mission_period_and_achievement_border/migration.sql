-- AlterTable: Add startDate, endDate, achievementBorder to Mission
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "startDate" DATE;
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "endDate" DATE;
ALTER TABLE "Mission" ADD COLUMN IF NOT EXISTS "achievementBorder" TEXT;
