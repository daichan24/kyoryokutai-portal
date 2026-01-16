-- AlterTable: Add taskId to Schedule
ALTER TABLE "Schedule" ADD COLUMN IF NOT EXISTS "taskId" TEXT;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Schedule_taskId_fkey'
  ) THEN
    ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Schedule_taskId_idx" ON "Schedule"("taskId");
