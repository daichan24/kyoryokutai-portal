# Render DB Migration 適用設定（確定版）

## 問題
Render本番DBに `Contact.role` カラムが存在せず、P2022エラーが発生。

## 解決方法

### 1. Migration ファイル確認
✅ Migration名: `20260112202610_add_citizen_fields`
✅ ファイル: `backend/prisma/migrations/20260112202610_add_citizen_fields/migration.sql`
✅ 追加カラム:
   - `role` (TEXT)
   - `startYear` (INTEGER)
   - `endYear` (INTEGER)

### 2. Render設定

#### Start Command（変更必須）
Renderのバックエンドサービス設定で、**Start Command**を以下に変更:

```bash
npm start
```

`package.json`の`start`スクリプトに`npx prisma migrate deploy`が含まれているため、アプリ起動時に自動的にmigrationが適用されます。

#### Build Command（変更不要）
現在の設定のまま:
```bash
npm install && npm run build
```

### 3. 動作確認手順

#### 3.1 デプロイログ確認
Renderのデプロイログで以下が表示されることを確認:
```
Applying migration `20260112202610_add_citizen_fields`
```

#### 3.2 API動作確認
```bash
POST /api/citizens
Content-Type: application/json
Authorization: Bearer YOUR_TOKEN

{
  "name": "テストユーザー",
  "role": "現役",
  "startYear": 2024,
  "endYear": 2027
}
```

**期待される結果**: ステータスコード `200` + JSONレスポンス

#### 3.3 DB確認
Prisma StudioまたはSQLで確認:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Contact' 
AND column_name IN ('role', 'startYear', 'endYear');
```

#### 3.4 フロントエンド動作確認
1. `/contacts` ページにアクセス
2. 「新規登録」ボタンをクリック
3. 名前を入力して「登録」をクリック
4. 一覧に即時反映されることを確認

## 設定箇所まとめ

- **Start Command**: `npm start`
  - `backend/package.json` の `start` スクリプト: `npx prisma migrate deploy && node dist/index.js`
- **Migration名**: `20260112202610_add_citizen_fields`
- **追加されたカラム**: `role`, `startYear`, `endYear`

