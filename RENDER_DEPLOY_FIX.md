# Render デプロイ失敗の解決ガイド

Renderでバックエンドとフロントエンドが失敗する原因と解決策を説明します。

## 🔍 よくある失敗原因

### バックエンドの失敗原因

1. **PrismaがdevDependenciesにある** → 本番ビルドで`prisma`コマンドが見つからない
2. **ビルドコマンドが不適切** → Prismaクライアント生成のタイミング
3. **環境変数が設定されていない** → DATABASE_URL等
4. **TypeScriptビルドエラー** → tsconfig.jsonの設定

### フロントエンドの失敗原因

1. **環境変数がビルド時に必要** → VITE_API_URLが設定されていない
2. **ビルドコマンドが不適切** → TypeScriptチェックでエラー
3. **Static Siteの設定が間違っている** → Publish Directoryが間違っている

## ✅ 解決策

### ステップ1: バックエンドのpackage.jsonを修正

**問題**: `prisma`が`devDependencies`にあるため、本番ビルドで使用できない

**解決策**: `prisma`を`dependencies`に移動

```diff
  "dependencies": {
    "@prisma/client": "^5.21.1",
+   "prisma": "^5.21.1",
    "@types/node-cron": "^3.0.11",
    "bcrypt": "^5.1.1",
    ...
  },
  "devDependencies": {
-   "prisma": "^5.21.1",
    "@types/bcrypt": "^5.0.2",
    ...
  }
```

### ステップ2: Renderでのバックエンド設定

**Web Service**として作成：

1. **Name**: `kyoryokutai-backend`
2. **Root Directory**: `backend` ⚠️ 重要
3. **Environment**: `Node`
4. **Build Command**: 
   ```
   npm install && npm run build && npx prisma generate
   ```
5. **Start Command**: 
   ```
   npm run migrate:deploy && npm start
   ```
6. **環境変数**:
   ```
   DATABASE_URL=<PostgreSQLのInternal Database URL>
   JWT_SECRET=<強力なランダム文字列>
   NODE_ENV=production
   PORT=10000
   FRONTEND_URL=<後で設定>
   ```

### ステップ3: フロントエンドのpackage.jsonを確認

TypeScriptチェックでエラーが出る場合は、ビルドコマンドを調整：

```json
{
  "scripts": {
    "build": "tsc --noEmit && vite build",
    "build:skip-check": "vite build"
  }
}
```

### ステップ4: Renderでのフロントエンド設定

**Static Site**として作成：

1. **Name**: `kyoryokutai-frontend`
2. **Root Directory**: `frontend` ⚠️ 重要
3. **Build Command**: 
   ```
   npm install && npm run build
   ```
4. **Publish Directory**: `dist` ⚠️ 重要
5. **環境変数**:
   ```
   VITE_API_URL=<バックエンドのURL>
   ```

## 📋 完全な手順

### 1. バックエンドのpackage.jsonを修正

`backend/package.json`を開いて、`prisma`を`dependencies`に移動してください。

### 2. Renderでデータベースを作成

1. **New > PostgreSQL**
2. 設定を入力して作成
3. **Connections**タブから**Internal Database URL**をコピー

### 3. Renderでバックエンドを作成

1. **New > Web Service**
2. GitHubリポジトリを接続
3. 以下の設定を入力：

   **基本設定**:
   - Name: `kyoryokutai-backend`
   - Region: 最寄りのリージョン
   - Branch: `main`（または使用しているブランチ）
   - Root Directory: `backend` ⚠️ 重要
   - Runtime: `Node`
   - Build Command: `npm install && npm run build && npx prisma generate`
   - Start Command: `npm run migrate:deploy && npm start`

   **環境変数**:
   ```
   DATABASE_URL=<PostgreSQLのInternal Database URL>
   JWT_SECRET=<openssl rand -base64 32で生成>
   NODE_ENV=production
   PORT=10000
   ```

4. **Create Web Service**をクリック
5. デプロイが完了するまで待つ（5-10分）
6. デプロイが成功したら、URLをメモ（例: `https://kyoryokutai-backend.onrender.com`）

### 4. Renderでフロントエンドを作成

1. **New > Static Site**
2. GitHubリポジトリを接続
3. 以下の設定を入力：

   **基本設定**:
   - Name: `kyoryokutai-frontend`
   - Region: 最寄りのリージョン
   - Branch: `main`（または使用しているブランチ）
   - Root Directory: `frontend` ⚠️ 重要
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist` ⚠️ 重要

   **環境変数**:
   ```
   VITE_API_URL=<ステップ3でメモしたバックエンドURL>
   ```

4. **Create Static Site**をクリック
5. デプロイが完了するまで待つ（3-5分）
6. デプロイが成功したら、URLをメモ（例: `https://kyoryokutai-frontend.onrender.com`）

