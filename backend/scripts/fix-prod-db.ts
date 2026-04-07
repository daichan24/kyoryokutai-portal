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
    console.log('\n[SNSPost indexes BEFORE fix]');
    indexes.forEach(idx => console.log(`  ${idx.indexname}: ${idx.indexdef}`));
  } catch (e) {
    console.error('Failed to list indexes:', e);
  }

  // 2. 古い userId+week のユニーク制約を削除（存在する場合）
  // まず実際に存在するインデックスを確認してから削除
  try {
    const allIndexes = await prisma.$queryRaw<Array<{indexname: string}>>`
      SELECT indexname FROM pg_indexes WHERE tablename = 'SNSPost';
    `;
    const indexNames = allIndexes.map(i => i.indexname);
    console.log('All SNSPost indexes:', indexNames);

    // userId+week のみのユニーク制約（postTypeなし）を削除
    for (const idxName of indexNames) {
      // postTypeを含まないユニーク制約を削除対象とする
      if (idxName.includes('userId') && idxName.includes('week') && !idxName.includes('postType') && idxName !== 'SNSPost_userId_week_idx') {
        try {
          await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "${idxName}";`);
          console.log(`✓ Dropped old unique index: ${idxName}`);
        } catch (e: any) {
          console.log(`  Failed to drop ${idxName}: ${e.message}`);
        }
      }
    }
  } catch (e: any) {
    console.log('Index scan failed:', e.message);
  }

  // 念のため既知の古いインデックス名も削除試行
  const oldIndexNames = [
    'SNSPost_userId_week_key',
    'SNSPost_userId_week_unique',
    'SNSPost_userId_weekStart_key',
    'SNSPost_userId_weekStart_postType_key',
  ];
  for (const idxName of oldIndexNames) {
    try {
      await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "${idxName}";`);
      console.log(`✓ Dropped old index (if existed): ${idxName}`);
    } catch (e: any) {
      console.log(`  Skip drop ${idxName}: ${e.message}`);
    }
  }

  // 3. userId+week+postType のユニーク制約を作成（存在しない場合）
  try {
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "SNSPost_userId_week_postType_key" ON "SNSPost" ("userId", week, "postType");`
    );
    console.log('✓ SNSPost_userId_week_postType_key unique index created/verified');
  } catch (e: any) {
    console.error('Failed to create SNSPost unique index:', e.message);
  }

  // 4. GovernmentAttendanceStatus enumを作成
  try {
    await prisma.$executeRawUnsafe(
      `CREATE TYPE "GovernmentAttendanceStatus" AS ENUM ('PRESENT', 'REMOTE', 'ABSENT', 'HALF_DAY');`
    );
    console.log('✓ GovernmentAttendanceStatus enum created');
  } catch (e: any) {
    if (e.message?.includes('already exists')) {
      console.log('  GovernmentAttendanceStatus enum already exists');
    } else {
      console.log('GovernmentAttendanceStatus enum:', e.message);
    }
  }

  // 5. GovernmentAttendanceテーブルの確認・作成
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
    console.log('✓ GovernmentAttendance table created/verified');
  } catch (e: any) {
    console.log('GovernmentAttendance table:', e.message);
  }

  // 6. GovernmentAttendanceのユニーク制約
  try {
    await prisma.$executeRawUnsafe(
      `CREATE UNIQUE INDEX IF NOT EXISTS "GovernmentAttendance_userId_date_key" ON "GovernmentAttendance" ("userId", "date");`
    );
    console.log('✓ GovernmentAttendance_userId_date_key OK');
  } catch (e: any) {
    console.log('GovernmentAttendance unique index:', e.message);
  }

  // 7. GovernmentAttendanceのカラム追加
  for (const col of [
    `ALTER TABLE "GovernmentAttendance" ADD COLUMN IF NOT EXISTS "endDate" DATE;`,
    `ALTER TABLE "GovernmentAttendance" ADD COLUMN IF NOT EXISTS "startTime" VARCHAR(5);`,
    `ALTER TABLE "GovernmentAttendance" ADD COLUMN IF NOT EXISTS "endTime" VARCHAR(5);`,
  ]) {
    try {
      await prisma.$executeRawUnsafe(col);
    } catch (e: any) {
      console.log('GovernmentAttendance column:', e.message);
    }
  }
  console.log('✓ GovernmentAttendance columns OK');

  // 8. AnnouncementConfirmTarget enumを作成
  try {
    await prisma.$executeRawUnsafe(
      `CREATE TYPE "AnnouncementConfirmTarget" AS ENUM ('ALL', 'MEMBER');`
    );
    console.log('✓ AnnouncementConfirmTarget enum created');
  } catch (e: any) {
    if (e.message?.includes('already exists')) {
      console.log('  AnnouncementConfirmTarget enum already exists');
    } else {
      console.log('AnnouncementConfirmTarget enum:', e.message);
    }
  }

  // 9. Announcement.confirmTargetカラム追加
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "confirmTarget" TEXT NOT NULL DEFAULT 'ALL';`
    );
    console.log('✓ Announcement.confirmTarget OK');
  } catch (e: any) {
    console.log('Announcement.confirmTarget:', e.message);
  }

  // 10. Schedule.customColorカラム追加
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Schedule" ADD COLUMN IF NOT EXISTS "customColor" VARCHAR(20);`
    );
    console.log('✓ Schedule.customColor OK');
  } catch (e: any) {
    console.log('Schedule.customColor:', e.message);
  }

  // 13. Project.isAchieved / achievedAt / relatedContactIds カラム追加
  for (const sql of [
    `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "isAchieved" BOOLEAN NOT NULL DEFAULT false;`,
    `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "achievedAt" TIMESTAMP(3);`,
    `ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "relatedContactIds" TEXT[] DEFAULT ARRAY[]::TEXT[];`,
  ]) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch (e: any) {
      console.log('Project column:', e.message);
    }
  }
  console.log('✓ Project.isAchieved / achievedAt / relatedContactIds OK');

  // 14. SNSAccount テーブルの確認・作成
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SNSAccount" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "platform" VARCHAR(50) NOT NULL,
        "accountName" VARCHAR(200) NOT NULL,
        "displayName" VARCHAR(200),
        "url" TEXT,
        "isDefault" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SNSAccount_pkey" PRIMARY KEY ("id")
      );
    `);
    console.log('✓ SNSAccount table OK');
  } catch (e: any) {
    console.log('SNSAccount table:', e.message);
  }

  // 15. SNSPost.accountId カラム追加
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "SNSPost" ADD COLUMN IF NOT EXISTS "accountId" TEXT;`
    );
    console.log('✓ SNSPost.accountId OK');
  } catch (e: any) {
    console.log('SNSPost.accountId:', e.message);
  }

  // 11. 修正後のSNSPostインデックスを再表示
  try {
    const indexes = await prisma.$queryRaw<Array<{indexname: string; indexdef: string}>>`
      SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'SNSPost' ORDER BY indexname;
    `;
    console.log('\n[SNSPost indexes AFTER fix]');
    indexes.forEach(idx => console.log(`  ${idx.indexname}: ${idx.indexdef}`));
  } catch (e) {
    console.error('Failed to list indexes after fix:', e);
  }

  // 12. 既存SNSPostデータの確認
  try {
    const posts = await prisma.$queryRaw<Array<{userId: string; week: string; postType: string; count: bigint}>>`
      SELECT "userId", week, "postType", COUNT(*) as count
      FROM "SNSPost"
      GROUP BY "userId", week, "postType"
      HAVING COUNT(*) > 1;
    `;
    if (posts.length > 0) {
      console.log('\n[WARNING] Duplicate SNSPost records found:');
      posts.forEach(p => console.log(`  userId=${p.userId} week=${p.week} postType=${p.postType} count=${p.count}`));
    } else {
      console.log('\n✓ No duplicate SNSPost records');
    }
  } catch (e: any) {
    console.log('SNSPost duplicate check:', e.message);
  }

  console.log('\n=== Done ===');
  await prisma.$disconnect();
}

main().catch(console.error);
