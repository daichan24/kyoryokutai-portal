-- CreateEnum
CREATE TYPE "GovernmentAttendanceStatus" AS ENUM ('PRESENT', 'REMOTE', 'ABSENT', 'HALF_DAY');

-- CreateTable
CREATE TABLE "GovernmentAttendance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "GovernmentAttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "note" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernmentAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GovernmentAttendance_userId_date_key" ON "GovernmentAttendance"("userId", "date");

-- CreateIndex
CREATE INDEX "GovernmentAttendance_userId_date_idx" ON "GovernmentAttendance"("userId", "date");

-- CreateIndex
CREATE INDEX "GovernmentAttendance_date_idx" ON "GovernmentAttendance"("date");

-- AddForeignKey
ALTER TABLE "GovernmentAttendance" ADD CONSTRAINT "GovernmentAttendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
