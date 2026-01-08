# Render デプロイ完全ガイド（ステップバイステップ）

Renderでデプロイが失敗する場合の、詳細な解決手順です。

## 🎯 前提条件

- GitHubリポジトリにコードがプッシュされていること
- Renderアカウントが作成されていること

## 📋 ステップバイステップ手順

### ステップ1: バックエンドのpackage.jsonを修正 ✅

**重要**: `prisma`を`dependencies`に移動する必要があります。

`backend/package.json`を開いて、以下の変更を確認：

```json
{
  "dependencies": {
    "@prisma/client": "^5.21.1",
    "prisma": "^5.21.1",  // ← これがdependenciesにあることを確認
    ...
  }
}
```

**変更をコミット**:
```bash
git add backend/package.json
git commit -m "fix: Move prisma to dependencies for production build"
git push
```

### ステップ2: RenderでPostgreSQLデータベースを作成

1. Renderダッシュボードにログイン
2. **New +** ボタンをクリック
3. **PostgreSQL** を選択
4. 以下の設定を入力：
   - **Name**: `kyoryokutai-db`
   - **Database**: `kyoryokutai`
   - **User**: `kyoryokutai`
   - **Region**: 最寄りのリージョン（例: `Oregon (US West)`）
   - **PostgreSQL Version**: `16`（デフォルト）
   - **Plan**: `Free`（無料プラン）
5. **Create Database** をクリック
6. データベースが作成されるまで待つ（1-2分）
7. データベースの詳細ページを開く
8. **Connections** タブをクリック
9. **Internal Database URL** をコピー（⚠️ **External Database URLではない**）
   - 形式: `postgresql://kyoryokutai:password@dpg-xxxxx-a.oregon-postgres.render.com/kyoryokutai`

### ステップ3: Renderでバックエンド（Web Service）を作成

1. Renderダッシュボードで **New +** ボタンをクリック
2. **Web Service** を選択
3. **Connect account** でGitHubアカウントを接続（まだの場合）
4. リポジトリを選択
5. 以下の設定を入力：

   **基本設定**:
   - **Name**: `kyoryokutai-backend`
   - **Region**: データベースと同じリージョン
   - **Branch**: `main`（または使用しているブランチ）
   - **Root Directory**: `backend` ⚠️ **重要：必ず設定**
   - **Runtime**: `Node`
   - **Build Command**: 
     ```
     npm install && npm run build && npx prisma generate
     ```
   - **Start Command**: 
     ```
     npm run migrate:deploy && npm start
     ```

   **環境変数**（**Advanced** を開く）:
   - **DATABASE_URL**: ステップ2でコピーしたInternal Database URL
   - **JWT_SECRET**: ランダムな文字列（例: `openssl rand -base64 32`で生成）
   - **NODE_ENV**: `production`
   - **PORT**: `10000`（Renderのデフォルトポート）

6. **Create Web Service** をクリック
7. デプロイが開始されます（5-10分かかります）
8. **Logs** タブでデプロイの進行状況を確認
9. デプロイが成功したら、URLをメモ（例: `https://kyoryokutai-backend.onrender.com`）

**⚠️ デプロイが失敗する場合**:
- **Logs** タブでエラーメッセージを確認
- よくあるエラーと解決策は後述

### ステップ4: バックエンドの動作確認

1. ブラウザで `https://your-backend-url.onrender.com/health` にアクセス
2. `{"status":"ok","timestamp":"..."}` が返ってくれば成功

### ステップ5: Renderでフロントエンド（Static Site）を作成

1. Renderダッシュボードで **New +** ボタンをクリック
2. **Static Site** を選択
3. リポジトリを選択
4. 以下の設定を入力：

   **基本設定**:
   - **Name**: `kyoryokutai-frontend`
   - **Region**: 最寄りのリージョン
   - **Branch**: `main`（または使用しているブランチ）
   - **Root Directory**: `frontend` ⚠️ **重要：必ず設定**
   - **Build Command**: 
     ```
     npm install && npm run build
     ```
   - **Publish Directory**: `dist` ⚠️ **重要：必ず設定**

   **環境変数**:
   - **VITE_API_URL**: ステップ3でメモしたバックエンドURL（例: `https://kyoryokutai-backend.onrender.com`）

5. **Create Static Site** をクリック
6. デプロイが開始されます（3-5分かかります）
7. デプロイが成功したら、URLをメモ（例: `https://kyoryokutai-frontend.onrender.com`）

### ステップ6: 環境変数の更新

1. バックエンドの設定ページに戻る
2. **Environment** タブをクリック
3. **Add Environment Variable** をクリック
4. 以下を追加：
   - **Key**: `FRONTEND_URL`
   - **Value**: ステップ5でメモしたフロントエンドURL（例: `https://kyoryokutai-frontend.onrender.com`）
