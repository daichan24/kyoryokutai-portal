# Migration適用の修正手順

## 現在の状況

- `Contact.role`列がDBに存在しない
- `=== MIGRATE STATUS ===`のログが表示されていない
- Start Commandが実行されていない可能性

## 確認事項

### 1. Start Commandが正しく設定されているか確認

Renderダッシュボード → Backend Service → Settings → Start Command

以下が設定されているか確認：

```bash
echo "RUN MIGRATE" && node -e "console.log('DB_URL_HOST_DB:', (process.env.DATABASE_URL||'').split('@')[1]?.split('?')[0])" && echo "=== MIGRATE STATUS ===" && npx prisma migrate status 2>&1 && echo "=== MIGRATE DEPLOY ===" && npx prisma migrate deploy 2>&1 && echo "MIGRATE DONE" && npm start
```

### 2. ログで以下を確認

- `RUN MIGRATE` が表示されているか
- `=== MIGRATE STATUS ===` が表示されているか
- `=== MIGRATE DEPLOY ===` が表示されているか
- `MIGRATE DONE` が表示されているか

これらが表示されていない場合、Start Commandが実行されていません。

## 解決方法

### 方法1: Start Commandを再設定

1. Renderダッシュボード → Backend Service → Settings
2. Start Commandを以下に設定：

```bash
echo "RUN MIGRATE" && node -e "console.log('DB_URL_HOST_DB:', (process.env.DATABASE_URL||'').split('@')[1]?.split('?')[0])" && echo "=== MIGRATE STATUS ===" && npx prisma migrate status 2>&1 && echo "=== MIGRATE DEPLOY ===" && npx prisma migrate deploy 2>&1 && echo "MIGRATE DONE" && npm start
```

3. Save Changes → Manual Deploy

### 方法2: 手動でmigrationを適用（緊急時）

もしStart Commandが機能しない場合、RenderのShell（有料プランのみ）またはローカルから手動で適用：

```bash
cd backend
npx prisma migrate deploy
```

ただし、Render無料プランではShellが使えないため、方法1で解決する必要があります。

## 期待されるログ

デプロイ後、以下のログが表示されるはずです：

```
RUN MIGRATE
DB_URL_HOST_DB: dpg-d5fh9k6r433s73b0cu00-a.singapore-postgres.render.com:5432/kyoryokutai
=== MIGRATE STATUS ===
Database schema is up to date!
1 migration found in prisma/migrations
1 migration applied to database

Following migrations have been applied:
migrations/
  └─ 20260108010924_init/
      └─ migration.sql

Following migrations have not yet been applied:
migrations/
  └─ 20260112202610_add_citizen_fields/
      └─ migration.sql
  └─ 20260112214352_add_contact_fields/
      └─ migration.sql

=== MIGRATE DEPLOY ===
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "kyoryokutai", schema "public" at "dpg-d5fh9k6r433s73b0cu00-a.singapore-postgres.render.com:5432"
...
Applying migration `20260112202610_add_citizen_fields`
Applying migration `20260112214352_add_contact_fields`
...
MIGRATE DONE
```

その後、API実行時に以下が表示されるはずです：

```
🔵 [API] Contact.role column exists: true (1 row(s))
```

