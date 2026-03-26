-- CreateEnum
CREATE TYPE "MissionTaskLinkKind" AS ENUM ('PROJECT', 'UNSET', 'KYORYOKUTAI_WORK');

-- AlterEnum
ALTER TYPE "MemberRole" ADD VALUE 'NOT_SET';
ALTER TYPE "MemberRole" ADD VALUE 'KYORYOKUTAI_WORK';

-- CreateEnum
CREATE TYPE "ConsultationAudience" AS ENUM ('ANY', 'SUPPORT_ONLY', 'GOVERNMENT_ONLY', 'SPECIFIC_USER');

-- CreateEnum
CREATE TYPE "ConsultationStatus" AS ENUM ('OPEN', 'RESOLVED');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "linkKind" "MissionTaskLinkKind" NOT NULL DEFAULT 'PROJECT';

UPDATE "Task" SET "linkKind" = 'UNSET' WHERE "projectId" IS NULL;

-- CreateTable
CREATE TABLE "Consultation" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "audience" "ConsultationAudience" NOT NULL,
    "targetUserId" TEXT,
    "subject" VARCHAR(400),
    "body" TEXT NOT NULL,
    "status" "ConsultationStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Consultation_memberId_status_idx" ON "Consultation"("memberId", "status");

-- CreateIndex
CREATE INDEX "Consultation_status_createdAt_idx" ON "Consultation"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Consultation_audience_status_idx" ON "Consultation"("audience", "status");

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
