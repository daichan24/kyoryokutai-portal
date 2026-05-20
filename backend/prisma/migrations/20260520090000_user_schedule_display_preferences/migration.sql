-- AlterTable
ALTER TABLE "User" ADD COLUMN "scheduleWeekStartsOn" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "scheduleHiddenLocationIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
