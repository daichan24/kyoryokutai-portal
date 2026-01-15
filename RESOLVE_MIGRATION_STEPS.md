# P3009 エラー解決手順（本番環境用）

## 問題

P3009 エラー: マイグレーション `20260119000000_fix_snspost_week_format` が失敗した状態で残っているため、新しいマイグレーションが適用できない。

## 解決手順（Render 本番環境）

### ステップ1: 失敗したマイグレーションの状態を確認

Render のデータベース管理画面から以下を実行:

```sql
-- 失敗したマイグレーションの状態を確認
SELECT 
  migration_name,
  finished_at,
  applied_steps_count,
  started_at
FROM "_prisma_migrations" 
WHERE migration_name = '20260119000000_fix_snspost_week_format'
ORDER BY started_at DESC;
```

### ステップ2: week フィールドの現在の状態を確認

```sql
-- week フィールドの型を確認
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'SNSPost' AND column_name = 'week';

-- 数値形式の week が残っているか確認
-- week が TEXT 型の場合
SELECT COUNT(*) as numeric_week_count
FROM "SNSPost"
WHERE week::TEXT ~ '^[0-9]+$';

-- week が INTEGER 型の場合（エラーの原因）
SELECT COUNT(*) as total_count
FROM "SNSPost";
```

### ステップ3: 解決方法の選択

#### パターンA: week フィールドが既に TEXT 型になっている場合

マイグレーションが部分的に適用されている可能性があります。失敗したマイグレーションを「適用済み」としてマーク:

```sql
UPDATE "_prisma_migrations"
SET finished_at = NOW(),
    applied_steps_count = 1
WHERE migration_name = '20260119000000_fix_snspost_week_format'
  AND finished_at IS NULL;
```

その後、修正版のマイグレーションを手動で実行:

```sql
-- 修正版マイグレーションの Step 2 以降を実行
-- (week が既に TEXT 型なので、Step 1 はスキップ)
```

#### パターンB: week フィールドがまだ INTEGER 型の場合

マイグレーションが全く適用されていない可能性があります。失敗したマイグレーションを削除して再実行:

```sql
-- 失敗したマイグレーションのレコードを削除
DELETE FROM "_prisma_migrations" 
WHERE migration_name = '20260119000000_fix_snspost_week_format' 
  AND finished_at IS NULL;
```

その後、修正版のマイグレーションを手動で実行（下記参照）。

### ステップ4: 修正版マイグレーションを手動で実行

Render のデータベース管理画面から、以下の SQL を順番に実行:

```sql
-- ========================================
-- Step 1: week フィールドを TEXT 型に正規化
-- ========================================

-- week が数値型の場合、TEXT 型に変更
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'SNSPost' 
    AND column_name = 'week'
    AND data_type IN ('integer', 'bigint', 'numeric', 'smallint')
  ) THEN
    ALTER TABLE "SNSPost" ALTER COLUMN "week" TYPE TEXT USING week::TEXT;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'SNSPost' 
    AND column_name = 'week'
    AND data_type NOT IN ('text', 'character varying', 'varchar')
  ) THEN
    ALTER TABLE "SNSPost" ALTER COLUMN "week" TYPE TEXT USING week::TEXT;
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
  jst_date := target_date AT TIME ZONE 'Asia/Tokyo';
  monday_date := DATE_TRUNC('week', jst_date::DATE) + INTERVAL '1 day';
  IF EXTRACT(DOW FROM jst_date::DATE) = 0 THEN
    monday_date := monday_date - INTERVAL '7 days';
  END IF;
  year_val := EXTRACT(YEAR FROM monday_date)::INTEGER;
  week_num := ((EXTRACT(DOY FROM monday_date)::INTEGER - 1) / 7) + 1;
  RETURN year_val || '-W' || LPAD(week_num::TEXT, 2, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- postedAt がある場合
UPDATE "SNSPost"
SET "week" = calculate_week_from_date("postedAt")
WHERE "week" ~ '^[0-9]+$'
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

-- 関数を削除
DROP FUNCTION IF EXISTS calculate_week_from_date(TIMESTAMP WITH TIME ZONE);

-- ========================================
-- Step 3: unique 制約の重複を処理
-- ========================================

-- 重複を削除（古いデータを残す）
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

-- ========================================
-- Step 4: マイグレーションを「適用済み」としてマーク
-- ========================================

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
```

### ステップ5: 確認

```sql
-- week フィールドの型を確認
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'SNSPost' AND column_name = 'week';
-- 期待値: data_type = 'text'

-- 数値形式が残っていないか確認
SELECT COUNT(*) FROM "SNSPost" WHERE week ~ '^[0-9]+$';
-- 期待値: 0

-- すべてが "YYYY-WWW" 形式か確認
SELECT COUNT(*) FROM "SNSPost" WHERE week !~ '^[0-9]{4}-W[0-9]{2}$';
-- 期待値: 0
```

### ステップ6: 再度 migrate deploy を実行

Render のデプロイが自動的に実行されるか、手動で実行:

```bash
# Render のシェルから実行（または自動デプロイを待つ）
cd backend
npx prisma migrate deploy
```

## 注意事項

- 本番環境で操作する前に、必ずバックアップを取得してください
- 各ステップを順番に実行し、エラーがないか確認してください
- エラーが発生した場合は、ロールバック手順を準備してください

