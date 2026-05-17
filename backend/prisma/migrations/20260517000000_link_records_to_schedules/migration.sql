ALTER TABLE "Inspection" ADD COLUMN IF NOT EXISTS "scheduleId" TEXT;
ALTER TABLE "ActivityExpenseEntry" ADD COLUMN IF NOT EXISTS "scheduleId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Inspection_scheduleId_fkey'
  ) THEN
    ALTER TABLE "Inspection"
    ADD CONSTRAINT "Inspection_scheduleId_fkey"
    FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
    NOT VALID;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ActivityExpenseEntry_scheduleId_fkey'
  ) THEN
    ALTER TABLE "ActivityExpenseEntry"
    ADD CONSTRAINT "ActivityExpenseEntry_scheduleId_fkey"
    FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
    NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Inspection_scheduleId_idx" ON "Inspection"("scheduleId");
CREATE INDEX IF NOT EXISTS "ActivityExpenseEntry_scheduleId_idx" ON "ActivityExpenseEntry"("scheduleId");
