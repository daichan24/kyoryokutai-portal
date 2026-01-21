-- CreateTable
CREATE TABLE "DriveLink" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriveLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DriveLink_order_idx" ON "DriveLink"("order");

