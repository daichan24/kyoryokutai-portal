-- CreateTable
CREATE TABLE "DocumentTemplate" (
    "id" TEXT NOT NULL,
    "templateType" TEXT NOT NULL,
    "weeklyReportRecipient" TEXT,
    "weeklyReportTitle" TEXT,
    "monthlyReportRecipient" TEXT,
    "monthlyReportSender" TEXT,
    "monthlyReportTitle" TEXT,
    "monthlyReportText1" TEXT,
    "monthlyReportText2" TEXT,
    "monthlyReportContact" TEXT,
    "inspectionRecipient" TEXT,
    "inspectionTitle" TEXT,
    "inspectionNamePrefix" TEXT,
    "inspectionText1" TEXT,
    "inspectionItem1" TEXT,
    "inspectionItem2" TEXT,
    "inspectionItem3" TEXT,
    "inspectionItem4" TEXT,
    "inspectionItem5" TEXT,
    "inspectionItem6" TEXT,
    "inspectionItem7" TEXT,
    "inspectionItem8" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTemplate_templateType_key" ON "DocumentTemplate"("templateType");

-- CreateIndex
CREATE INDEX "DocumentTemplate_updatedBy_idx" ON "DocumentTemplate"("updatedBy");

-- AddForeignKey
ALTER TABLE "DocumentTemplate" ADD CONSTRAINT "DocumentTemplate_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

