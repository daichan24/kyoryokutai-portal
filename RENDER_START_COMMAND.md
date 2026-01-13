# Render Start Command 設定（最終版）

## 問題
POST /api/citizens が500エラー。migrationが本番DBに適用されていない可能性。

## 解決方法

### 1. Render Start Command 設定

Renderのバックエンドサービス設定で、**Start Command**を以下に変更:

```bash
npm run start:prod
```

### 2. package.json の設定

`backend/package.json`の`start:prod`スクリプト:
```json
"start:prod": "echo '🔵 [MIGRATION] Starting migration deploy...' && npx prisma migrate deploy && echo '✅ [MIGRATION] Migration deploy completed' && node dist/index.js"
```

### 3. 期待されるログ出力

#### Migration実行ログ
```
🔵 [MIGRATION] Starting migration deploy...
Applying migration `20260112202610_add_citizen_fields`
✅ [MIGRATION] Migration deploy completed
```

または、既に適用済みの場合:
```
🔵 [MIGRATION] Starting migration deploy...
No pending migrations to apply.
✅ [MIGRATION] Migration deploy completed
```

#### DB情報ログ
```
🔵 [DB] Database Host: <hostname>
🔵 [DB] Database Name: <database_name>
🔵 [DB] Database Port: 5432 (default)
```

### 4. 動作確認手順

1. Renderでバックエンドを再デプロイ
2. デプロイログで以下を確認:
   - `🔵 [MIGRATION] Starting migration deploy...`
   - `Applying migration...` または `No pending migrations...`
   - `✅ [MIGRATION] Migration deploy completed`
   - `🔵 [DB] Database Host: ...`
   - `🔵 [DB] Database Name: ...`
3. `/contacts` から新規登録
4. `POST /api/citizens` が `200` を返すことを確認

## 設定箇所まとめ

- **Render Start Command**: `npm run start:prod`
- **Migration名**: `20260112202610_add_citizen_fields`
- **追加されたカラム**: `role`, `startYear`, `endYear`

