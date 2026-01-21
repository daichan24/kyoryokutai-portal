-- AlterTable: Add startDate and endDate to Event
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "startDate" DATE;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "endDate" DATE;

-- Update existing records: set startDate and endDate to date value
UPDATE "Event" SET "startDate" = "date", "endDate" = "date" WHERE "startDate" IS NULL OR "endDate" IS NULL;

-- Make startDate and endDate NOT NULL (after setting default values)
ALTER TABLE "Event" ALTER COLUMN "startDate" SET NOT NULL;
ALTER TABLE "Event" ALTER COLUMN "endDate" SET NOT NULL;

