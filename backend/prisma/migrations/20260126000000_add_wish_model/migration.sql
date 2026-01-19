-- CreateEnum
CREATE TYPE "WishStatus" AS ENUM ('ACTIVE', 'DONE', 'PAUSED');

-- CreateEnum
CREATE TYPE "WishDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "WishEstimate" AS ENUM ('S', 'M', 'L');

-- CreateEnum
CREATE TYPE "WishPriority" AS ENUM ('LOW', 'MID', 'HIGH');

-- CreateEnum
CREATE TYPE "WishCheckinType" AS ENUM ('REFLECTION', 'NOTE');

-- CreateTable
CREATE TABLE "Wish" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT,
    "status" "WishStatus" NOT NULL DEFAULT 'ACTIVE',
    "difficulty" "WishDifficulty",
    "estimate" "WishEstimate",
    "priority" "WishPriority",
    "dueMonth" SMALLINT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "memo" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishCheckin" (
    "id" TEXT NOT NULL,
    "wishId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "WishCheckinType" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishCheckin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Wish_userId_idx" ON "Wish"("userId");

-- CreateIndex
CREATE INDEX "Wish_status_idx" ON "Wish"("status");

-- CreateIndex
CREATE INDEX "Wish_dueMonth_idx" ON "Wish"("dueMonth");

-- CreateIndex
CREATE INDEX "Wish_createdAt_idx" ON "Wish"("createdAt");

-- CreateIndex
CREATE INDEX "WishCheckin_wishId_idx" ON "WishCheckin"("wishId");

-- CreateIndex
CREATE INDEX "WishCheckin_userId_idx" ON "WishCheckin"("userId");

-- CreateIndex
CREATE INDEX "WishCheckin_createdAt_idx" ON "WishCheckin"("createdAt");

-- AddForeignKey
ALTER TABLE "Wish" ADD CONSTRAINT "Wish_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishCheckin" ADD CONSTRAINT "WishCheckin_wishId_fkey" FOREIGN KEY ("wishId") REFERENCES "Wish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishCheckin" ADD CONSTRAINT "WishCheckin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

