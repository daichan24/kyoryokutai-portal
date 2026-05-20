ALTER TABLE "Schedule"
  ADD COLUMN "isTimeUnspecified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "referenceUrl" TEXT;
