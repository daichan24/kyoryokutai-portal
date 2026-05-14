-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "ActivityExpenseEntry" ADD COLUMN "status" "ExpenseStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "ActivityExpenseEntry" ADD COLUMN "rejectionReason" TEXT;
