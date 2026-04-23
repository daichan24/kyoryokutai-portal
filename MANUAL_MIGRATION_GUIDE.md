# 手動マイグレーションガイド

データベースに接続できない場合、以下の手順で手動でマイグレーションを適用できます。

## 方法1: PostgreSQLをHomebrewでインストール

```bash
# PostgreSQLをインストール
brew install postgresql@16

# PostgreSQLを起動
brew services start postgresql@16

# データベースを作成
createdb kyoryokutai

# ユーザーとパスワードを設定（必要な場合）
psql postgres
CREATE USER postgres WITH PASSWORD 'postgres';
ALTER USER postgres WITH SUPERUSER;
\q

# マイグレーションを実行
cd backend
npx prisma migrate dev --name add_project_mission_order
```

## 方法2: Dockerをインストール

```bash
# Dockerをインストール
brew install --cask docker

# Dockerアプリを起動（アプリケーションフォルダから起動）

# データベースコンテナを起動
docker-compose up -d database

# データベースが起動するまで待つ（約10秒）
sleep 10

# マイグレーションを実行
cd backend
npx prisma migrate dev --name add_project_mission_order
```

## 方法3: 既存のPostgreSQLに接続

既にPostgreSQLがインストールされている場合：

```bash
# PostgreSQLが起動しているか確認
pg_isready -h localhost -p 5432

# 起動していない場合
brew services start postgresql@16
# または
pg_ctl -D /usr/local/var/postgres start

# データベースが存在するか確認
psql -l | grep kyoryokutai

# 存在しない場合は作成
createdb kyoryokutai

# マイグレーションを実行
cd backend
npx prisma migrate dev --name add_project_mission_order
```

## 方法4: 手動でSQLを実行

データベースに直接接続できる場合、以下のSQLを実行：

```sql
-- Add order field to Project model
ALTER TABLE "Project" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- Add order field to Mission model
ALTER TABLE "Mission" ADD COLUMN "order" INTEGER NOT NULL DEFAULT 0;

-- Create index for ordering
CREATE INDEX "Project_userId_order_idx" ON "Project"("userId", "order");
CREATE INDEX "Mission_userId_order_idx" ON "Mission"("userId", "order");

-- マイグレーション履歴に記録
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
  gen_random_uuid(),
  'migration_checksum_here',
  NOW(),
  '20260423000000_add_project_mission_order',
  NULL,
  NULL,
  NOW(),
  1
);
```

## トラブルシューティング

### エラー: "Can't reach database server"

PostgreSQLが起動していません：
```bash
brew services start postgresql@16
```

### エラー: "database does not exist"

データベースを作成：
```bash
createdb kyoryokutai
```

### エラー: "role does not exist"

ユーザーを作成：
```bash
psql postgres
CREATE USER postgres WITH PASSWORD 'postgres';
ALTER USER postgres WITH SUPERUSER;
\q
```

### ポート5432が既に使用されている

別のPostgreSQLインスタンスが起動している可能性：
```bash
# 実行中のPostgreSQLプロセスを確認
ps aux | grep postgres

# 必要に応じて停止
brew services stop postgresql@16
```

## 確認方法

マイグレーションが成功したか確認：

```bash
cd backend
npx prisma migrate status
```

または、データベースに直接接続して確認：

```bash
psql kyoryokutai
\d "Project"
\d "Mission"
# orderカラムが追加されているか確認
\q
```
