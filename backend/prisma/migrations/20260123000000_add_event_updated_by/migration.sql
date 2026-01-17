-- AlterTable
ALTER TABLE "Event" ADD COLUMN "updatedBy" TEXT;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "Event_updatedBy_idx" ON "Event"("updatedBy");

