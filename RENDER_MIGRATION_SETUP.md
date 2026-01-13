# Render DB Migration 設定ガイド

## 問題
Renderの本番DBに `Contact` テーブルの `role`, `startYear`, `endYear` カラムが存在しない。

## 解決方法

### 1. Migration ファイルの確認
既存のmigrationファイル:
- `backend/prisma/migrations/20260112202610_add_citizen_fields/migration.sql`
  - `role` (TEXT)
  - `startYear` (INTEGER)
  - `endYear` (INTEGER)

### 2. RenderでのMigration実行設定

#### 方法A: Build Commandに追加（推奨）
Renderのバックエンドサービス設定で、**Build Command**を以下に変更:

```bash
npm install && npm run build
```

`package.json`の`build`スクリプトに`prisma migrate deploy`が含まれているため、ビルド時に自動的にmigrationが実行されます。

#### 方法B: PreDeploy Scriptを使用
Renderのバックエンドサービス設定で、**PreDeploy Script**を追加:

```bash
npx prisma migrate deploy
```

### 3. 動作確認手順

#### 3.1 Migration適用確認
Renderのデプロイログで以下が表示されることを確認:
```
Applying migration `20260112202610_add_citizen_fields`
```

#### 3.2 API動作確認
1. RenderのバックエンドURLにアクセス
2. `POST /api/citizens` を実行
3. ステータスコード `200` が返ることを確認

#### 3.3 DB確認（オプション）
Prisma StudioまたはSQLで確認:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Contact' 
AND column_name IN ('role', 'startYear', 'endYear');
```

### 4. フロントエンド動作確認
1. `/contacts` ページにアクセス
2. 「新規登録」ボタンをクリック
3. 名前を入力して「登録」をクリック
4. 一覧に即時反映されることを確認

## 設定箇所まとめ

- **Build Command**: `npm install && npm run build`
  - `backend/package.json` の `build` スクリプトに `prisma migrate deploy` が含まれています
- **Migration名**: `20260112202610_add_citizen_fields`
- **追加されたカラム**: `role`, `startYear`, `endYear`

