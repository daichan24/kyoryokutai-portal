ALTER TABLE "PaidLeaveEntry" ADD COLUMN "scheduleId" TEXT;
ALTER TABLE "UnpaidLeaveEntry" ADD COLUMN "scheduleId" TEXT;
ALTER TABLE "CompensatoryLeaveUsage" ADD COLUMN "scheduleId" TEXT;

ALTER TABLE "PaidLeaveEntry"
ADD CONSTRAINT "PaidLeaveEntry_scheduleId_fkey"
FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UnpaidLeaveEntry"
ADD CONSTRAINT "UnpaidLeaveEntry_scheduleId_fkey"
FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompensatoryLeaveUsage"
ADD CONSTRAINT "CompensatoryLeaveUsage_scheduleId_fkey"
FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TimeAdjustment"
ADD CONSTRAINT "TimeAdjustment_usedScheduleId_fkey"
FOREIGN KEY ("usedScheduleId") REFERENCES "Schedule"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PaidLeaveEntry_scheduleId_idx" ON "PaidLeaveEntry"("scheduleId");
CREATE INDEX "UnpaidLeaveEntry_scheduleId_idx" ON "UnpaidLeaveEntry"("scheduleId");
CREATE INDEX "CompensatoryLeaveUsage_scheduleId_idx" ON "CompensatoryLeaveUsage"("scheduleId");
