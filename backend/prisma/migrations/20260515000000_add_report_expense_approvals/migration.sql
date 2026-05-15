-- Add approval workflow fields for weekly reports.
ALTER TABLE "WeeklyReport"
  ADD COLUMN "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "approvalComment" TEXT,
  ADD COLUMN "approvedBy" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3);

UPDATE "WeeklyReport"
SET "approvalStatus" = 'PENDING'
WHERE "submittedAt" IS NOT NULL;

CREATE INDEX "WeeklyReport_approvalStatus_idx" ON "WeeklyReport"("approvalStatus");

ALTER TABLE "WeeklyReport"
  ADD CONSTRAINT "WeeklyReport_approvedBy_fkey"
  FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
