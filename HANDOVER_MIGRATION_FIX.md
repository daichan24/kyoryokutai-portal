# Handover Migration 修正レポート

## 1. 根本原因

### エラー詳細
- **Error Code**: P3018 (Prisma migration error)
- **DB Error Code**: 23502 (NOT NULL constraint violation)
- **Message**: `null value in column "updatedAt" of relation "HandoverCategory" violates not-null constraint`
- **Failing Row**: `(cat-activity-report, 活動報告会, EVENT, 年度ごとの活動報告会の準備・実施記録, 1, 2026-04-16 07:44:28.498, null)`

### 原因の特定

**問題のあったSQL:**
```sql
CREATE TABLE "HandoverCategory" (
    ...
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,  -- ❌ DEFAULT がない
    ...
);

INSERT INTO "HandoverCategory" ("id", "name", "type", "description", "sortOrder")
SELECT 'cat-activity-report', '活動報告会', 'EVENT', '...', 1
WHERE NOT EXISTS (...);
-- ❌ updatedAt を指定していないため NULL になる
```

**なぜこの問題が発生したか:**
1. Prisma schema では `updatedAt DateTime @updatedAt` と定義
2. `@updatedAt` は Prisma Client が自動更新する機能（DB側の機能ではない）
3. 生SQLでINSERTする場合、`updatedAt` に値を明示的に指定する必要がある
4. テーブル定義で `DEFAULT CURRENT_TIMESTAMP` がないため、INSERT時に NULL になる
5. NOT NULL制約違反でマイグレーション失敗

## 2. 修正したファイル

### `backend/prisma/migrations/20260416154901_add_handover/migration.sql`

**修正内容:**
1. 3つのテーブル定義で `updatedAt` に `DEFAULT CURRENT_TIMESTAMP` を追加
2. 既存データの NULL 補正処理を追加

## 3. 差分要約

### テーブル定義の修正

**HandoverCategory:**
```sql
-- 修正前
"updatedAt" TIMESTAMP(3) NOT NULL,

-- 修正後
"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
```

**HandoverFolder:**
```sql
-- 修正前
"updatedAt" TIMESTAMP(3) NOT NULL,

-- 修正後
"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
```

**HandoverDocument:**
```sql
-- 修正前
"updatedAt" TIMESTAMP(3) NOT NULL,

-- 修正後
"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
```

### 既存データ補正の追加

外部キー制約の後に以下を追加:
```sql
-- Fix existing NULL updatedAt values (if any)
UPDATE "HandoverCategory" SET "updatedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP) WHERE "updatedAt" IS NULL;
UPDATE "HandoverFolder" SET "updatedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP) WHERE "updatedAt" IS NULL;
UPDATE "HandoverDocument" SET "updatedAt" = COALESCE("updatedAt", "createdAt", CURRENT_TIMESTAMP) WHERE "updatedAt" IS NULL;
```

## 4. 本番に対して安全な理由

### ✅ 冪等性（Idempotent）
- `CREATE TABLE IF NOT EXISTS` - テーブルが既に存在する場合はスキップ
- `CREATE INDEX IF NOT EXISTS` - インデックスが既に存在する場合はスキップ
- `DO $$ ... EXCEPTION WHEN duplicate_object` - 外部キー制約が既に存在する場合はスキップ
- `INSERT ... WHERE NOT EXISTS` - レコードが既に存在する場合はスキップ

### ✅ 既存データの保護
- `DEFAULT CURRENT_TIMESTAMP` の追加は既存レコードに影響しない（新規INSERT時のみ適用）
- UPDATE文で既存の NULL を補正（`WHERE "updatedAt" IS NULL` で対象を限定）
- `COALESCE` で安全なフォールバック（updatedAt → createdAt → CURRENT_TIMESTAMP）

### ✅ 再実行可能
- マイグレーションが途中で失敗しても、再実行で復旧可能
- 部分的に適用された状態でも、再実行で完全な状態になる

### ✅ データ整合性
- NOT NULL制約を満たす値が必ず設定される
- `createdAt` と `updatedAt` の両方が適切に設定される

## 5. Render 再デプロイ前に確認すべき点

