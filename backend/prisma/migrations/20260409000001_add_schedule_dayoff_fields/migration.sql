-- CreateEnum
CREATE TYPE "DayOffType" AS ENUM ('PAID', 'UNPAID', 'COMPENSATORY', 'TIME_ADJUST');

-- AlterTable: Schedule に休日出勤・休日フィールド追加
ALTER TABLE "Schedule" ADD COLUMN "isHolidayWork" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Schedule" ADD COLUMN "isDayOff" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Schedule" ADD COLUMN "dayOffType" "DayOffType";
