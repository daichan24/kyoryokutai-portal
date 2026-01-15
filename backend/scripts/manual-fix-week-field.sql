-- ========================================
-- SNSPost.week フィールド修正（手動実行用）
-- ========================================
-- 
-- このスクリプトは、失敗したマイグレーションを手動で修正するために使用します
-- Render のデータベース管理画面から実行してください
-- 
-- 注意: 実行前に必ずバックアップを取得してください

-- ========================================
-- Step 1: week フィールドを TEXT 型に正規化
-- ========================================

DO $$ 
BEGIN
  -- 数値型の場合のみ変換
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'SNSPost' 
    AND column_name = 'week'
    AND data_type IN ('integer', 'bigint', 'numeric', 'smallint')
  ) THEN
    ALTER TABLE "SNSPost" ALTER COLUMN "week" TYPE TEXT USING week::TEXT;
    RAISE NOTICE 'week フィールドを TEXT 型に変換しました';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'SNSPost' 
    AND column_name = 'week'
    AND data_type NOT IN ('text', 'character varying', 'varchar')
  ) THEN
    ALTER TABLE "SNSPost" ALTER COLUMN "week" TYPE TEXT USING week::TEXT;
    RAISE NOTICE 'week フィールドを TEXT 型に変換しました';
  ELSE
    RAISE NOTICE 'week フィールドは既に TEXT 型です';
  END IF;
END $$;

-- ========================================
-- Step 2: 数値のみの week を "YYYY-WWW" 形式に変換
-- ========================================

-- 関数: 日付から week を計算
CREATE OR REPLACE FUNCTION calculate_week_from_date(target_date TIMESTAMP WITH TIME ZONE)
RETURNS TEXT AS $$
DECLARE
  jst_date TIMESTAMP;
  year_val INTEGER;
  week_num INTEGER;
  monday_date DATE;
BEGIN
  -- JST に変換
  jst_date := target_date AT TIME ZONE 'Asia/Tokyo';
  
  -- 月曜9:00を基準に週を計算
  monday_date := DATE_TRUNC('week', jst_date::DATE) + INTERVAL '1 day';
  IF EXTRACT(DOW FROM jst_date::DATE) = 0 THEN
    monday_date := monday_date - INTERVAL '7 days';
  END IF;
  
  -- 年を取得
  year_val := EXTRACT(YEAR FROM monday_date)::INTEGER;
  
  -- 年始からの週番号を計算（簡易版）
  week_num := ((EXTRACT(DOY FROM monday_date)::INTEGER - 1) / 7) + 1;
  
  -- "YYYY-WWW" 形式で返す
  RETURN year_val || '-W' || LPAD(week_num::TEXT, 2, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- postedAt がある場合
UPDATE "SNSPost"
SET "week" = calculate_week_from_date("postedAt")
WHERE "week" ~ '^[0-9]+$'  -- 数値のみ（例: "3"）
  AND "postedAt" IS NOT NULL;

-- postedAt がない場合、createdAt から
UPDATE "SNSPost"
SET "week" = calculate_week_from_date("createdAt")
WHERE "week" ~ '^[0-9]+$'
  AND "postedAt" IS NULL
  AND "createdAt" IS NOT NULL;

-- どちらもない場合、現在日時から
UPDATE "SNSPost"
SET "week" = calculate_week_from_date(CURRENT_TIMESTAMP)
WHERE "week" ~ '^[0-9]+$'
  AND "postedAt" IS NULL
  AND "createdAt" IS NULL;

-- 関数を削除（一時的なもの）
DROP FUNCTION IF EXISTS calculate_week_from_date(TIMESTAMP WITH TIME ZONE);

-- ========================================
-- Step 3: unique 制約の重複を処理
-- ========================================

-- 重複を確認
DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO dup_count
  FROM (
    SELECT "userId", "week", COUNT(*) as cnt
    FROM "SNSPost"
    WHERE "week" ~ '^[0-9]{4}-W[0-9]{2}$'  -- 変換済みの形式
    GROUP BY "userId", "week"
    HAVING COUNT(*) > 1
  ) dups;
  
  IF dup_count > 0 THEN
    RAISE NOTICE '重複データを削除します: % 件', dup_count;
    
    -- 重複がある場合、古いデータ（id が小さい）を残し、新しいデータを削除
    DELETE FROM "SNSPost"
    WHERE id IN (
      SELECT b.id
      FROM "SNSPost" a
      INNER JOIN "SNSPost" b
        ON a."userId" = b."userId"
        AND a."week" = b."week"
        AND a."week" ~ '^[0-9]{4}-W[0-9]{2}$'
        AND a.id < b.id
    );
  ELSE
    RAISE NOTICE '重複データはありません';
  END IF;
END $$;

-- ========================================
-- Step 4: データ整合性の確認
-- ========================================

DO $$
DECLARE
  total_count INTEGER;
  invalid_count INTEGER;
  numeric_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM "SNSPost";
  SELECT COUNT(*) INTO invalid_count 
  FROM "SNSPost" 
  WHERE "week" !~ '^[0-9]{4}-W[0-9]{2}$';
  SELECT COUNT(*) INTO numeric_count
  FROM "SNSPost"
  WHERE "week" ~ '^[0-9]+$';
  
  RAISE NOTICE 'SNSPost 総数: % 件', total_count;
  RAISE NOTICE '数値形式の week: % 件', numeric_count;
  IF invalid_count > 0 THEN
    RAISE NOTICE '警告: % 件の week が "YYYY-WWW" 形式ではありません', invalid_count;
  ELSE
    RAISE NOTICE 'すべての week が "YYYY-WWW" 形式に変換されました';
  END IF;
END $$;

-- ========================================
-- Step 5: 失敗したマイグレーションを「適用済み」としてマーク
-- ========================================

-- 失敗したマイグレーションのレコードを更新
UPDATE "_prisma_migrations"
SET finished_at = NOW(),
    applied_steps_count = 1
WHERE migration_name = '20260119000000_fix_snspost_week_format'
  AND finished_at IS NULL;

-- レコードが存在しない場合は作成
INSERT INTO "_prisma_migrations" (
  migration_name,
  checksum,
  finished_at,
  applied_steps_count,
  started_at
)
SELECT 
  '20260119000000_fix_snspost_week_format',
  '',
  NOW(),
  1,
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM "_prisma_migrations"
  WHERE migration_name = '20260119000000_fix_snspost_week_format'
);

RAISE NOTICE 'マイグレーションを「適用済み」としてマークしました';

