-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "category" TEXT,
ADD COLUMN     "relatedMembers" TEXT[],
ADD COLUMN     "relationshipType" TEXT;

-- CreateIndex
CREATE INDEX "Contact_category_idx" ON "Contact"("category");

-- CreateIndex
CREATE INDEX "Contact_relationshipType_idx" ON "Contact"("relationshipType");
