# Render Start Command 設定手順

## 設定内容

RenderのBackend Serviceの **Start Command** を以下に設定してください：

```bash
echo "RUN MIGRATE" && node -e "console.log('DB_URL_HOST_DB:', (process.env.DATABASE_URL||'').split('@')[1]?.split('?')[0])" && echo "=== MIGRATE STATUS ===" && npx prisma migrate status 2>&1 && echo "=== MIGRATE DEPLOY ===" && npx prisma migrate deploy 2>&1 && echo "MIGRATE DONE" && npm start
```

**注意**: 
- `npx prisma migrate status` で現在のmigration適用状況を確認
- `npx prisma migrate deploy` で未適用のmigrationを適用
- `2>&1` で詳細な出力（Applying migration / No pending migrations等）をログに表示

**注意**: Root Directoryが`backend`に設定されているため、`cd backend`は不要です。

## 設定手順

1. Renderダッシュボードにログイン
2. Backend Serviceを選択
3. **Settings** タブを開く
4. **Start Command** フィールドに上記コマンドを貼り付け
5. **Save Changes** をクリック
6. 自動デプロイが開始されます（または手動で **Manual Deploy** を実行）

## 確認方法

### 1. Migration実行ログの確認

デプロイ後、Renderの **Logs** タブで以下が表示されることを確認：

```
RUN MIGRATE
DB_URL_HOST_DB: xxxxx:5432/xxxxx
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
Datasource "db": PostgreSQL database "xxxxx", schema "public" at "xxxxx:5432"
...
Applying migration `20260112202610_add_citizen_fields`
Applying migration `20260112214352_add_contact_fields`
...
MIGRATE DONE
```

または、すべてのmigrationが適用済みの場合：

```
RUN MIGRATE
DB_URL_HOST_DB: xxxxx:5432/xxxxx
=== MIGRATE STATUS ===
Database schema is up to date!
3 migrations found in prisma/migrations
3 migrations applied to database

Following migrations have been applied:
migrations/
  └─ 20260108010924_init/
      └─ migration.sql
  └─ 20260112202610_add_citizen_fields/
      └─ migration.sql
  └─ 20260112214352_add_contact_fields/
      └─ migration.sql

=== MIGRATE DEPLOY ===
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "xxxxx", schema "public" at "xxxxx:5432"
No pending migrations to apply.
...
MIGRATE DONE
```

**重要**: 
- `RUN MIGRATE` が表示されること
- `DB_URL_HOST_DB` が表示されること（host:port/dbname形式）← **migrate時のDB**
- `=== MIGRATE STATUS ===` で現在の適用状況を確認
  - `20260108010924_init` が適用されているか
  - `20260112202610_add_citizen_fields`（role追加）が適用されているか
  - `20260112214352_add_contact_fields` が適用されているか
- `=== MIGRATE DEPLOY ===` で未適用のmigrationが適用される
  - `Applying migration` が表示されるか
  - `No pending migrations` が表示されるか（詳細出力全体を確認）
- `MIGRATE DONE` が表示されること

### 1-2. API実行時のDB接続確認

API実行時（GET/POST `/api/citizens`）のログで以下を確認：

```
🔵 [API] GET /api/citizens - DB_URL_HOST_DB: xxxxx:5432/xxxxx
```

**重要**: 
- migrate時の`DB_URL_HOST_DB`と、API実行時の`DB_URL_HOST_DB`が**一致していること**
- 一致しない場合、Renderの環境変数`DATABASE_URL`が複数サービス（backend / job / preview等）でズレている可能性

### 2. DB接続情報の確認

ログに以下が表示されることを確認：

```
🔵 [DB] Database Host: xxxxx
🔵 [DB] Database Name: xxxxx
🔵 [DB] Database Port: 5432 (default)
```

**注意**: `DB_URL_HOST_DB` と実際のDBサービスの接続先が一致していることを確認してください。

### 3. API動作確認

`POST /api/citizens` が200を返すことを確認：

```bash
# 例: curlで確認
curl -X POST https://your-backend.onrender.com/api/citizens \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"テストユーザー"}'
```

## トラブルシューティング

### "RUN MIGRATE" が表示されない場合

- Start Commandが正しく設定されているか確認
- Root Directoryが`backend`に設定されているか確認

### "MIGRATE DONE" が表示されない場合

- `npx prisma migrate deploy` がエラーで停止している可能性
- ログでエラーメッセージを確認
- DATABASE_URLが正しく設定されているか確認

### "No pending migrations" と出るのにP2022エラーが継続する場合

- **重要**: `=== MIGRATE STATUS ===` の出力を確認
  - `20260112202610_add_citizen_fields`（role追加）が "Following migrations have been applied" に含まれているか
  - 含まれていない場合、`=== MIGRATE DEPLOY ===` で適用されるはず
- **migrate statusで適用済みなのにP2022が続く場合**:
  - migrate時の`DB_URL_HOST_DB`と、API実行時の`DB_URL_HOST_DB`を比較
  - **不一致の場合**: Renderの環境変数`DATABASE_URL`が複数サービス（backend / job / preview等）でズレている
    - Backend Serviceの環境変数`DATABASE_URL`を確認
    - 他のサービス（Job、Preview等）の`DATABASE_URL`と一致しているか確認
    - すべてのサービスで同じDBを参照するように修正
  - **一致している場合**: `_prisma_migrations`テーブルの不整合の可能性
    - migrate statusの出力全文を確認
    - 実際のDBに`role`列が存在するか確認（Prisma Studio等）
    - 必要に応じて、正しいDBに対して手動でmigrationを再適用

### P2022エラーが継続する場合

- migrationが適用されていない可能性
- ログで "Applying migration" が表示されているか確認
- `DB_URL_HOST_DB` と実際のDBサービスの接続先が一致しているか確認
