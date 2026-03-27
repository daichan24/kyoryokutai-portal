-- AlterEnum
ALTER TYPE "MissionTaskLinkKind" ADD VALUE 'TRIAGE_PENDING';

-- AlterTable Event
ALTER TABLE "Event" ADD COLUMN "supportSlotsNeeded" INTEGER;

-- CreateTable
CREATE TABLE "MandatedTeamEvent" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(400) NOT NULL,
    "description" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "requiredSlots" INTEGER NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MandatedTeamEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MandatedTeamEventAttendance" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MandatedTeamEventAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MandatedTeamEventAttendance_eventId_userId_key" ON "MandatedTeamEventAttendance"("eventId", "userId");

-- CreateIndex
CREATE INDEX "MandatedTeamEventAttendance_userId_idx" ON "MandatedTeamEventAttendance"("userId");

-- CreateIndex
CREATE INDEX "MandatedTeamEvent_startDate_endDate_idx" ON "MandatedTeamEvent"("startDate", "endDate");

-- AddForeignKey
ALTER TABLE "MandatedTeamEvent" ADD CONSTRAINT "MandatedTeamEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MandatedTeamEventAttendance" ADD CONSTRAINT "MandatedTeamEventAttendance_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MandatedTeamEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MandatedTeamEventAttendance" ADD CONSTRAINT "MandatedTeamEventAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable Schedule
ALTER TABLE "Schedule" ADD COLUMN "supportEventId" TEXT;

-- CreateIndex
CREATE INDEX "Schedule_supportEventId_idx" ON "Schedule"("supportEventId");

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_supportEventId_fkey" FOREIGN KEY ("supportEventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
