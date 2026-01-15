# ローカルマイグレーションテスト手順

## 前提条件

- PostgreSQL がローカルで起動している
- `DATABASE_URL` が設定されている
- 本番DBと同様のデータ構造（SNSPost.week が数値形式）

## テスト手順

### 1. テストデータの準備

```sql
-- テスト用のSNSPostデータを作成（week が数値形式）
-- 既存のデータがある場合はスキップ

-- 例: week が "3" のデータを作成
INSERT INTO "SNSPost" (
  "id",
  "userId",
  "week",
  "postedAt",
  "postType",
  "createdAt",
  "updatedAt"
) VALUES (
  gen_random_uuid()::TEXT,
  (SELECT "id" FROM "User" LIMIT 1),
  '3',  -- 数値形式の week
  CURRENT_TIMESTAMP,
  'FEED',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- 複数のパターンをテスト
-- postedAt がある場合
INSERT INTO "SNSPost" (
  "id", "userId", "week", "postedAt", "postType", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid()::TEXT,
  (SELECT "id" FROM "User" LIMIT 1),
  '5',
  '2026-01-15 10:00:00+09'::TIMESTAMPTZ,
  'STORY',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

-- postedAt がない場合（createdAt から計算）
INSERT INTO "SNSPost" (
  "id", "userId", "week", "postType", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid()::TEXT,
  (SELECT "id" FROM "User" LIMIT 1),
  '7',
  'FEED',
  '2026-01-10 10:00:00+09'::TIMESTAMPTZ,
  CURRENT_TIMESTAMP
);
```

### 2. マイグレーション前の状態確認

```sql
-- week フィールドの型とデータを確認
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'SNSPost' AND column_name = 'week';

-- 数値形式の week を確認
SELECT 
  id,
  "userId",
  week,
  "postedAt",
  "createdAt"
FROM "SNSPost"
WHERE week ~ '^[0-9]+$'
ORDER BY "createdAt" DESC
LIMIT 10;
```

### 3. マイグレーションの実行

```bash
# マイグレーションファイルを直接実行
cd backend
psql $DATABASE_URL -f prisma/migrations/20260119000000_fix_snspost_week_format/migration.sql

# または Prisma 経由で実行（推奨）
npx prisma migrate deploy
```

### 4. マイグレーション後の確認

```sql
-- week フィールドの型を確認
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'SNSPost' AND column_name = 'week';

-- 変換後の week を確認（すべて "YYYY-WWW" 形式になっているか）
SELECT 
  id,
  "userId",
  week,
  "postedAt",
  "createdAt"
FROM "SNSPost"
ORDER BY "createdAt" DESC
LIMIT 10;

-- 数値形式が残っていないか確認
SELECT COUNT(*) as numeric_week_count
FROM "SNSPost"
WHERE week ~ '^[0-9]+$';

-- 不正な形式がないか確認
SELECT COUNT(*) as invalid_format_count
FROM "SNSPost"
WHERE week !~ '^[0-9]{4}-W[0-9]{2}$';

-- unique 制約の重複を確認
SELECT 
  "userId",
  week,
  COUNT(*) as count
FROM "SNSPost"
GROUP BY "userId", week
HAVING COUNT(*) > 1;
```

### 5. エラーが発生した場合のロールバック

```sql
-- マイグレーションをロールバック（必要に応じて）
-- 注意: 本番環境では実行しないこと

-- week フィールドを元の型に戻す（例: INTEGER）
-- ALTER TABLE "SNSPost" ALTER COLUMN "week" TYPE INTEGER USING week::INTEGER;
-- ただし、既に変換されたデータがある場合は注意が必要
```

### 6. Prisma クライアントの再生成

```bash
cd backend
npx prisma generate
```

### 7. API の動作確認

```bash
# バックエンドを起動
npm run start

# 別ターミナルで API をテスト
curl http://localhost:3001/api/sns-posts \
  -H "Authorization: Bearer <token>"
```

## 期待される結果

1. ✅ week フィールドが TEXT 型になっている
2. ✅ すべての week が "YYYY-WWW" 形式（例: "2026-W03"）になっている
3. ✅ 数値形式の week が 0 件になっている
4. ✅ unique 制約の重複が 0 件になっている
5. ✅ API が正常に動作する（P2032 エラーが発生しない）

## トラブルシューティング

### エラー: "relation does not exist"
- Prisma のマイグレーション履歴を確認: `SELECT * FROM "_prisma_migrations";`
- 必要なマイグレーションが適用されているか確認

### エラー: "duplicate key value"
- unique 制約の重複データを手動で削除
- マイグレーションの Step 3 を再実行

### エラー: "invalid input syntax for type"
- week フィールドの型が正しく変換されているか確認
- データベースの型情報を再確認

