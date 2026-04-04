/**
 * 本番DBのスキーマを修正するスクリプト
 * 実行: DATABASE_URL=... npx tsx scripts/fix-prod-db.ts
 */
import prisma from '../src/lib/prisma';

async function main() {
  console.log('=== Checking and fixing production DB schema ===');

  // 1. SNSPostの現在のインデックス一覧を表示
  try {
    const indexes = await prisma.$queryRaw<Array<{indexname: string; indexdef: string}>>`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'SNSPost'
      ORDER BY indexname;
    `;
    console.log('\n[SNSPost indexes]');
    indexes.forEach(idx => console.log(`  ${idx.indexname}: ${idx.indexdef}`));
  } catch (e) {
    console.error('Failed to list indexes:', e);
  }

  // 2. 古い userId+week のユニーク制約を削除（存在する場合）
  const oldIndexNames = [
    'SNSPost_userId_week_key',
    'SNSPost_userId_week_unique',
    'SNSPost_userId_weekStart_key',
    'SNSPost_userId_weekStart_postType_key',
  ];
  for (const idxName of oldIndexNames) {
    try {
      await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "${idxName}";`);
      console.log(`✓ Dropped old index: ${idxName}`);
    } catch (e) {
      // 存在しない場合は無視
    }
  }

  // 3. userId+week+postType のユニーク制約を作成（存在しない場合）
  try {
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "SNSPost_userId_week_postType_key" 
      ON "SNSPost" ("userId", week, "postType");
    `);
    console.log('✓ SNSPost_userId_week_postType_key unique index created/verified');
  } catch (e: any) {
    console.error('Failed to create SNSPost unique index:', e.message);
  }

  // 4. GovernmentAttendanceテーブルの確認・作成
  try {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "GovernmentAttendanceStatus" AS ENUM ('PRESENT', 'REMOTE', 'ABSENT', 'HALF_DAY');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "GovernmentAttendance" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "date" DATE NOT NULL,
        "endDate" DATE,
        "startTime" VARCHAR(5),
        "endTime" VARCHAR(5),
        "status" "GovernmentAttendanceStatus" NOT NULL DEFAULT 'PRESENT',
        "note" VARCHAR(500),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "GovernmentAttendance_pkey" PRIMARY KEY ("id")
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "GovernmentAttendance_userId_date_key" 
      ON "GovernmentAttendance" ("userId", "date");
    `);
    console.log('✓ GovernmentAttendance table OK');
  } catch (e: any) {
    console.log('GovernmentAttendance:', e.message);
  }

  // 5. AnnouncementConfirmTargetのenum・カラム追加
  try {
    await prisma.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "AnnouncementConfirmTarget" AS ENUM ('ALL', 'MEMBER');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;
    `);
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Announcement" 
      ADD COLUMN IF NOT EXISTS "confirmTarget" "AnnouncementConfirmTarget" NOT NULL DEFAULT 'ALL';
    `);
    console.log('✓ Announcement.confirmTarget OK');
  } catch (e: any) {
    console.log('Announcement.confirmTarget:', e.message);
  }

  // 6. Schedule.customColorカラム追加
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Schedule" 
      ADD COLUMN IF NOT EXISTS "customColor" VARCHAR(20);
    `);
    console.log('✓ Schedule.customColor OK');
  } catch (e: any) {
    console.log('Schedule.customColor:', e.message);
  }

  // 7. GovernmentAttendanceのendDate/startTime/endTimeカラム追加
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "GovernmentAttendance" ADD COLUMN IF NOT EXISTS "endDate" DATE;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "GovernmentAttendance" ADD COLUMN IF NOT EXISTS "startTime" VARCHAR(5);`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "GovernmentAttendance" ADD COLUMN IF NOT EXISTS "endTime" VARCHAR(5);`);
    console.log('✓ GovernmentAttendance time columns OK');
  } catch (e: any) {
    console.log('GovernmentAttendance time columns:', e.message);
  }

  // 8. 修正後のSNSPostインデックスを再表示
  try {
    const indexes = await prisma.$queryRaw<Array<{indexname: string}>>`
      SELECT indexname FROM pg_indexes WHERE tablename = 'SNSPost' ORDER BY indexname;
    `;
    console.log('\n[SNSPost indexes after fix]');
    indexes.forEach(idx => console.log(`  ${idx.indexname}`));
  } catch (e) {
    console.error('Failed to list indexes after fix:', e);
  }

  console.log('\n=== Done ===');
  await prisma.$disconnect();
}

main().catch(console.error);
