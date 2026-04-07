-- AlterTable: User に notepadEnabled フィールドを追加
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "notepadEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable: Notepad
CREATE TABLE IF NOT EXISTS "Notepad" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "content" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notepad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notepad_userId_order_idx" ON "Notepad"("userId", "order");

-- AddForeignKey
ALTER TABLE "Notepad" ADD CONSTRAINT "Notepad_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
