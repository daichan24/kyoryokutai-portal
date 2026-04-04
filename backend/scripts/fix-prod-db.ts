/**
 * 本番DBのスキーマを修正するスクリプト
 * 実行: DATABASE_URL=... npx tsx scripts/fix-prod-db.ts
 */
import prisma from '../src/lib/prisma';

async function main() {
  console.log('Checking and fixing production DB schema...');

  // GovernmentAttendanceテーブルの確認・作成
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "GovernmentAttendance" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "date" DATE NOT NULL,
        "endDate" DATE,
        "startTime" VARCHAR(5),
        "endTime" VARCHAR(5),
        "status" TEXT NOT NULL DEFAULT 'PRESENT',
        "note" VARCHAR(500),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "GovernmentAttendance_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('✓ GovernmentAttendance table OK');
  } catch (e) {
    console.log('GovernmentAttendance table:', e);
  }

  // GovernmentAttendanceStatusのenum作成
  try {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "GovernmentAttendanceStatus" AS ENUM ('PRESENT', 'REMOTE', 'ABSENT', 'HALF_DAY');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('✓ GovernmentAttendanceStatus enum OK');
  } catch (e) {
    console.log('GovernmentAttendanceStatus enum:', e);
  }

  // AnnouncementConfirmTargetのenum作成
  try {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "AnnouncementConfirmTarget" AS ENUM ('ALL', 'MEMBER');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    console.log('✓ AnnouncementConfirmTarget enum OK');
  } catch (e) {
    console.log('AnnouncementConfirmTarget enum:', e);
  }

  // AnnouncementテーブルにconfirmTargetカラムを追加
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Announcement" 
      ADD COLUMN IF NOT EXISTS "confirmTarget" "AnnouncementConfirmTarget" NOT NULL DEFAULT 'ALL';
    `);
    console.log('✓ Announcement.confirmTarget column OK');
  } catch (e) {
    console.log('Announcement.confirmTarget:', e);
  }

  // ScheduleテーブルにcustomColorカラムを追加
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Schedule" 
      ADD COLUMN IF NOT EXISTS "customColor" VARCHAR(20);
    `);
    console.log('✓ Schedule.customColor column OK');
  } catch (e) {
    console.log('Schedule.customColor:', e);
  }

  // ConsultationAssignedUsersテーブルの確認
  try {
    const result = await prisma.$queryRaw<Array<{count: bigint}>>`
      SELECT COUNT(*) as count FROM information_schema.tables 
      WHERE table_name = '_ConsultationAssignedUsers';
    `;
    console.log('_ConsultationAssignedUsers table exists:', result[0]?.count > 0n);
  } catch (e) {
    console.log('_ConsultationAssignedUsers check:', e);
  }

  console.log('Done!');
  await prisma.$disconnect();
}

main().catch(console.error);
