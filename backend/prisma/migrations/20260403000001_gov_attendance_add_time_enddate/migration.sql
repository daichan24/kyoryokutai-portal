-- AlterTable: GovernmentAttendanceに終了日・時間フィールドを追加
ALTER TABLE "GovernmentAttendance" ADD COLUMN "endDate" DATE;
ALTER TABLE "GovernmentAttendance" ADD COLUMN "startTime" VARCHAR(5);
ALTER TABLE "GovernmentAttendance" ADD COLUMN "endTime" VARCHAR(5);
