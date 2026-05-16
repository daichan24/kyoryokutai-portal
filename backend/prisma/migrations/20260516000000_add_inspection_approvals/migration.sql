ALTER TABLE "Inspection"
ADD COLUMN "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "approvalComment" TEXT,
ADD COLUMN "approvedBy" TEXT,
ADD COLUMN "approvedAt" TIMESTAMP(3);

ALTER TABLE "Inspection"
ADD CONSTRAINT "Inspection_approvedBy_fkey"
FOREIGN KEY ("approvedBy") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Inspection_approvalStatus_idx" ON "Inspection"("approvalStatus");
