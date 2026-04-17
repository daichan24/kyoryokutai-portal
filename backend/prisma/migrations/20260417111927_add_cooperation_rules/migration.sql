-- CreateTable
CREATE TABLE "CooperationRule" (
    "id" TEXT NOT NULL,
    "fiscalYear" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CooperationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CooperationRule_fiscalYear_key" ON "CooperationRule"("fiscalYear");

-- CreateIndex
CREATE INDEX "CooperationRule_fiscalYear_idx" ON "CooperationRule"("fiscalYear");

-- CreateIndex
CREATE INDEX "CooperationRule_isActive_idx" ON "CooperationRule"("isActive");
