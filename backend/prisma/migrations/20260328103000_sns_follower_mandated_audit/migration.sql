-- AlterTable
ALTER TABLE "SNSPost" ADD COLUMN IF NOT EXISTS "followerCount" INTEGER;

-- CreateTable
CREATE TABLE IF NOT EXISTS "MandatedAttendanceAuditLog" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attended" BOOLEAN NOT NULL,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MandatedAttendanceAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MandatedAttendanceAuditLog_eventId_createdAt_idx" ON "MandatedAttendanceAuditLog"("eventId", "createdAt");
CREATE INDEX IF NOT EXISTS "MandatedAttendanceAuditLog_userId_idx" ON "MandatedAttendanceAuditLog"("userId");

ALTER TABLE "MandatedAttendanceAuditLog" ADD CONSTRAINT "MandatedAttendanceAuditLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "MandatedTeamEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MandatedAttendanceAuditLog" ADD CONSTRAINT "MandatedAttendanceAuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MandatedAttendanceAuditLog" ADD CONSTRAINT "MandatedAttendanceAuditLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
