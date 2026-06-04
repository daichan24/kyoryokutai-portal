-- CreateEnum
CREATE TYPE "InterviewPollStatus" AS ENUM ('COLLECTING', 'PROPOSED', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InterviewAvailabilityStatus" AS ENUM ('OK', 'NG');

-- CreateTable
CREATE TABLE "InterviewPoll" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "status" "InterviewPollStatus" NOT NULL DEFAULT 'COLLECTING',
    "startTime" TEXT NOT NULL DEFAULT '09:00',
    "endTime" TEXT NOT NULL DEFAULT '17:00',
    "memo" TEXT,
    "createdById" TEXT NOT NULL,
    "confirmedById" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewPoll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewPollDate" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "unavailableDepartments" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewPollDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewPollParticipant" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewPollParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewPollAvailability" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "dateId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "status" "InterviewAvailabilityStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewPollAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewPollAssignment" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "dateId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "slotOrder" INTEGER NOT NULL,
    "scheduleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewPollAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterviewPoll_month_status_idx" ON "InterviewPoll"("month", "status");

-- CreateIndex
CREATE INDEX "InterviewPoll_createdById_idx" ON "InterviewPoll"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewPollDate_pollId_date_key" ON "InterviewPollDate"("pollId", "date");

-- CreateIndex
CREATE INDEX "InterviewPollDate_pollId_date_idx" ON "InterviewPollDate"("pollId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewPollParticipant_pollId_memberId_key" ON "InterviewPollParticipant"("pollId", "memberId");

-- CreateIndex
CREATE INDEX "InterviewPollParticipant_memberId_idx" ON "InterviewPollParticipant"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewPollAvailability_pollId_dateId_memberId_key" ON "InterviewPollAvailability"("pollId", "dateId", "memberId");

-- CreateIndex
CREATE INDEX "InterviewPollAvailability_memberId_pollId_idx" ON "InterviewPollAvailability"("memberId", "pollId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewPollAssignment_pollId_memberId_key" ON "InterviewPollAssignment"("pollId", "memberId");

-- CreateIndex
CREATE INDEX "InterviewPollAssignment_pollId_dateId_idx" ON "InterviewPollAssignment"("pollId", "dateId");

-- CreateIndex
CREATE INDEX "InterviewPollAssignment_scheduleId_idx" ON "InterviewPollAssignment"("scheduleId");

-- AddForeignKey
ALTER TABLE "InterviewPoll" ADD CONSTRAINT "InterviewPoll_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewPoll" ADD CONSTRAINT "InterviewPoll_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewPollDate" ADD CONSTRAINT "InterviewPollDate_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "InterviewPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewPollParticipant" ADD CONSTRAINT "InterviewPollParticipant_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "InterviewPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewPollParticipant" ADD CONSTRAINT "InterviewPollParticipant_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewPollAvailability" ADD CONSTRAINT "InterviewPollAvailability_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "InterviewPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewPollAvailability" ADD CONSTRAINT "InterviewPollAvailability_dateId_fkey" FOREIGN KEY ("dateId") REFERENCES "InterviewPollDate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewPollAvailability" ADD CONSTRAINT "InterviewPollAvailability_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewPollAssignment" ADD CONSTRAINT "InterviewPollAssignment_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "InterviewPoll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewPollAssignment" ADD CONSTRAINT "InterviewPollAssignment_dateId_fkey" FOREIGN KEY ("dateId") REFERENCES "InterviewPollDate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewPollAssignment" ADD CONSTRAINT "InterviewPollAssignment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
