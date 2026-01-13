# デバッグチェックリスト: /api/citizens 500エラー

## 現在の状況
- `/api/citizens`が500エラーを返している
- `P2022: role column does not exist`エラーの可能性

## 確認すべきログ（RenderのLogsタブ）

### 1. 起動時のログ

以下を確認してください：

```
🔵 [STARTUP] DB_URL_HOST_DB: xxxxx:5432/xxxxx
```

### 2. Migration実行ログ

以下を確認してください：

```
RUN MIGRATE
DB_URL_HOST_DB: xxxxx:5432/xxxxx
=== MIGRATE STATUS ===
...
Following migrations have been applied:
migrations/
  └─ 20260112202610_add_citizen_fields/  ← これが含まれているか確認
      └─ migration.sql
...
=== MIGRATE DEPLOY ===
...
```

### 3. API実行時のログ（GET /api/citizens）

以下を確認してください：

```
🔵 [API] GET /api/citizens - DB_URL_HOST_DB: xxxxx:5432/xxxxx
🔵 [API] Current Database: xxxxx
🔵 [API] Contact.role column exists: true/false (X row(s))
```

## 問題の特定方法

### ケース1: 起動時とAPI実行時の`DB_URL_HOST_DB`が不一致

**症状:**
- 起動時の`DB_URL_HOST_DB`とAPI実行時の`DB_URL_HOST_DB`が異なる

**原因:**
- RenderのBackend Serviceの環境変数`DATABASE_URL`が間違っている
- 複数のサービス（backend / job / preview等）で異なる`DATABASE_URL`が設定されている

**対応:**
1. Renderダッシュボード → Backend Service → Environment
2. `DATABASE_URL`環境変数を確認
3. 正しいDBサービスの接続情報に修正

### ケース2: `DB_URL_HOST_DB`が一致しているのにrole列が無い

**症状:**
- 起動時とAPI実行時の`DB_URL_HOST_DB`が一致
- `🔵 [API] Contact.role column exists: false (0 row(s))`
- `=== MIGRATE STATUS ===`で`20260112202610_add_citizen_fields`が適用済みと表示

**原因:**
- `_prisma_migrations`テーブルの不整合
- migrationが実際には適用されていない

**対応:**
1. `=== MIGRATE STATUS ===`のログ全文を確認
2. `20260112202610_add_citizen_fields`が "Following migrations have been applied" に含まれているか確認
3. 含まれていない場合、`=== MIGRATE DEPLOY ===`で適用されるはず
4. 含まれているのに列が無い場合、手動でmigrationを再適用する必要がある可能性

### ケース3: Migrationが適用されていない

**症状:**
- `=== MIGRATE STATUS ===`で`20260112202610_add_citizen_fields`が "Following migrations have not yet been applied" に含まれている

**原因:**
- migrationが未適用

**対応:**
- `=== MIGRATE DEPLOY ===`で適用されるはず
- 適用されない場合、エラーメッセージを確認

## 次のステップ

1. RenderのLogsタブを開く
2. 上記のログを探す
3. 以下を共有してください：
   - 起動時の`DB_URL_HOST_DB`
   - API実行時の`DB_URL_HOST_DB`
   - `=== MIGRATE STATUS ===`のログ全文
   - `🔵 [API] Contact.role column exists:`のログ
   - エラーメッセージ（500エラーの詳細）

