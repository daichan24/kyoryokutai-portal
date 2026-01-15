-- ========================================
-- SNSPost.week フィールドの型不一致修正
-- ========================================
-- 
-- 問題: week フィールドが数値（例: 3）で保存されているが、
-- Prisma スキーマでは String 型（"YYYY-WWW" 形式）として定義されている
-- 
-- 解決策: 数値の week を "YYYY-WWW" 形式の文字列に変換

-- ========================================
-- Step 1: week フィールドを一時的に TEXT 型に変更
-- ========================================

-- week カラムの型を確認して、数値型の場合は TEXT に変更
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'SNSPost' 
    AND column_name = 'week'
    AND data_type IN ('integer', 'bigint', 'numeric', 'smallint')
  ) THEN
    ALTER TABLE "SNSPost" ALTER COLUMN "week" TYPE TEXT USING week::TEXT;
  END IF;
END $$;

-- ========================================
-- Step 2: 数値の week を "YYYY-WWW" 形式に変換
-- ========================================

-- postedAt がある場合、そこから week を生成
-- weekBoundary.ts のロジックに合わせて "YYYY-WWW" 形式（例: "2026-W03"）を生成
UPDATE "SNSPost"
SET "week" = (
  WITH date_info AS (
    SELECT 
      "postedAt"::TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo' as posted_at_jst
    FROM "SNSPost" s2
    WHERE s2.id = "SNSPost".id
  ),
  monday_calc AS (
    SELECT 
      posted_at_jst,
      -- 月曜日を取得（0=日曜, 1=月曜, ...）
      EXTRACT(DOW FROM posted_at_jst) as dow,
      -- 月曜9:00 JSTを計算
      DATE_TRUNC('day', posted_at_jst) + 
      INTERVAL '9 hours' - 
      (CASE 
        WHEN EXTRACT(DOW FROM posted_at_jst) = 0 THEN INTERVAL '6 days'
        ELSE INTERVAL '1 day' * (EXTRACT(DOW FROM posted_at_jst) - 1)
      END) as monday_9am
    FROM date_info
  )
  SELECT 
    TO_CHAR(monday_9am, 'YYYY') || '-W' || 
    LPAD(
      TO_CHAR(
        (EXTRACT(DOY FROM monday_9am)::INTEGER - 1) / 7 + 1,
        'FM00'
      ),
      2,
      '0'
    )
  FROM monday_calc
)
WHERE "week" ~ '^[0-9]+$'  -- 数値のみの文字列（例: "3"）
  AND "postedAt" IS NOT NULL;

-- postedAt がない場合、createdAt から week を生成
UPDATE "SNSPost"
SET "week" = (
  WITH date_info AS (
    SELECT 
      "createdAt"::TIMESTAMP AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tokyo' as created_at_jst
    FROM "SNSPost" s2
    WHERE s2.id = "SNSPost".id
  ),
  monday_calc AS (
    SELECT 
      created_at_jst,
      DATE_TRUNC('day', created_at_jst) + 
      INTERVAL '9 hours' - 
      (CASE 
        WHEN EXTRACT(DOW FROM created_at_jst) = 0 THEN INTERVAL '6 days'
        ELSE INTERVAL '1 day' * (EXTRACT(DOW FROM created_at_jst) - 1)
      END) as monday_9am
    FROM date_info
  )
  SELECT 
    TO_CHAR(monday_9am, 'YYYY') || '-W' || 
    LPAD(
      TO_CHAR(
        (EXTRACT(DOY FROM monday_9am)::INTEGER - 1) / 7 + 1,
        'FM00'
      ),
      2,
      '0'
    )
  FROM monday_calc
)
WHERE "week" ~ '^[0-9]+$'  -- 数値のみの文字列
  AND "postedAt" IS NULL
  AND "createdAt" IS NOT NULL;

-- それでも変換できない場合、現在の年と週番号を使用
UPDATE "SNSPost"
SET "week" = (
  WITH now_jst AS (
    SELECT CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Tokyo' as now_jst
  ),
  monday_calc AS (
    SELECT 
      DATE_TRUNC('day', now_jst) + 
      INTERVAL '9 hours' - 
      (CASE 
        WHEN EXTRACT(DOW FROM now_jst) = 0 THEN INTERVAL '6 days'
        ELSE INTERVAL '1 day' * (EXTRACT(DOW FROM now_jst) - 1)
      END) as monday_9am
    FROM now_jst
  )
  SELECT 
    TO_CHAR(monday_9am, 'YYYY') || '-W' || 
    LPAD(
      TO_CHAR(
        (EXTRACT(DOY FROM monday_9am)::INTEGER - 1) / 7 + 1,
        'FM00'
      ),
      2,
      '0'
    )
  FROM monday_calc
)
WHERE "week" ~ '^[0-9]+$'  -- 数値のみの文字列
  AND "postedAt" IS NULL
  AND "createdAt" IS NULL;

-- ========================================
-- Step 3: 重複データの削除（unique 制約のため）
-- ========================================

-- userId_week の重複を削除（古いデータを優先）
DELETE FROM "SNSPost" a
USING "SNSPost" b
WHERE a.id < b.id
  AND a."userId" = b."userId"
  AND a."week" = b."week"
  AND a."week" ~ '^[0-9]{4}-W[0-9]{2}$';  -- 変換済みのデータのみ

-- ========================================
-- Step 4: データ整合性の確認
-- ========================================

-- 変換後のデータ数を確認（ログ用）
DO $$
DECLARE
  total_count INTEGER;
  invalid_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM "SNSPost";
  SELECT COUNT(*) INTO invalid_count 
  FROM "SNSPost" 
  WHERE "week" !~ '^[0-9]{4}-W[0-9]{2}$';  -- "YYYY-WWW" 形式（例: "2026-W03"）でないもの
  
  RAISE NOTICE 'SNSPost 総数: % 件', total_count;
  IF invalid_count > 0 THEN
    RAISE NOTICE '警告: % 件の week が "YYYY-WWW" 形式ではありません', invalid_count;
  ELSE
    RAISE NOTICE 'すべての week が "YYYY-WWW" 形式に変換されました';
  END IF;
END $$;
