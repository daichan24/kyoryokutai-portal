-- AlterTable
ALTER TABLE "EventParticipation" ADD COLUMN "status" "ParticipantStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "respondedAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "EventParticipation_userId_status_idx" ON "EventParticipation"("userId", "status");

