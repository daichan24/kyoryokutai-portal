ALTER TABLE "PaidLeaveEntry" ADD COLUMN IF NOT EXISTS "scheduleId" TEXT;
ALTER TABLE "UnpaidLeaveEntry" ADD COLUMN IF NOT EXISTS "scheduleId" TEXT;
ALTER TABLE "CompensatoryLeaveUsage" ADD COLUMN IF NOT EXISTS "scheduleId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PaidLeaveEntry_scheduleId_fkey'
  ) THEN
    ALTER TABLE "PaidLeaveEntry"
    ADD CONSTRAINT "PaidLeaveEntry_scheduleId_fkey"
    FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
    NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'UnpaidLeaveEntry_scheduleId_fkey'
  ) THEN
    ALTER TABLE "UnpaidLeaveEntry"
    ADD CONSTRAINT "UnpaidLeaveEntry_scheduleId_fkey"
    FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
    NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CompensatoryLeaveUsage_scheduleId_fkey'
  ) THEN
    ALTER TABLE "CompensatoryLeaveUsage"
    ADD CONSTRAINT "CompensatoryLeaveUsage_scheduleId_fkey"
    FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
    NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TimeAdjustment_usedScheduleId_fkey'
  ) THEN
    ALTER TABLE "TimeAdjustment"
    ADD CONSTRAINT "TimeAdjustment_usedScheduleId_fkey"
    FOREIGN KEY ("usedScheduleId") REFERENCES "Schedule"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
    NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "PaidLeaveEntry_scheduleId_idx" ON "PaidLeaveEntry"("scheduleId");
CREATE INDEX IF NOT EXISTS "UnpaidLeaveEntry_scheduleId_idx" ON "UnpaidLeaveEntry"("scheduleId");
CREATE INDEX IF NOT EXISTS "CompensatoryLeaveUsage_scheduleId_idx" ON "CompensatoryLeaveUsage"("scheduleId");
