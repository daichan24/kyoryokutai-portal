-- ========================================
-- リファクタリング: Task を Project 配下に変更 + SNSPost.postedAt 修正
-- ========================================
-- 
-- 変更内容:
-- 1. SNSPost.postedAt の null データを修正（P2032 エラー解消）
-- 2. Task モデルを変更: missionId 削除、projectId 必須化
-- 3. 既存データの移行: missionId のみの Task → Project に紐づけ
--
-- 安全な段階的移行:
-- - 既存データを保持しながら新しい構造に移行
-- - データ損失を防ぐためのバックフィル処理

-- ========================================
-- Step 1: SNSPost.postedAt の null 修正
-- ========================================

-- 1-1. postedAt を一時的に nullable に（既に nullable の場合はスキップ）
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'SNSPost' 
    AND column_name = 'postedAt' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "SNSPost" ALTER COLUMN "postedAt" DROP NOT NULL;
  END IF;
END $$;

-- 1-2. null データにデフォルト値を設定
-- week フィールド（YYYY-WW形式）から投稿日時を推測
UPDATE "SNSPost"
SET "postedAt" = (
  -- YYYY-WW 形式から年と週を抽出して、その週の月曜日 9:00 JST を設定
  -- 例: "2026-03" → 2026年の第3週の月曜日
  SELECT 
    (DATE_TRUNC('year', CURRENT_DATE) + 
     (CAST(SUBSTRING(week FROM 1 FOR 4) AS INTEGER) - EXTRACT(YEAR FROM CURRENT_DATE) || ' years')::INTERVAL +
     (CAST(SUBSTRING(week FROM 6) AS INTEGER) || ' weeks')::INTERVAL)::DATE
    + INTERVAL '9 hours'
)
WHERE "postedAt" IS NULL;

-- 1-3. まだ null の場合は createdAt を使用（フォールバック）
UPDATE "SNSPost"
SET "postedAt" = "createdAt"
WHERE "postedAt" IS NULL;

-- 1-4. postedAt を必須に戻す
ALTER TABLE "SNSPost" ALTER COLUMN "postedAt" SET NOT NULL;

-- ========================================
-- Step 2: Task モデルの変更準備
-- ========================================

-- 2-1. 既存の Task で projectId が null の場合、missionId から Project を探して設定
-- まず、missionId から関連する Project を探す
UPDATE "Task" t
SET "projectId" = (
  SELECT p."id"
  FROM "Project" p
  WHERE p."missionId" = t."missionId"
  ORDER BY p."createdAt" ASC
  LIMIT 1
),
"updatedAt" = CURRENT_TIMESTAMP
WHERE t."projectId" IS NULL 
  AND t."missionId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "Project" p WHERE p."missionId" = t."missionId"
  );

-- 2-2. Mission に Project がない場合の処理
-- Mission の userId から、そのユーザーの最初の Project を使用
UPDATE "Task" t
SET "projectId" = (
  SELECT p."id"
  FROM "Project" p
  INNER JOIN "Mission" m ON p."userId" = m."userId"
  WHERE m."id" = t."missionId"
  ORDER BY p."createdAt" ASC
  LIMIT 1
),
"updatedAt" = CURRENT_TIMESTAMP
WHERE t."projectId" IS NULL 
  AND t."missionId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "Mission" m 
    WHERE m."id" = t."missionId"
    AND EXISTS (
      SELECT 1 FROM "Project" p WHERE p."userId" = m."userId"
    )
  );

-- 2-3. それでも projectId が null の Task がある場合の警告
-- 注意: この場合、データ損失を避けるため、これらの Task は削除せずに残す
-- ただし、projectId を必須にする前に、これらのデータを確認する必要がある
DO $$
DECLARE
  orphan_task_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphan_task_count
  FROM "Task"
  WHERE "projectId" IS NULL;
  
  IF orphan_task_count > 0 THEN
    RAISE NOTICE '警告: % 件の Task が projectId を持っていません。これらの Task は移行できません。', orphan_task_count;
    RAISE NOTICE 'これらの Task を確認して、手動で projectId を設定するか、削除してください。';
  END IF;
END $$;

-- ========================================
-- Step 3: Task モデルの変更
-- ========================================

-- 3-1. projectId を必須にする（既存の null は上記で処理済み）
-- ただし、まだ null がある場合はエラーになるので、先に確認
ALTER TABLE "Task" ALTER COLUMN "projectId" SET NOT NULL;

-- 3-2. missionId の外部キー制約を削除
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_missionId_fkey";

-- 3-3. missionId のインデックスを削除
DROP INDEX IF EXISTS "Task_missionId_idx";
DROP INDEX IF EXISTS "Task_missionId_status_idx";

-- 3-4. missionId カラムを削除
ALTER TABLE "Task" DROP COLUMN "missionId";

-- 3-5. projectId の外部キー制約を更新（既存の制約を削除して再作成）
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_projectId_fkey";
ALTER TABLE "Task" 
  ADD CONSTRAINT "Task_projectId_fkey" 
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE;

-- 3-6. projectId のインデックスを確認（既に存在する場合はスキップ）
CREATE INDEX IF NOT EXISTS "Task_projectId_idx" ON "Task"("projectId");
CREATE INDEX IF NOT EXISTS "Task_projectId_status_idx" ON "Task"("projectId", "status");

-- ========================================
-- Step 4: データ整合性の確認
-- ========================================

-- 4-1. 移行後のデータ数を確認（ログ用）
DO $$
DECLARE
  task_count INTEGER;
  project_count INTEGER;
  mission_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO task_count FROM "Task";
  SELECT COUNT(*) INTO project_count FROM "Project";
  SELECT COUNT(*) INTO mission_count FROM "Mission";
  
  RAISE NOTICE '移行完了: Task % 件, Project % 件, Mission % 件', task_count, project_count, mission_count;
END $$;

