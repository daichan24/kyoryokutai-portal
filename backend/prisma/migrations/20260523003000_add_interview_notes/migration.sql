CREATE TABLE "InterviewNote" (
  "id" TEXT NOT NULL,
  "memberId" TEXT NOT NULL,
  "month" VARCHAR(7) NOT NULL,
  "memo" TEXT,
  "snsNote" TEXT,
  "snsCheckedAt" TIMESTAMP(3),
  "snsSnapshot" JSONB,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "InterviewNote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InterviewNote_memberId_month_key" ON "InterviewNote"("memberId", "month");
CREATE INDEX "InterviewNote_memberId_month_idx" ON "InterviewNote"("memberId", "month");

ALTER TABLE "InterviewNote"
  ADD CONSTRAINT "InterviewNote_memberId_fkey"
  FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterviewNote"
  ADD CONSTRAINT "InterviewNote_updatedById_fkey"
  FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