### 5. 環境変数の更新

1. バックエンドの設定に戻る
2. **Environment**タブを開く
3. 新しい環境変数を追加：
   ```
   FRONTEND_URL=<ステップ4でメモしたフロントエンドURL>
   ```
4. **Save Changes**をクリック（自動的に再デプロイされます）

### 6. データベースの初期化

ローカルマシンで以下を実行：

```bash
cd backend
DATABASE_URL=<PostgreSQLのInternal Database URL> npx prisma migrate deploy
DATABASE_URL=<PostgreSQLのInternal Database URL> npm run seed
```

**注意**: `Internal Database URL`を使用してください（`External Database URL`ではありません）

## 🐛 トラブルシューティング

### バックエンドが失敗する場合

#### エラー: "Cannot find module 'prisma'"

**原因**: `prisma`が`devDependencies`にある

**解決策**: `backend/package.json`で`prisma`を`dependencies`に移動

#### エラー: "Prisma Client has not been generated"

**原因**: ビルドコマンドで`npx prisma generate`が実行されていない

**解決策**: Build Commandを確認：
```
npm install && npm run build && npx prisma generate
```

#### エラー: "Cannot connect to database"

**原因**: `DATABASE_URL`が正しく設定されていない、または`Internal Database URL`を使用していない

**解決策**: 
1. 環境変数の`DATABASE_URL`を確認
2. PostgreSQLの**Internal Database URL**を使用（`External Database URL`ではない）

#### エラー: "Migration failed"

**原因**: データベースに接続できない、またはマイグレーションが既に実行されている

**解決策**: 
1. `DATABASE_URL`を確認
2. ローカルで手動実行：
   ```bash
   DATABASE_URL=<URL> npx prisma migrate deploy
   ```

### フロントエンドが失敗する場合

#### エラー: "Cannot find module"

**原因**: 依存関係がインストールされていない

**解決策**: Build Commandを確認：
```
npm install && npm run build
```

#### エラー: "TypeScript errors"

**原因**: TypeScriptの型エラー

**解決策**: 一時的にビルドコマンドを変更：
```
npm install && npm run build:skip-check
```
（ただし、エラーを修正することを推奨）

#### エラー: "VITE_API_URL is not defined"

**原因**: 環境変数が設定されていない

**解決策**: 環境変数`VITE_API_URL`を設定

#### エラー: "Publish Directory not found"

**原因**: `dist`ディレクトリが作成されていない、またはPublish Directoryの設定が間違っている

**解決策**: 
1. Publish Directoryが`dist`になっているか確認
2. ビルドログで`dist`ディレクトリが作成されているか確認

## 📝 チェックリスト

デプロイ前に以下を確認：

### バックエンド
- [ ] `backend/package.json`で`prisma`が`dependencies`にある
- [ ] Root Directoryが`backend`に設定されている
- [ ] Build Commandが`npm install && npm run build && npx prisma generate`
- [ ] Start Commandが`npm run migrate:deploy && npm start`
- [ ] 環境変数`DATABASE_URL`が設定されている（Internal Database URL）
- [ ] 環境変数`JWT_SECRET`が設定されている
- [ ] 環境変数`NODE_ENV=production`が設定されている
- [ ] 環境変数`PORT=10000`が設定されている

### フロントエンド
- [ ] Root Directoryが`frontend`に設定されている
- [ ] Build Commandが`npm install && npm run build`
- [ ] Publish Directoryが`dist`に設定されている
- [ ] 環境変数`VITE_API_URL`が設定されている（バックエンドのURL）

### データベース
- [ ] PostgreSQLが作成されている
- [ ] Internal Database URLをコピーしている
- [ ] マイグレーションが実行されている
- [ ] シードが実行されている

## 🎯 成功の確認

1. **バックエンド**: `https://your-backend.onrender.com/health`にアクセスして`{"status":"ok"}`が返ることを確認
2. **フロントエンド**: フロントエンドのURLにアクセスしてログイン画面が表示されることを確認
3. **ログイン**: テストアカウントでログインできることを確認

## 💡 ヒント

- Renderの無料プランは15分間アクセスがないとスリープします
- 初回アクセス時に起動に時間がかかります（30秒〜2分）
- ログを確認してエラーの詳細を把握してください
- デプロイが失敗した場合は、ログを確認して原因を特定してください

