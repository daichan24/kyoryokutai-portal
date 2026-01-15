-- ========================================
-- 失敗したマイグレーションを解決するためのSQL
-- ========================================
-- 
-- P3009 エラーを解決するため、失敗したマイグレーションの状態をリセット
-- 
-- 注意: 本番環境で実行する前に、必ずバックアップを取得してください

-- 1. 失敗したマイグレーションのレコードを確認
SELECT * FROM "_prisma_migrations" 
WHERE migration_name = '20260119000000_fix_snspost_week_format'
ORDER BY finished_at DESC;

-- 2. 失敗したマイグレーションのレコードを削除（再実行するため）
-- 注意: このコマンドは、マイグレーションが部分的に適用されている場合に問題を引き起こす可能性があります
-- DELETE FROM "_prisma_migrations" 
-- WHERE migration_name = '20260119000000_fix_snspost_week_format' 
--   AND finished_at IS NULL;

-- 3. または、失敗したマイグレーションを「適用済み」としてマーク（推奨）
-- マイグレーションが部分的に適用されている場合、この方法が安全です
-- UPDATE "_prisma_migrations"
-- SET finished_at = NOW(),
--     applied_steps_count = 1
-- WHERE migration_name = '20260119000000_fix_snspost_week_format'
--   AND finished_at IS NULL;

-- 4. week フィールドの現在の状態を確認
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'SNSPost' AND column_name = 'week';

-- 5. 数値形式の week が残っているか確認（week が TEXT 型の場合）
-- SELECT COUNT(*) as numeric_week_count
-- FROM "SNSPost"
-- WHERE week::TEXT ~ '^[0-9]+$';

