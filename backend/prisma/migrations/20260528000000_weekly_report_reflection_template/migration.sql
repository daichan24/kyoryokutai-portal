ALTER TABLE "WeeklyReport"
ADD COLUMN "reflection" TEXT;

ALTER TABLE "DocumentTemplate"
ADD COLUMN "weeklyReportActivityLabel" TEXT,
ADD COLUMN "weeklyReportNextPlanLabel" TEXT,
ADD COLUMN "weeklyReportReflectionLabel" TEXT,
ADD COLUMN "weeklyReportNoteLabel" TEXT;
