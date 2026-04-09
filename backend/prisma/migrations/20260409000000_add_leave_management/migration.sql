-- CreateEnum
CREATE TYPE "CompensatoryLeaveType" AS ENUM ('FULL_DAY', 'TIME_ADJUST');

-- CreateEnum
CREATE TYPE "CompensatoryLeaveStatus" AS ENUM ('PENDING', 'USED', 'EXPIRED');

-- AlterTable: Schedule に代休フィールド追加
ALTER TABLE "Schedule" ADD COLUMN "compensatoryLeaveRequired" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Schedule" ADD COLUMN "compensatoryLeaveType" "CompensatoryLeaveType";

-- CreateTable: PaidLeaveAllocation
CREATE TABLE "PaidLeaveAllocation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "totalDays" DOUBLE PRECISION NOT NULL,
    "expiresAt" DATE NOT NULL,
    "memo" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaidLeaveAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable: PaidLeaveEntry
CREATE TABLE "PaidLeaveEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "usedAt" DATE NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,
    "note" VARCHAR(500),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaidLeaveEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable: UnpaidLeaveEntry
CREATE TABLE "UnpaidLeaveEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "usedAt" DATE NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,
    "note" VARCHAR(500),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnpaidLeaveEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CompensatoryLeave
CREATE TABLE "CompensatoryLeave" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grantedAt" DATE NOT NULL,
    "expiresAt" DATE NOT NULL,
    "scheduleId" TEXT,
    "totalHours" DOUBLE PRECISION,
    "leaveType" "CompensatoryLeaveType" NOT NULL DEFAULT 'FULL_DAY',
    "status" "CompensatoryLeaveStatus" NOT NULL DEFAULT 'PENDING',
    "note" VARCHAR(500),
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompensatoryLeave_pkey" PRIMARY KEY ("id")
);

-- CreateTable: CompensatoryLeaveUsage
CREATE TABLE "CompensatoryLeaveUsage" (
    "id" TEXT NOT NULL,
    "compensatoryLeaveId" TEXT NOT NULL,
    "usedAt" DATE NOT NULL,
    "days" DOUBLE PRECISION NOT NULL,
    "note" VARCHAR(500),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompensatoryLeaveUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable: TimeAdjustment
CREATE TABLE "TimeAdjustment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "compensatoryLeaveId" TEXT,
    "adjustedAt" DATE NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "sourceScheduleId" TEXT,
    "note" VARCHAR(500),
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaidLeaveAllocation_userId_fiscalYear_key" ON "PaidLeaveAllocation"("userId", "fiscalYear");
CREATE INDEX "PaidLeaveAllocation_userId_idx" ON "PaidLeaveAllocation"("userId");
CREATE INDEX "PaidLeaveEntry_userId_usedAt_idx" ON "PaidLeaveEntry"("userId", "usedAt");
CREATE INDEX "UnpaidLeaveEntry_userId_usedAt_idx" ON "UnpaidLeaveEntry"("userId", "usedAt");
CREATE INDEX "CompensatoryLeave_userId_status_idx" ON "CompensatoryLeave"("userId", "status");
CREATE INDEX "CompensatoryLeave_userId_expiresAt_idx" ON "CompensatoryLeave"("userId", "expiresAt");
CREATE INDEX "CompensatoryLeave_scheduleId_idx" ON "CompensatoryLeave"("scheduleId");
CREATE INDEX "CompensatoryLeaveUsage_compensatoryLeaveId_idx" ON "CompensatoryLeaveUsage"("compensatoryLeaveId");
CREATE INDEX "TimeAdjustment_userId_adjustedAt_idx" ON "TimeAdjustment"("userId", "adjustedAt");
CREATE INDEX "TimeAdjustment_compensatoryLeaveId_idx" ON "TimeAdjustment"("compensatoryLeaveId");

-- AddForeignKey
ALTER TABLE "PaidLeaveAllocation" ADD CONSTRAINT "PaidLeaveAllocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaidLeaveAllocation" ADD CONSTRAINT "PaidLeaveAllocation_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PaidLeaveEntry" ADD CONSTRAINT "PaidLeaveEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaidLeaveEntry" ADD CONSTRAINT "PaidLeaveEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UnpaidLeaveEntry" ADD CONSTRAINT "UnpaidLeaveEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UnpaidLeaveEntry" ADD CONSTRAINT "UnpaidLeaveEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompensatoryLeave" ADD CONSTRAINT "CompensatoryLeave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompensatoryLeave" ADD CONSTRAINT "CompensatoryLeave_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompensatoryLeave" ADD CONSTRAINT "CompensatoryLeave_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompensatoryLeaveUsage" ADD CONSTRAINT "CompensatoryLeaveUsage_compensatoryLeaveId_fkey" FOREIGN KEY ("compensatoryLeaveId") REFERENCES "CompensatoryLeave"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompensatoryLeaveUsage" ADD CONSTRAINT "CompensatoryLeaveUsage_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimeAdjustment" ADD CONSTRAINT "TimeAdjustment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TimeAdjustment" ADD CONSTRAINT "TimeAdjustment_compensatoryLeaveId_fkey" FOREIGN KEY ("compensatoryLeaveId") REFERENCES "CompensatoryLeave"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimeAdjustment" ADD CONSTRAINT "TimeAdjustment_sourceScheduleId_fkey" FOREIGN KEY ("sourceScheduleId") REFERENCES "Schedule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TimeAdjustment" ADD CONSTRAINT "TimeAdjustment_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
