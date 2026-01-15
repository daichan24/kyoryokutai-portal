-- CreateEnum
CREATE TYPE "SubGoalStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "ProjectSubGoal" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "SubGoalStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSubGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectSubGoal_projectId_idx" ON "ProjectSubGoal"("projectId");

-- CreateIndex
CREATE INDEX "ProjectSubGoal_projectId_status_idx" ON "ProjectSubGoal"("projectId", "status");

-- AddForeignKey
ALTER TABLE "ProjectSubGoal" ADD CONSTRAINT "ProjectSubGoal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

