# 本番環境マイグレーションガイド

## 概要

本番環境に順番入れ替え機能を反映するには、データベースマイグレーションを実行する必要があります。

## Render.comでのマイグレーション手順

### 方法1: Renderダッシュボードから実行（推奨）

1. **Renderダッシュボードにログイン**
   - https://dashboard.render.com にアクセス

2. **バックエンドサービスを選択**
   - `kyoryokutai-backend`（または該当するサービス名）をクリック

3. **Shellを開く**
   - 右上の「Shell」ボタンをクリック

4. **マイグレーションを実行**
   ```bash
   npx prisma migrate deploy
   ```

5. **Prismaクライアントを再生成**
   ```bash
   npx prisma generate
   ```

6. **サービスを再起動**
   - Renderダッシュボードで「Manual Deploy」→「Deploy latest commit」をクリック

### 方法2: ローカルから本番DBに接続して実行

⚠️ **注意**: この方法は本番データベースに直接接続するため、慎重に実行してください。

1. **本番データベースのURLを取得**
   - Renderダッシュボード → PostgreSQL → Connection String (External)

2. **環境変数を設定**
   ```bash
   export DATABASE_URL="postgresql://user:password@host:5432/database"
   ```

3. **マイグレーションを実行**
   ```bash
   cd backend
   npx prisma migrate deploy
   ```

### 方法3: GitHub Actionsで自動実行（推奨・今後の対応）

`.github/workflows/deploy.yml`にマイグレーションステップを追加：

```yaml
- name: Run Database Migrations
  run: npx prisma migrate deploy
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

## マイグレーション内容

このマイグレーション（`20260423000000_add_project_order`）は以下を実行します：

```sql
-- Add order field to Project model
ALTER TABLE "Project" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- Add order field to Mission model
ALTER TABLE "Mission" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- Create index for ordering
CREATE INDEX "Project_userId_order_idx" ON "Project"("userId", "order");
CREATE INDEX "Mission_userId_order_idx" ON "Mission"("userId", "order");
```

## 確認方法

### 1. マイグレーションステータスを確認

Renderのシェルで：
```bash
npx prisma migrate status
```

期待される出力：
```
53 migrations found in prisma/migrations

Database schema is up to date!
```

### 2. データベースを直接確認

```bash
# Renderのシェルで
psql $DATABASE_URL -c "\d \"Project\"" | grep order
psql $DATABASE_URL -c "\d \"Mission\"" | grep order
```

期待される出力：
```
 order             | integer                        |           | not null | 0
```

### 3. フロントエンドで確認

1. 本番環境にアクセス
2. プロジェクト一覧ページを開く
3. 「個人」モードに切り替え
4. 上下矢印ボタンが表示されることを確認
5. 矢印ボタンをクリックして順番が変更されることを確認

## トラブルシューティング

### エラー: "Migration already applied"

マイグレーションが既に適用されている場合：
```bash
npx prisma migrate status
```
で確認してください。

### エラー: "Can't reach database server"

データベース接続情報が正しいか確認：
```bash
echo $DATABASE_URL
```

### エラー: "Column already exists"

既にカラムが存在する場合、マイグレーションをスキップ：
```bash
npx prisma migrate resolve --applied 20260423000000_add_project_order
```

### 上下矢印ボタンが表示されない

1. **キャッシュをクリア**
   - ブラウザのキャッシュをクリア
   - Ctrl+Shift+R（Windows）または Cmd+Shift+R（Mac）でハードリロード

2. **デプロイ状態を確認**
   - Renderダッシュボードで最新のコミットがデプロイされているか確認
   - デプロイログにエラーがないか確認

3. **ビルドログを確認**
   - GitHub Actionsのビルドが成功しているか確認
   - Renderのデプロイログを確認

## 本番環境の自動マイグレーション設定（推奨）

今後のマイグレーションを自動化するため、Renderのビルドコマンドを更新：

1. Renderダッシュボード → バックエンドサービス → Settings
2. Build Commandを更新：
   ```bash
   npm install && npx prisma generate && npm run build
   ```
3. Start Commandを更新：
   ```bash
   npx prisma migrate deploy && npm start
   ```

これにより、デプロイ時に自動的にマイグレーションが実行されます。

## 緊急時のロールバック

問題が発生した場合、以下の手順でロールバック：

```sql
-- orderカラムを削除
ALTER TABLE "Project" DROP COLUMN "order";
ALTER TABLE "Mission" DROP COLUMN "order";

-- インデックスを削除
DROP INDEX "Project_userId_order_idx";
DROP INDEX "Mission_userId_order_idx";
```

その後、マイグレーション履歴を更新：
```bash
npx prisma migrate resolve --rolled-back 20260423000000_add_project_order
```

## サポート

問題が解決しない場合：
1. Renderのログを確認
2. GitHub Actionsのログを確認
3. ブラウザのコンソールでエラーを確認
