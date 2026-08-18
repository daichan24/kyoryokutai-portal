-- AlterTable
ALTER TABLE "Inspection" ADD COLUMN "startTime" TEXT;
ALTER TABLE "Inspection" ADD COLUMN "endTime" TEXT;

-- CreateTable
CREATE TABLE "InspectionAttachment" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "dataBase64" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InspectionAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InspectionAttachment_inspectionId_idx" ON "InspectionAttachment"("inspectionId");

-- AddForeignKey
ALTER TABLE "InspectionAttachment" ADD CONSTRAINT "InspectionAttachment_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "Inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
