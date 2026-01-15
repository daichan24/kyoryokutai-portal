-- ========================================
-- SNSPost.week フィールドの型不一致修正（v2 - 安全な再実行版）
-- ========================================
-- 
-- このマイグレーションは、失敗した 20260119000000_fix_snspost_week_format の
-- 修正を安全に適用するためのものです。
-- 
-- 特徴:
-- - 既に適用されている部分はスキップ（冪等性確保）
-- - 部分的に適用されていても安全に再実行可能
-- - エラーが発生しても続行可能

-- ========================================
-- Step 1: week フィールドを TEXT 型に正規化（安全・冪等）
-- ========================================

DO $$ 
BEGIN
  -- 数値型の場合のみ変換（既に TEXT の場合はスキップ）
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
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'week フィールドの型変換でエラーが発生しましたが、続行します: %', SQLERRM;
END $$;

-- ========================================
-- Step 2: 数値のみの week を "YYYY-WWW" 形式に変換（冪等）
-- ========================================

-- 関数: 日付から week を計算（既に存在する場合は置き換え）
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

-- postedAt がある場合（数値形式の week のみ更新、既に変換済みはスキップ）
DO $$
BEGIN
  UPDATE "SNSPost"
  SET "week" = calculate_week_from_date("postedAt")
  WHERE "week" ~ '^[0-9]+$'  -- 数値のみ（例: "3"）
    AND "postedAt" IS NOT NULL
    AND ("week" !~ '^[0-9]{4}-W[0-9]{2}$' OR "week" IS NULL);  -- 既に変換済みの場合はスキップ
  
  RAISE NOTICE 'postedAt から week を変換しました';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'postedAt からの week 変換でエラーが発生しましたが、続行します: %', SQLERRM;
END $$;

-- postedAt がない場合、createdAt から（数値形式の week のみ更新）
DO $$
BEGIN
  UPDATE "SNSPost"
  SET "week" = calculate_week_from_date("createdAt")
  WHERE "week" ~ '^[0-9]+$'
    AND "postedAt" IS NULL
    AND "createdAt" IS NOT NULL
    AND ("week" !~ '^[0-9]{4}-W[0-9]{2}$' OR "week" IS NULL);
  
  RAISE NOTICE 'createdAt から week を変換しました';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'createdAt からの week 変換でエラーが発生しましたが、続行します: %', SQLERRM;
END $$;

-- どちらもない場合、現在日時から（数値形式の week のみ更新）
DO $$
BEGIN
  UPDATE "SNSPost"
  SET "week" = calculate_week_from_date(CURRENT_TIMESTAMP)
  WHERE "week" ~ '^[0-9]+$'
    AND "postedAt" IS NULL
    AND "createdAt" IS NULL
    AND ("week" !~ '^[0-9]{4}-W[0-9]{2}$' OR "week" IS NULL);
  
  RAISE NOTICE '現在日時から week を変換しました';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '現在日時からの week 変換でエラーが発生しましたが、続行します: %', SQLERRM;
END $$;

-- 関数を削除（一時的なもの）
DROP FUNCTION IF EXISTS calculate_week_from_date(TIMESTAMP WITH TIME ZONE);

-- ========================================
-- Step 3: unique 制約の重複を処理（安全・冪等）
-- ========================================

DO $$
DECLARE
  dup_count INTEGER;
BEGIN
  -- 重複を確認
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
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '重複データの削除でエラーが発生しましたが、続行します: %', SQLERRM;
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
    RAISE NOTICE '✅ すべての week が "YYYY-WWW" 形式に変換されました';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'データ整合性の確認でエラーが発生しました: %', SQLERRM;
END $$;

