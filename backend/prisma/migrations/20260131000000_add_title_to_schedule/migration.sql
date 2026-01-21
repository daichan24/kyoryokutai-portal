-- AlterTable: Add title to Schedule
ALTER TABLE "Schedule" ADD COLUMN IF NOT EXISTS "title" VARCHAR(200);

