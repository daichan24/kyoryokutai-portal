-- CreateEnum
CREATE TYPE "AnnouncementConfirmTarget" AS ENUM ('ALL', 'MEMBER');

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN "confirmTarget" "AnnouncementConfirmTarget" NOT NULL DEFAULT 'ALL';
