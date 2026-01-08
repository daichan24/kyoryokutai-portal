# デプロイガイド

このガイドでは、長沼町地域おこし協力隊ポータルシステムをWeb上で公開する手順を説明します。

## デプロイ方法の選択

以下の3つの方法から選択できます：

### 方法1: Vercel + Railway + Supabase（推奨）
- **フロントエンド**: Vercel（無料プランあり）
- **バックエンド**: Railway（無料プランあり）
- **データベース**: Supabase（無料プランあり）

### 方法2: Render（すべて一括）
- **フロントエンド・バックエンド・データベース**: Render（無料プランあり）

### 方法3: VPS + Docker Compose
- **サーバー**: VPS（例：DigitalOcean、AWS EC2）
- **デプロイ**: Docker Compose

---

## 方法1: Vercel + Railway + Supabase でのデプロイ

### ステップ1: データベースのセットアップ（Supabase）

1. [Supabase](https://supabase.com/)にアカウントを作成
2. 新しいプロジェクトを作成
3. プロジェクト設定 > Database > Connection string から接続URLを取得
   - 形式: `postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`

### ステップ2: バックエンドのデプロイ（Railway）

1. [Railway](https://railway.app/)にアカウントを作成
2. GitHubリポジトリを接続
3. 新しいプロジェクトを作成
4. `backend`ディレクトリを選択してデプロイ
5. 環境変数を設定：
   ```
   DATABASE_URL=<Supabaseの接続URL>
   JWT_SECRET=<ランダムな文字列（openssl rand -base64 32で生成）>
   NODE_ENV=production
   FRONTEND_URL=<VercelのURL（後で設定）>
   PORT=3001
   ```
6. デプロイが完了したら、RailwayのURLをメモ（例: `https://your-app.railway.app`）

### ステップ3: フロントエンドのデプロイ（Vercel）

1. [Vercel](https://vercel.com/)にアカウントを作成
2. GitHubリポジトリを接続
3. プロジェクトをインポート
4. 設定：
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. 環境変数を設定：
   ```
   VITE_API_URL=<RailwayのバックエンドURL>
   ```
6. デプロイ

### ステップ4: 環境変数の更新

1. **Railway**の環境変数で`FRONTEND_URL`をVercelのURLに更新
2. **Supabase**でデータベースマイグレーションを実行：
   ```bash
   # ローカルで実行
   cd backend
   DATABASE_URL=<Supabaseの接続URL> npx prisma migrate deploy
   DATABASE_URL=<Supabaseの接続URL> npm run seed
   ```

---

## 方法2: Render でのデプロイ（すべて一括）

### ステップ1: データベースのセットアップ

1. [Render](https://render.com/)にアカウントを作成
2. **New > PostgreSQL** を選択
3. データベースを作成
4. 接続情報をメモ

### ステップ2: バックエンドのデプロイ

1. **New > Web Service** を選択
2. GitHubリポジトリを接続
3. 設定：
   - **Name**: `kyoryokutai-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build && npx prisma generate`
   - **Start Command**: `npm run migrate:deploy && npm start`
4. 環境変数を設定：
   ```
   DATABASE_URL=<Renderデータベースの接続URL>
   JWT_SECRET=<ランダムな文字列>
   NODE_ENV=production
   FRONTEND_URL=<後で設定>
   PORT=10000
   ```
5. デプロイ

### ステップ3: フロントエンドのデプロイ

1. **New > Static Site** を選択
2. GitHubリポジトリを接続
3. 設定：
   - **Name**: `kyoryokutai-frontend`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
4. 環境変数を設定：
   ```
   VITE_API_URL=<RenderバックエンドのURL>
   ```
5. デプロイ

### ステップ4: 環境変数の更新

1. バックエンドの`FRONTEND_URL`をフロントエンドのURLに更新

---

## 方法3: VPS + Docker Compose でのデプロイ

### ステップ1: VPSの準備

1. VPSを用意（例：DigitalOcean Droplet、AWS EC2）
2. SSHで接続
3. DockerとDocker Composeをインストール

### ステップ2: アプリケーションのデプロイ

1. リポジトリをクローン：
   ```bash
   git clone <your-repo-url>
   cd kyoryokutai-portal
   ```

2. 環境変数ファイルを作成：
   ```bash
   cp .env.example .env
   # .envファイルを編集して本番環境用の設定を追加
   ```

3. 本番用docker-compose.ymlを作成（`docker-compose.prod.yml`）：
   ```yaml
   version: '3.8'
   
   services:
     database:
       image: postgres:16-alpine
       environment:
         POSTGRES_USER: ${POSTGRES_USER:-postgres}
         POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
         POSTGRES_DB: ${POSTGRES_DB:-kyoryokutai}
       volumes:
         - postgres_data:/var/lib/postgresql/data
       restart: unless-stopped
   
     backend:
       build:
         context: ./backend
         dockerfile: Dockerfile.prod
       environment:
         DATABASE_URL: ${DATABASE_URL}
         JWT_SECRET: ${JWT_SECRET}
         NODE_ENV: production
         FRONTEND_URL: ${FRONTEND_URL}
         PORT: 3001
       depends_on:
         - database
       restart: unless-stopped
       ports:
         - "3001:3001"
   
     frontend:
       build:
         context: ./frontend
         dockerfile: Dockerfile.prod
         args:
           VITE_API_URL: ${VITE_API_URL}
       ports:
         - "80:80"
       depends_on:
         - backend
       restart: unless-stopped
   
   volumes:
     postgres_data:
   ```

4. デプロイ：
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

5. データベースマイグレーションとシード：
   ```bash
   docker-compose -f docker-compose.prod.yml exec backend npm run migrate:deploy
   docker-compose -f docker-compose.prod.yml exec backend npm run seed
   ```

### ステップ3: リバースプロキシの設定（Nginx）

1. Nginxをインストール：
   ```bash
   sudo apt update
   sudo apt install nginx
   ```

2. 設定ファイルを作成：
   ```bash
   sudo nano /etc/nginx/sites-available/kyoryokutai
   ```

3. 設定内容：
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
   
       # フロントエンド
       location / {
           proxy_pass http://localhost:80;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   
       # バックエンドAPI
       location /api {
           proxy_pass http://localhost:3001;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       }
   }
   ```

4. 有効化：
   ```bash
   sudo ln -s /etc/nginx/sites-available/kyoryokutai /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

---

## デプロイ後の確認事項

### 1. データベースマイグレーションの確認

```bash
# ローカルから実行
cd backend
DATABASE_URL=<本番DBのURL> npx prisma migrate status
```

### 2. テストユーザーの確認

Prisma Studioで確認：
```bash
DATABASE_URL=<本番DBのURL> npx prisma studio
```

### 3. ヘルスチェック

- バックエンド: `https://your-backend-url/health`
- フロントエンド: `https://your-frontend-url`

### 4. ログインの確認

テストアカウントでログインできるか確認：
- master@test.com / password123
- member@test.com / password123
- support@test.com / password123

---

## セキュリティチェックリスト

- [ ] `JWT_SECRET`を強力なランダム文字列に変更
- [ ] データベースのパスワードを強力なものに変更
- [ ] CORS設定で許可するオリジンを本番URLに限定
- [ ] HTTPSを有効化（Let's Encrypt等）
- [ ] 環境変数に機密情報が含まれていないか確認
- [ ] 不要なポートを閉じる
- [ ] 定期的なバックアップを設定

---

## トラブルシューティング

### エラー: "Cannot connect to database"

**原因**: データベース接続URLが間違っている、またはネットワーク設定の問題

**解決策**:
1. 接続URLを確認
2. データベースのファイアウォール設定を確認
3. SSL接続が必要な場合は`?sslmode=require`を追加

### エラー: "Migration failed"

**解決策**:
```bash
DATABASE_URL=<本番DBのURL> npx prisma migrate deploy
```

### エラー: "CORS error"

**原因**: フロントエンドURLがCORS設定に含まれていない

**解決策**: バックエンドの環境変数`FRONTEND_URL`を確認

---

## 継続的なデプロイ（CI/CD）

GitHub Actionsを使用して自動デプロイを設定することもできます。詳細は各プラットフォームのドキュメントを参照してください。

---

## 次のステップ

デプロイが完了したら：

1. カスタムドメインの設定
2. SSL証明書の設定（Let's Encrypt）
3. モニタリングの設定
4. バックアップの自動化
5. ログ管理の設定

