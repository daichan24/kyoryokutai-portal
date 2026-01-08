# クイックデプロイガイド

最も簡単な方法でWeb上に公開する手順です。

## 🚀 最も簡単な方法：Render（推奨）

Renderは無料プランがあり、フロントエンド・バックエンド・データベースをすべて一括でデプロイできます。

### 所要時間：約30分

### ステップ1: Renderアカウント作成

1. [Render](https://render.com/)にアクセス
2. GitHubアカウントでサインアップ

### ステップ2: データベース作成

1. Renderダッシュボードで **New > PostgreSQL** をクリック
2. 設定：
   - **Name**: `kyoryokutai-db`
   - **Database**: `kyoryokutai`
   - **User**: `kyoryokutai`
   - **Region**: 最寄りのリージョン
3. **Create Database** をクリック
4. **Connections** タブから **Internal Database URL** をコピー（後で使います）

### ステップ3: バックエンドデプロイ

**⚠️ 重要**: デプロイ前に`backend/package.json`で`prisma`が`dependencies`にあることを確認してください。

1. **New > Web Service** をクリック
2. GitHubリポジトリを接続
3. 設定：
   - **Name**: `kyoryokutai-backend`
   - **Root Directory**: `backend` ⚠️ **必ず設定**
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build && npx prisma generate`
   - **Start Command**: `npm run migrate:deploy && npm start`
4. **Advanced** を開いて環境変数を追加：
   ```
   DATABASE_URL=<ステップ2でコピーしたInternal Database URL>
   JWT_SECRET=<ランダムな文字列（例：openssl rand -base64 32）>
   NODE_ENV=production
   PORT=10000
   ```
   **注意**: 
   - `JWT_SECRET`は必ず強力なランダム文字列に変更してください
   - `DATABASE_URL`は**Internal Database URL**を使用してください（Externalではない）
5. **Create Web Service** をクリック
6. **Logs**タブでデプロイの進行状況を確認
7. デプロイが完了したら、URLをメモ（例: `https://kyoryokutai-backend.onrender.com`）

**デプロイが失敗する場合**: `RENDER_STEP_BY_STEP.md`のトラブルシューティングセクションを参照してください。

### ステップ4: フロントエンドデプロイ

1. **New > Static Site** をクリック
2. GitHubリポジトリを接続
3. 設定：
   - **Name**: `kyoryokutai-frontend`
   - **Root Directory**: `frontend` ⚠️ **必ず設定**
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist` ⚠️ **必ず設定**
4. 環境変数を追加：
   ```
   VITE_API_URL=<ステップ3でメモしたバックエンドURL>
   ```
   **注意**: URLは`https://`で始まる完全なURLを入力してください
5. **Create Static Site** をクリック
6. **Logs**タブでデプロイの進行状況を確認
7. デプロイが完了したら、URLをメモ（例: `https://kyoryokutai-frontend.onrender.com`）

**デプロイが失敗する場合**: `RENDER_STEP_BY_STEP.md`のトラブルシューティングセクションを参照してください。

### ステップ5: 環境変数の更新

1. バックエンドの設定に戻る
2. **Environment** タブを開く
3. 新しい環境変数を追加：
   ```
   FRONTEND_URL=<ステップ4でメモしたフロントエンドURL>
   ```
4. **Save Changes** をクリック（自動的に再デプロイされます）

### ステップ6: データベースの初期化

1. ローカルマシンで以下を実行：
   ```bash
   cd backend
   DATABASE_URL=<ステップ2でコピーしたURL> npx prisma migrate deploy
   DATABASE_URL=<ステップ2でコピーしたURL> npm run seed
   ```

### ステップ7: 動作確認

1. フロントエンドのURLにアクセス
2. テストアカウントでログイン：
   - master@test.com / password123
   - member@test.com / password123
   - support@test.com / password123

## ✅ 完了！

これでWeb上でアクセスできるようになりました！

## 🔒 セキュリティの強化（推奨）

1. **JWT_SECRETの変更**: 必ず強力なランダム文字列に変更してください
2. **データベースパスワードの変更**: Renderのデータベース設定から変更可能
3. **カスタムドメインの設定**: Renderの設定からカスタムドメインを追加できます

## 📝 注意事項

- Renderの無料プランは、15分間アクセスがないとスリープします（初回アクセス時に起動に時間がかかります）
- 本番環境で使用する場合は、有料プランの検討をおすすめします
- 定期的にバックアップを取ることをおすすめします

## 🆘 トラブルシューティング

### デプロイが失敗する

**バックエンド**:
- **エラー**: "Cannot find module 'prisma'"
  - **解決策**: `backend/package.json`で`prisma`が`dependencies`にあることを確認
- **エラー**: "Cannot connect to database"
  - **解決策**: `DATABASE_URL`が**Internal Database URL**になっているか確認（Externalではない）
- **エラー**: "Prisma Client has not been generated"
  - **解決策**: Build Commandに`npx prisma generate`が含まれているか確認

**フロントエンド**:
- **エラー**: "Publish Directory not found"
  - **解決策**: Publish Directoryが`dist`になっているか確認
- **エラー**: "VITE_API_URL is not defined"
  - **解決策**: 環境変数`VITE_API_URL`が設定されているか確認

### ログインできない

- データベースのシードが実行されているか確認（ステップ6）
- バックエンドのログを確認
- CORSエラーが出ていないか確認（ブラウザのコンソールを確認）

### CORSエラーが出る

- バックエンドの`FRONTEND_URL`環境変数が正しく設定されているか確認
- フロントエンドのURLが`https://`で始まる完全なURLになっているか確認

**詳細なトラブルシューティング**: `RENDER_STEP_BY_STEP.md`を参照してください。

---

詳細なデプロイ方法については、`DEPLOYMENT_GUIDE.md`を参照してください。

