-- CreateTable
CREATE TABLE "NudgeDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NudgeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NudgeRevision" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NudgeRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NudgeRevision_documentId_idx" ON "NudgeRevision"("documentId");

-- CreateIndex
CREATE INDEX "NudgeRevision_createdAt_idx" ON "NudgeRevision"("createdAt");

-- AddForeignKey
ALTER TABLE "NudgeDocument" ADD CONSTRAINT "NudgeDocument_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NudgeRevision" ADD CONSTRAINT "NudgeRevision_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "NudgeDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NudgeRevision" ADD CONSTRAINT "NudgeRevision_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