### ✅ 確認済み
- [x] `schema.prisma` の `HandoverCategory`, `HandoverFolder`, `HandoverDocument` モデルに `updatedAt DateTime @updatedAt` が定義されている
- [x] マイグレーションファイルの構文が正しい（PostgreSQL互換）
- [x] `package.json` の `start:prod:fix-timeadjustment` スクリプトに失敗したマイグレーションの解決コマンドが含まれている
- [x] サーバー起動ファイル（`src/index.ts`）が `process.env.PORT` を使用している

### 📋 デプロイ前チェックリスト
- [ ] Git に変更をコミット済み
- [ ] Render の Build Command が正しい（`npm install && npm run build`）
- [ ] Render の Start Command が正しい（`npm run start:prod:fix-timeadjustment`）
- [ ] 環境変数 `DATABASE_URL` が設定されている
- [ ] 環境変数 `PORT` が Render によって自動設定される（確認不要）

## 6. 変更後の start command

### 現在の設定（そのままでOK）
```json
"start:prod:fix-timeadjustment": "echo 'RESOLVE EXISTING MIGRATIONS' && npx prisma migrate resolve --applied 20260123000000_add_event_updated_by 2>/dev/null; ... npx prisma migrate resolve --rolled-back 20260416000000_add_handover 2>/dev/null; npx prisma migrate resolve --rolled-back 20260416154901_add_handover 2>/dev/null; echo 'DEPLOY NEW MIGRATION' && npx prisma migrate deploy && echo 'MIGRATE DONE' && node dist/index.js"
```

### 動作フロー
1. 既存の成功したマイグレーションを `--applied` でマーク
2. 失敗した2つの handover マイグレーションを `--rolled-back` でロールバック扱い
3. `prisma migrate deploy` で新しいマイグレーションを適用
4. Node.js サーバーを起動

### ⚠️ 注意
- 今回のデプロイ後、マイグレーションが成功したら、次回以降は以下を追加することを推奨:
  ```bash
  npx prisma migrate resolve --applied 20260416154901_add_handover 2>/dev/null;
  ```

## 7. Rollback / Migrate Resolve の追加作業

### 現在の状況
- `package.json` に既に失敗したマイグレーションの解決コマンドが含まれている
- 追加作業は不要

### もし手動で実行する必要がある場合

**Render Shell で実行:**
```bash
# 失敗したマイグレーションをロールバック扱いにする
npx prisma migrate resolve --rolled-back 20260416000000_add_handover
npx prisma migrate resolve --rolled-back 20260416154901_add_handover

# 新しいマイグレーションを適用
npx prisma migrate deploy
```

**ローカルで確認する場合:**
```bash
cd backend
npx prisma migrate status
```

## 8. 再発防止策

### 今後の生SQL INSERT時のルール
1. `createdAt` と `updatedAt` を持つテーブルへの INSERT では、両方の値を明示的に指定する
2. または、テーブル定義で `DEFAULT CURRENT_TIMESTAMP` を設定する
3. マイグレーションファイルは必ず冪等性を持たせる（`IF NOT EXISTS`, `WHERE NOT EXISTS` 等）

### 他テーブルの点検結果
- 既存のマイグレーションでは、ほとんどが `updatedAt TIMESTAMP(3) NOT NULL` で DEFAULT なし
- これは Prisma Client 経由の操作では問題ない（`@updatedAt` が自動更新）
- 生SQLでのINSERTは今回の handover マイグレーションのみ
- 他のテーブルでは初期データ投入を seed.ts で行っているため問題なし

## 9. デプロイ後の確認

### ✅ 成功の確認方法
1. Render のログで `MIGRATE DONE` が表示される
2. `Server running on port XXXX` が表示される
3. Health check エンドポイント `https://your-app.onrender.com/health` が 200 を返す
4. フロントエンドから引き継ぎ機能にアクセスできる

### ❌ 失敗した場合
1. Render のログを確認
2. エラーメッセージをコピー
3. 必要に応じて追加の修正を実施

## 10. まとめ

- **原因**: `updatedAt` カラムに DEFAULT がなく、生SQLでのINSERT時に NULL になった
- **修正**: テーブル定義に `DEFAULT CURRENT_TIMESTAMP` を追加、既存データの NULL 補正を追加
- **安全性**: 冪等性があり、既存データを保護し、再実行可能
- **追加作業**: 不要（`package.json` に既に含まれている）
- **デプロイ**: そのまま Render で再デプロイ可能
