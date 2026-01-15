# P3009 エラー解決手順

## 問題

P3009 エラー: 失敗したマイグレーション `20260119000000_fix_snspost_week_format` がデータベースに残っているため、新しいマイグレーションが適用できない。

## 解決方法

### 方法1: Prisma migrate resolve を使用（推奨）

```bash
cd backend

# 失敗したマイグレーションを「適用済み」としてマーク
npx prisma migrate resolve --applied 20260119000000_fix_snspost_week_format

# または、「ロールバック済み」としてマーク（マイグレーションを再実行したい場合）
npx prisma migrate resolve --rolled-back 20260119000000_fix_snspost_week_format
```

### 方法2: データベースを直接修正

#### ステップ1: 失敗したマイグレーションの状態を確認

```sql
-- Render のデータベース管理画面から実行
SELECT * FROM "_prisma_migrations" 
WHERE migration_name = '20260119000000_fix_snspost_week_format'
ORDER BY finished_at DESC;
```

#### ステップ2: week フィールドの現在の状態を確認

```sql
-- week フィールドの型を確認
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'SNSPost' AND column_name = 'week';

-- 数値形式の week が残っているか確認（week が TEXT 型の場合）
SELECT COUNT(*) as numeric_week_count
FROM "SNSPost"
WHERE week::TEXT ~ '^[0-9]+$';
```

#### ステップ3A: マイグレーションが部分的に適用されている場合

week フィールドが既に TEXT 型になっている場合、マイグレーションを「適用済み」としてマーク:

```sql
UPDATE "_prisma_migrations"
SET finished_at = NOW(),
    applied_steps_count = 1
WHERE migration_name = '20260119000000_fix_snspost_week_format'
  AND finished_at IS NULL;
```

#### ステップ3B: マイグレーションが全く適用されていない場合

week フィールドがまだ数値型の場合、失敗したマイグレーションを削除して再実行:

```sql
-- 失敗したマイグレーションのレコードを削除
DELETE FROM "_prisma_migrations" 
WHERE migration_name = '20260119000000_fix_snspost_week_format' 
  AND finished_at IS NULL;
```

その後、修正版のマイグレーションを再適用:

```bash
cd backend
npx prisma migrate deploy
```

## 推奨手順

1. **まず、Prisma migrate resolve を試す**（最も安全）
   ```bash
   cd backend
   npx prisma migrate resolve --applied 20260119000000_fix_snspost_week_format
   ```

2. **week フィールドの状態を確認**
   - TEXT 型になっているか
   - 数値形式の week が残っているか

3. **必要に応じて、修正版のマイグレーションを手動で実行**
   ```bash
   # マイグレーションファイルを直接実行
   psql $DATABASE_URL -f prisma/migrations/20260119000000_fix_snspost_week_format/migration.sql
   ```

4. **再度 migrate deploy を実行**
   ```bash
   npx prisma migrate deploy
   ```

## 注意事項

- 本番環境で操作する前に、必ずバックアップを取得してください
- `migrate resolve --applied` は、マイグレーションが部分的に適用されている場合に使用します
- `migrate resolve --rolled-back` は、マイグレーションを再実行したい場合に使用します

