-- Google Calendar two-way sync

CREATE TYPE "GoogleCalendarConnectionStatus" AS ENUM ('ACTIVE', 'ERROR', 'DISCONNECTED', 'REAUTH_REQUIRED');
CREATE TYPE "GoogleCalendarEventOrigin" AS ENUM ('CLEARBASE', 'GOOGLE');
CREATE TYPE "GoogleCalendarSyncDirection" AS ENUM ('PUSH', 'PULL');
CREATE TYPE "GoogleCalendarSyncStatus" AS ENUM ('SYNCED', 'PENDING', 'ERROR', 'CONFLICT_RESOLVED', 'DELETED');
CREATE TYPE "GoogleCalendarSyncJobType" AS ENUM ('INITIAL', 'MANUAL', 'WEBHOOK', 'POLL', 'WATCH_RENEWAL', 'PUSH', 'PULL');
CREATE TYPE "GoogleCalendarSyncJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

ALTER TABLE "Schedule"
  ADD COLUMN "isAllDay" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reportable" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "deletedAt" TIMESTAMP(3);

CREATE TABLE "GoogleCalendarConnection" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "googleAccountEmail" TEXT,
  "googleSubject" TEXT,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "tokenExpiry" TIMESTAMP(3),
  "scope" TEXT,
  "calendarId" TEXT,
  "calendarSummary" TEXT DEFAULT 'クリアベース｜活動予定',
  "syncToken" TEXT,
  "watchChannelId" TEXT,
  "watchResourceId" TEXT,
  "watchExpiration" TIMESTAMP(3),
  "watchTokenHash" TEXT,
  "status" "GoogleCalendarConnectionStatus" NOT NULL DEFAULT 'ACTIVE',
  "lastSyncedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "syncEnabledAt" TIMESTAMP(3),
  "disconnectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GoogleCalendarConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GoogleCalendarEventLink" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "googleCalendarId" TEXT NOT NULL,
  "googleEventId" TEXT NOT NULL,
  "googleEtag" TEXT,
  "googleUpdatedAt" TIMESTAMP(3),
  "origin" "GoogleCalendarEventOrigin" NOT NULL DEFAULT 'CLEARBASE',
  "lastSyncedAt" TIMESTAMP(3),
  "lastPushedAt" TIMESTAMP(3),
  "lastPulledAt" TIMESTAMP(3),
  "lastSyncDirection" "GoogleCalendarSyncDirection",
  "syncStatus" "GoogleCalendarSyncStatus" NOT NULL DEFAULT 'SYNCED',
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GoogleCalendarEventLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GoogleCalendarSyncJob" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "connectionId" TEXT,
  "jobType" "GoogleCalendarSyncJobType" NOT NULL,
  "status" "GoogleCalendarSyncJobStatus" NOT NULL DEFAULT 'PENDING',
  "payload" JSONB,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GoogleCalendarSyncJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GoogleCalendarConnection_userId_key" ON "GoogleCalendarConnection"("userId");
CREATE INDEX "GoogleCalendarConnection_status_idx" ON "GoogleCalendarConnection"("status");
CREATE INDEX "GoogleCalendarConnection_watchChannelId_idx" ON "GoogleCalendarConnection"("watchChannelId");
CREATE INDEX "GoogleCalendarConnection_watchExpiration_idx" ON "GoogleCalendarConnection"("watchExpiration");

CREATE UNIQUE INDEX "GoogleCalendarEventLink_scheduleId_key" ON "GoogleCalendarEventLink"("scheduleId");
CREATE UNIQUE INDEX "GoogleCalendarEventLink_googleCalendarId_googleEventId_key" ON "GoogleCalendarEventLink"("googleCalendarId", "googleEventId");
CREATE INDEX "GoogleCalendarEventLink_userId_idx" ON "GoogleCalendarEventLink"("userId");
CREATE INDEX "GoogleCalendarEventLink_connectionId_idx" ON "GoogleCalendarEventLink"("connectionId");
CREATE INDEX "GoogleCalendarEventLink_syncStatus_idx" ON "GoogleCalendarEventLink"("syncStatus");

CREATE INDEX "GoogleCalendarSyncJob_status_scheduledAt_idx" ON "GoogleCalendarSyncJob"("status", "scheduledAt");
CREATE INDEX "GoogleCalendarSyncJob_connectionId_createdAt_idx" ON "GoogleCalendarSyncJob"("connectionId", "createdAt");
CREATE INDEX "GoogleCalendarSyncJob_jobType_createdAt_idx" ON "GoogleCalendarSyncJob"("jobType", "createdAt");

CREATE INDEX "Schedule_userId_deletedAt_idx" ON "Schedule"("userId", "deletedAt");
CREATE INDEX "Schedule_reportable_idx" ON "Schedule"("reportable");

ALTER TABLE "GoogleCalendarConnection"
  ADD CONSTRAINT "GoogleCalendarConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GoogleCalendarEventLink"
  ADD CONSTRAINT "GoogleCalendarEventLink_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "GoogleCalendarEventLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "GoogleCalendarEventLink_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "GoogleCalendarConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GoogleCalendarSyncJob"
  ADD CONSTRAINT "GoogleCalendarSyncJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "GoogleCalendarSyncJob_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "GoogleCalendarConnection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