5. **Save Changes** をクリック
6. 自動的に再デプロイが開始されます

### ステップ7: データベースの初期化

ローカルマシンで以下を実行：

```bash
# プロジェクトのルートディレクトリに移動
cd /path/to/kyoryokutai-portal

# バックエンドディレクトリに移動
cd backend

# マイグレーションを実行
DATABASE_URL="<ステップ2でコピーしたInternal Database URL>" npx prisma migrate deploy

# シードを実行（テストユーザーを作成）
DATABASE_URL="<ステップ2でコピーしたInternal Database URL>" npm run seed
```

**注意**: 
- `Internal Database URL`を使用してください
- コマンドは1行で実行してください（改行しない）

### ステップ8: 動作確認

1. フロントエンドのURLにアクセス
2. ログイン画面が表示されることを確認
3. テストアカウントでログイン：
   - Email: `master@test.com`
   - Password: `password123`

## 🐛 よくあるエラーと解決策

### バックエンドのエラー

#### エラー1: "Cannot find module 'prisma'"

**原因**: `prisma`が`devDependencies`にある

**解決策**: 
1. `backend/package.json`を確認
2. `prisma`が`dependencies`にあることを確認
3. 変更をコミット・プッシュ
4. Renderで再デプロイ

#### エラー2: "Prisma Client has not been generated"

**原因**: ビルドコマンドで`npx prisma generate`が実行されていない

**解決策**: Build Commandを確認：
```
npm install && npm run build && npx prisma generate
```

#### エラー3: "Cannot connect to database"

**原因**: 
- `DATABASE_URL`が設定されていない
- `External Database URL`を使用している（`Internal Database URL`を使用する必要がある）

**解決策**: 
1. 環境変数の`DATABASE_URL`を確認
2. PostgreSQLの**Connections**タブから**Internal Database URL**をコピー
3. 環境変数を更新して再デプロイ

#### エラー4: "Migration failed"

**原因**: データベースに接続できない、またはマイグレーションが既に実行されている

**解決策**: 
1. `DATABASE_URL`が正しいか確認
2. ローカルで手動実行：
   ```bash
   DATABASE_URL="<Internal Database URL>" npx prisma migrate deploy
   ```

#### エラー5: "TypeScript compilation errors"

**原因**: TypeScriptの型エラー

**解決策**: 
1. ローカルで`npm run build`を実行してエラーを確認
2. エラーを修正
3. コミット・プッシュして再デプロイ

### フロントエンドのエラー

#### エラー1: "Cannot find module"

**原因**: 依存関係がインストールされていない

**解決策**: Build Commandを確認：
```
npm install && npm run build
```

#### エラー2: "TypeScript errors"

**原因**: TypeScriptの型エラー

**解決策**: 
1. ローカルで`npm run build`を実行してエラーを確認
2. エラーを修正
3. 一時的にビルドコマンドを変更（非推奨）：
   ```
   npm install && npm run build:skip-check
   ```

#### エラー3: "VITE_API_URL is not defined"

**原因**: 環境変数が設定されていない

**解決策**: 
1. 環境変数`VITE_API_URL`を設定
2. バックエンドのURLを正しく設定（`https://`で始まる）

#### エラー4: "Publish Directory not found"

**原因**: 
- `dist`ディレクトリが作成されていない
- Publish Directoryの設定が間違っている

**解決策**: 
1. Publish Directoryが`dist`になっているか確認
2. ビルドログで`dist`ディレクトリが作成されているか確認
3. ローカルで`npm run build`を実行して`dist`が作成されるか確認

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

1. **バックエンド**: `https://your-backend.onrender.com/health`にアクセス
   - 期待される結果: `{"status":"ok","timestamp":"..."}`

2. **フロントエンド**: フロントエンドのURLにアクセス
   - 期待される結果: ログイン画面が表示される

3. **ログイン**: テストアカウントでログイン
   - Email: `master@test.com`
   - Password: `password123`
   - 期待される結果: ダッシュボードが表示される

## 💡 ヒント

- Renderの無料プランは15分間アクセスがないとスリープします
- 初回アクセス時に起動に時間がかかります（30秒〜2分）
- ログを確認してエラーの詳細を把握してください
- デプロイが失敗した場合は、ログを確認して原因を特定してください
- `Internal Database URL`と`External Database URL`の違いに注意してください

## 📞 サポート

問題が解決しない場合は、以下を確認してください：

1. Renderのログを確認
2. ローカルで`npm run build`が成功するか確認
3. 環境変数が正しく設定されているか確認
4. Root DirectoryとPublish Directoryが正しく設定されているか確認

