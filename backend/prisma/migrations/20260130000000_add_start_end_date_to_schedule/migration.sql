-- AlterTable: Add startDate and endDate to Schedule
ALTER TABLE "Schedule" ADD COLUMN IF NOT EXISTS "startDate" DATE;
ALTER TABLE "Schedule" ADD COLUMN IF NOT EXISTS "endDate" DATE;

-- Update existing records: set startDate and endDate to date value
UPDATE "Schedule" SET "startDate" = "date", "endDate" = "date" WHERE "startDate" IS NULL OR "endDate" IS NULL;

-- Make startDate and endDate NOT NULL (after setting default values)
ALTER TABLE "Schedule" ALTER COLUMN "startDate" SET NOT NULL;
ALTER TABLE "Schedule" ALTER COLUMN "endDate" SET NOT NULL;

