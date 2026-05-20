-- CreateEnum
CREATE TYPE "EmailJobStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmailEventType" AS ENUM (
  'SYSTEM_TEST',
  'WEEKLY_REPORT_SUBMITTED',
  'WEEKLY_REPORT_APPROVED',
  'WEEKLY_REPORT_REJECTED',
  'INSPECTION_SUBMITTED',
  'INSPECTION_APPROVED',
  'INSPECTION_REJECTED',
  'MONTHLY_REPORT_SUBMITTED',
  'MONTHLY_REPORT_APPROVED',
  'MONTHLY_REPORT_REJECTED',
  'ACTIVITY_EXPENSE_SUBMITTED',
  'ACTIVITY_EXPENSE_APPROVED',
  'ACTIVITY_EXPENSE_REJECTED',
  'CONSULTATION_CREATED',
  'CONSULTATION_RESOLVED',
  'COMPENSATORY_LEAVE_SUBMITTED',
  'COMPENSATORY_LEAVE_CONFIRMED',
  'TIME_ADJUSTMENT_SUBMITTED',
  'TIME_ADJUSTMENT_CONFIRMED',
  'MISSION_APPROVED',
  'MISSION_REJECTED',
  'PROJECT_APPROVED',
  'PROJECT_REJECTED',
  'LEAVE_EXPIRY_REMINDER',
  'TIME_ADJUSTMENT_EXPIRY_REMINDER',
  'SNS_WEEKLY_SUMMARY'
);

-- AlterTable
ALTER TABLE "Consultation" ADD COLUMN "emailRequested" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "MonthlyReport"
  ADD COLUMN "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "approvalComment" TEXT,
  ADD COLUMN "approvedBy" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "EmailJob" (
  "id" TEXT NOT NULL,
  "eventType" "EmailEventType" NOT NULL,
  "status" "EmailJobStatus" NOT NULL DEFAULT 'PENDING',
  "recipientUserId" TEXT,
  "recipientEmail" TEXT NOT NULL,
  "recipientName" TEXT,
  "actorUserId" TEXT,
  "subject" VARCHAR(300) NOT NULL,
  "textBody" TEXT NOT NULL,
  "htmlBody" TEXT,
  "link" TEXT,
  "relatedType" VARCHAR(80),
  "relatedId" TEXT,
  "idempotencyKey" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmailJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailJob_idempotencyKey_key" ON "EmailJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "EmailJob_status_scheduledAt_idx" ON "EmailJob"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "EmailJob_recipientUserId_createdAt_idx" ON "EmailJob"("recipientUserId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailJob_eventType_createdAt_idx" ON "EmailJob"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "EmailJob_relatedType_relatedId_idx" ON "EmailJob"("relatedType", "relatedId");

-- AddForeignKey
ALTER TABLE "EmailJob" ADD CONSTRAINT "EmailJob_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailJob" ADD CONSTRAINT "EmailJob_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyReport" ADD CONSTRAINT "MonthlyReport_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
