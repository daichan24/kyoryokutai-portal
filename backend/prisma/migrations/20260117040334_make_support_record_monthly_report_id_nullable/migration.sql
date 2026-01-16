-- AlterTable: Make monthlyReportId nullable in SupportRecord
ALTER TABLE "SupportRecord" ALTER COLUMN "monthlyReportId" DROP NOT NULL;
