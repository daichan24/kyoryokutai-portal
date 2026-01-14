-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SCHEDULE_INVITE';
ALTER TYPE "NotificationType" ADD VALUE 'SCHEDULE_INVITE_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'SCHEDULE_INVITE_REJECTED';

-- CreateTable
CREATE TABLE "ScheduleParticipant" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleParticipant_scheduleId_idx" ON "ScheduleParticipant"("scheduleId");

-- CreateIndex
CREATE INDEX "ScheduleParticipant_userId_status_idx" ON "ScheduleParticipant"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleParticipant_scheduleId_userId_key" ON "ScheduleParticipant"("scheduleId", "userId");

-- AddForeignKey
ALTER TABLE "ScheduleParticipant" ADD CONSTRAINT "ScheduleParticipant_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleParticipant" ADD CONSTRAINT "ScheduleParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

