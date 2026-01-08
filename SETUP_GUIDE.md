# セットアップガイド

このガイドでは、テストログインができるようにデータベースをセットアップする手順を説明します。

## 前提条件

- Node.js 20以上がインストールされていること
- PostgreSQLが利用可能であること（Dockerを使用する場合は不要）

## セットアップ手順

### 1. 環境変数の設定

`backend`ディレクトリに`.env`ファイルを作成し、以下の内容を設定してください：

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/kyoryokutai?schema=public"
JWT_SECRET="your-secret-key-change-in-production"
NODE_ENV="development"
PORT=3001
```

**Dockerを使用する場合**は、`docker-compose.yml`で自動的に設定されるため、この手順は不要です。

### 2. データベースの準備

#### Dockerを使用する場合

```bash
# プロジェクトルートで実行
docker-compose up -d database
```

これでPostgreSQLデータベースが起動します。

#### ローカルでPostgreSQLを使用する場合

PostgreSQLが起動していることを確認してください。

```bash
# PostgreSQLに接続してデータベースを作成
psql -U postgres
CREATE DATABASE kyoryokutai;
\q
```

### 3. データベースマイグレーションの実行

```bash
cd backend
npm install
npm run migrate:dev
```

これでデータベーススキーマが作成されます。

### 4. テストデータの投入（シード）

```bash
cd backend
npm run seed
```

以下のような出力が表示されれば成功です：

```
🌱 Starting seed...
✅ Created users: { master: 'master@test.com', member: 'member@test.com', support: 'support@test.com' }
✅ Created locations: ながぬまホワイトベース, 役場, 加工センター
✅ Created sample schedule
🎉 Seed completed successfully!
```

### 5. データベースの確認（オプション）

Prisma Studioを使用してデータベースの内容を確認できます：

```bash
cd backend
npx prisma studio
```

ブラウザが自動的に開き、データベースの内容を確認できます。`User`テーブルに3つのテストユーザーが作成されていることを確認してください。

### 6. バックエンドサーバーの起動

```bash
cd backend
npm run dev
```

サーバーが起動したら、以下のURLでヘルスチェックできます：

```
http://localhost:3001/health
```

### 7. フロントエンドの起動

別のターミナルで：

```bash
cd frontend
npm install
npm run dev
```

### 8. ログインの確認

ブラウザで `http://localhost:5173` にアクセスし、以下のテストアカウントでログインしてください：

| 役割 | メールアドレス | パスワード |
|------|----------------|------------|
| マスター | master@test.com | password123 |
| メンバー | member@test.com | password123 |
| サポート | support@test.com | password123 |

## トラブルシューティング

### エラー: "Cannot connect to database"

**原因**: データベースが起動していない、または接続情報が間違っている

**解決策**:
1. Dockerを使用している場合: `docker-compose ps` でデータベースコンテナが起動しているか確認
2. `.env`ファイルの`DATABASE_URL`が正しいか確認
3. PostgreSQLが起動しているか確認

### エラー: "Migration failed"

**原因**: データベーススキーマが既に存在する、またはマイグレーションに問題がある

**解決策**:
```bash
cd backend
# データベースをリセット（注意: すべてのデータが削除されます）
npx prisma migrate reset
# 再度マイグレーションを実行
npm run migrate:dev
npm run seed
```

### エラー: "401 Unauthorized" でログインできない

**原因**: テストユーザーがデータベースに存在しない

**解決策**:
1. シードが実行されているか確認: `npm run seed` を実行
2. Prisma StudioでUserテーブルを確認: `npx prisma studio`
3. ユーザーが存在しない場合は、再度シードを実行

### シードを再実行したい場合

既存のデータを削除してからシードを実行：

```bash
cd backend
npx prisma migrate reset
# 確認プロンプトで "y" を入力
npm run seed
```

## Docker Composeを使用した一括起動

すべてのサービス（データベース、バックエンド、フロントエンド）を一度に起動する場合：

```bash
# プロジェクトルートで実行
docker-compose up
```

初回起動時には自動的に以下が実行されます：
- データベースのマイグレーション
- テストデータの投入（シード）

起動後、以下のURLにアクセスできます：
- フロントエンド: http://localhost:5173
- バックエンドAPI: http://localhost:3001

## 次のステップ

セットアップが完了したら、以下を試してください：

1. ログインしてダッシュボードを確認
2. スケジュールを作成
3. 週次報告を作成
4. 各機能ページを確認（サイドバーからアクセス可能）

