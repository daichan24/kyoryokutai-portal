-- CreateEnum
CREATE TYPE "ActivityExpenseCategory" AS ENUM ('TRAVEL', 'SUPPLIES', 'PRINTING', 'COMMUNICATION', 'ADVERTISING', 'FEES', 'INSURANCE', 'RENTAL', 'EQUIPMENT', 'CONTRIBUTION');

-- AlterTable
ALTER TABLE "ActivityExpenseEntry" ADD COLUMN "category" "ActivityExpenseCategory";
ALTER TABLE "ActivityExpenseEntry" ADD COLUMN "counterparty" VARCHAR(500);
