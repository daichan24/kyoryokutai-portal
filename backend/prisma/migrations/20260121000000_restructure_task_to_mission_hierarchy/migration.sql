-- ========================================
-- リファクタリング: Task を Mission 配下に変更（projectId は任意）
-- ========================================
-- 
-- 変更内容:
-- 1. Task モデルを変更: missionId 必須化、projectId 任意化
-- 2. 既存データの移行: projectId から missionId を推測
-- 3. 外部キー制約の更新
--
-- 安全な段階的移行:
-- - 既存データを保持しながら新しい構造に移行
-- - データ損失を防ぐためのバックフィル処理

-- ========================================
-- Step 1: Task テーブルの構造変更準備
-- ========================================

-- 1-1. 既存の Task で projectId がある場合、その Project の missionId を取得して設定
-- まず、missionId カラムが存在しない場合は追加（一時的に nullable）
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Task' 
    AND column_name = 'missionId'
  ) THEN
    ALTER TABLE "Task" ADD COLUMN "missionId" TEXT;
    RAISE NOTICE 'missionId カラムを追加しました';
  END IF;
END $$;

-- 1-2. projectId から missionId を推測して設定
UPDATE "Task" t
SET "missionId" = (
  SELECT p."missionId"
  FROM "Project" p
  WHERE p."id" = t."projectId"
  LIMIT 1
),
"updatedAt" = CURRENT_TIMESTAMP
WHERE t."missionId" IS NULL 
  AND t."projectId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "Project" p 
    WHERE p."id" = t."projectId" 
    AND p."missionId" IS NOT NULL
  );

-- 1-3. Project に missionId がない場合、Project の userId から Mission を探す
UPDATE "Task" t
SET "missionId" = (
  SELECT m."id"
  FROM "Project" p
  INNER JOIN "Mission" m ON p."userId" = m."userId"
  WHERE p."id" = t."projectId"
  ORDER BY m."createdAt" ASC
  LIMIT 1
),
"updatedAt" = CURRENT_TIMESTAMP
WHERE t."missionId" IS NULL 
  AND t."projectId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "Project" p 
    WHERE p."id" = t."projectId"
    AND EXISTS (
      SELECT 1 FROM "Mission" m WHERE m."userId" = p."userId"
    )
  );

-- 1-4. それでも missionId が null の Task がある場合の警告
DO $$
DECLARE
  null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_count
  FROM "Task"
  WHERE "missionId" IS NULL;
  
  IF null_count > 0 THEN
    RAISE NOTICE '警告: % 件の Task で missionId が null です。手動で設定してください。', null_count;
  END IF;
END $$;

-- ========================================
-- Step 2: 外部キー制約の更新
-- ========================================

-- 2-1. 既存の外部キー制約を削除（projectId の必須制約）
DO $$
BEGIN
  -- projectId の外部キー制約を削除
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'Task' 
    AND constraint_name LIKE '%projectId%'
    AND constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_projectId_fkey";
    RAISE NOTICE 'projectId の外部キー制約を削除しました';
  END IF;
END $$;

-- 2-2. missionId の外部キー制約を追加（既に存在する場合はスキップ）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'Task' 
    AND constraint_name = 'Task_missionId_fkey'
  ) THEN
    ALTER TABLE "Task" 
    ADD CONSTRAINT "Task_missionId_fkey" 
    FOREIGN KEY ("missionId") 
    REFERENCES "Mission"("id") 
    ON DELETE CASCADE;
    RAISE NOTICE 'missionId の外部キー制約を追加しました';
  END IF;
END $$;

-- 2-3. projectId の外部キー制約を再追加（nullable として）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'Task' 
    AND constraint_name = 'Task_projectId_fkey'
  ) THEN
    ALTER TABLE "Task" 
    ADD CONSTRAINT "Task_projectId_fkey" 
    FOREIGN KEY ("projectId") 
    REFERENCES "Project"("id") 
    ON DELETE SET NULL;
    RAISE NOTICE 'projectId の外部キー制約を再追加しました（nullable）';
  END IF;
END $$;

-- ========================================
-- Step 3: カラムの制約を更新
-- ========================================

-- 3-1. projectId を nullable に変更（既に nullable の場合はスキップ）
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Task' 
    AND column_name = 'projectId' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "Task" ALTER COLUMN "projectId" DROP NOT NULL;
    RAISE NOTICE 'projectId を nullable に変更しました';
  END IF;
END $$;

-- 3-2. missionId を必須に変更（既に必須の場合はスキップ）
-- 注意: null のデータがある場合はエラーになるため、先にバックフィルが必要
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Task' 
    AND column_name = 'missionId' 
    AND is_nullable = 'YES'
  ) THEN
    -- まず、null のデータがないことを確認
    IF NOT EXISTS (SELECT 1 FROM "Task" WHERE "missionId" IS NULL) THEN
      ALTER TABLE "Task" ALTER COLUMN "missionId" SET NOT NULL;
      RAISE NOTICE 'missionId を必須に変更しました';
    ELSE
      RAISE EXCEPTION 'missionId が null の Task が存在します。先にバックフィルを実行してください。';
    END IF;
  END IF;
END $$;

-- ========================================
-- Step 4: インデックスの更新
-- ========================================

-- 4-1. 既存のインデックスを削除（必要に応じて）
DROP INDEX IF EXISTS "Task_projectId_idx";
DROP INDEX IF EXISTS "Task_projectId_status_idx";

-- 4-2. 新しいインデックスを作成
CREATE INDEX IF NOT EXISTS "Task_missionId_idx" ON "Task"("missionId");
CREATE INDEX IF NOT EXISTS "Task_projectId_idx" ON "Task"("projectId");
CREATE INDEX IF NOT EXISTS "Task_missionId_status_idx" ON "Task"("missionId", "status");
CREATE INDEX IF NOT EXISTS "Task_projectId_status_idx" ON "Task"("projectId", "status");

-- ========================================
-- Step 5: データ整合性の確認
-- ========================================

DO $$
DECLARE
  total_count INTEGER;
  null_mission_count INTEGER;
  null_project_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM "Task";
  SELECT COUNT(*) INTO null_mission_count FROM "Task" WHERE "missionId" IS NULL;
  SELECT COUNT(*) INTO null_project_count FROM "Task" WHERE "projectId" IS NULL;
  
  RAISE NOTICE 'Task 総数: % 件', total_count;
  RAISE NOTICE 'missionId が null: % 件', null_mission_count;
  RAISE NOTICE 'projectId が null: % 件', null_project_count;
  
  IF null_mission_count > 0 THEN
    RAISE WARNING '警告: % 件の Task で missionId が null です。手動で設定してください。', null_mission_count;
  ELSE
    RAISE NOTICE '✅ すべての Task に missionId が設定されました';
  END IF;
END $$;

