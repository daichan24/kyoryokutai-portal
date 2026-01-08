# 長沼町地域おこし協力隊ポータルシステム

地域おこし協力隊の活動管理を支援する統合管理システム

**現在の開発状況**: Phase 4 バックエンド実装完了

## 技術スタック

- **フロントエンド**: React 18 + TypeScript + Vite + Tailwind CSS
- **バックエンド**: Node.js 20 + Express + TypeScript + Prisma
- **データベース**: PostgreSQL 16
- **環境**: Docker + Docker Compose

## 機能概要

### Phase 1 機能（✅ 実装完了）

#### 認証・ユーザー管理
- ログイン機能（JWT認証）
- ユーザー一覧・詳細・編集・削除（管理者のみ）
- 役割管理（MASTER / MEMBER / SUPPORT / GOVERNMENT）

#### スケジュール管理
- カレンダー表示（週表示）
- スケジュール作成・編集・削除
- 活動内容・場所・時間の記録
- ユーザーごとの色分け表示

#### 週次報告
- 週次報告の作成・編集・閲覧
- 今週の活動記録
- 来週の予定
- 提出ステータス管理

#### マスターデータ管理
- 場所マスタの管理（追加・編集・有効化/無効化）

### Phase 2 機能（🔨 実装準備完了）

#### 起業準備進捗管理
- 目標→中目標→小目標→タスクの4階層構造
- 重み付け自動計算（均等割り・期間比率）
- 進捗の自動計算（下位階層から上位へ）
- 承認フロー機能

#### プロジェクト管理
- プロジェクト作成・編集・削除
- メンバー管理（主担当・サポート）
- タスク管理と進捗追跡
- 卒業後の目標との紐付け
- 承認フロー機能

#### イベント管理
- 町主催イベント・協力隊イベント管理
- 参加ポイント制（参加: 1.0pt、準備: 0.5pt）
- 年間参加ポイント集計
- アンケート機能

#### SNS投稿管理
- 週次投稿状況の記録
- 未投稿者のアラート
- ストーリー・フィード区分

#### 月次報告
- スケジュールからの自動抽出
- メンバーシート一括生成
- まおいのはこ支援記録管理

#### 町民データベース
- 町民情報の登録・管理
- 接触履歴の記録
- プロジェクトとの連携

詳細な実装手順は `PHASE2_IMPLEMENTATION_GUIDE.md` を参照してください。

### Phase 3 機能（✅ 実装完了）

#### クイック入力機能
- 自然文からスケジュール解析（日付・時刻・場所・参加者の自動検出）
- 対応パターン: 明日、今週○曜日、HH:MM-HH:MM形式など
- 不足項目の警告表示
- クライアントサイド処理（API不要）

#### 予定の自動紐付け
- 複数ユーザーへのスケジュール提案
- スケジュール衝突の自動検知
- 承認/拒否による予定追加
- リアルタイム通知（30秒ポーリング）

#### テンプレート機能
- よく使うスケジュールをテンプレート保存
- テンプレートからワンクリック作成
- ユーザーごとのテンプレート管理

#### 繰り返し機能
- 毎日・毎週・毎月の繰り返し設定
- 曜日指定（週の繰り返し時）
- 終了日設定
- 一括作成

#### ドラッグ&ドロップカレンダー
- スケジュールのドラッグ移動
- 週表示対応
- 視覚的な日付変更

#### ダッシュボードカスタマイズ
- ウィジェットの表示/非表示切り替え
- ドラッグ&ドロップで並び替え
- ユーザーごとの設定保存
- デフォルト設定へのリセット

#### 進捗保留モード
- 未更新スケジュールの追跡
- ダッシュボードでアラート表示
- ワンクリックでスケジュール確認

#### 週末リマインダー
- 毎週金曜20時に自動実行
- 保留スケジュール・次週予定・週次報告・SNS投稿のチェック
- 将来的な通知機能への拡張可能

詳細な実装手順は `PHASE3_IMPLEMENTATION_GUIDE.md` を参照してください。

### Phase 4 機能（✅ 実装完了 - バックエンド）

#### タスク依頼機能
- サポート/役場から協力隊員へのタスク依頼
- 承認/却下フロー
- 承認時の自動タスク作成
- 通知機能との連携

#### 視察復命書
- 視察記録の作成・管理
- 視察目的・内容・所感・今後のアクションの記録
- PDF出力機能（puppeteer使用）
- プロジェクトとの紐付け

#### 個人事業モード
- 協力隊モードと分離された個人用タスク管理
- 個人プロジェクト・タスク・スケジュール管理
- ユーザーごとのモード切り替え

#### 通知システム
- 全機能統合型の通知システム
- 8種類の通知タイプ対応
- 既読/未読管理
- リアルタイムポーリング（30秒）

#### PDF生成機能
- 視察復命書PDF出力
- 週次報告PDF出力
- 月次報告PDF出力
- puppeteerによる高品質PDF生成

**実装状況**: バックエンドAPI完全実装、フロントエンド型定義・通知コンポーネント実装済み

## デプロイ

Web上で公開する方法については、以下のガイドを参照してください。

### クイックスタート（最も簡単）

**30分でデプロイ**: `QUICK_DEPLOY.md` を参照してください。

### 詳細なデプロイ方法

`DEPLOYMENT_GUIDE.md` を参照してください。

主なデプロイ方法：
- **Render**（推奨、すべて一括、無料プランあり）⭐ 最も簡単
- **Vercel + Railway + Supabase**（無料プランあり）
- **VPS + Docker Compose**（フルコントロール）

## セットアップ手順

### 前提条件

- Docker Desktop がインストールされていること
- Git がインストールされていること

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd kyoryokutai-portal
```

### 2. 環境変数の設定

ルートディレクトリに `.env` ファイルを作成：

```bash
cp .env.example .env
```

`.env` ファイルの内容（必要に応じて変更）：

```env
# Database
DATABASE_URL=postgresql://postgres:postgres@database:5432/kyoryokutai

# Backend
JWT_SECRET=your-secret-key-change-in-production
NODE_ENV=development
PORT=3001

# Frontend
VITE_API_URL=http://localhost:3001
```

### 3. Docker Composeで起動

```bash
docker-compose up --build
```

初回起動時には以下の処理が自動で実行されます：
- データベースのマイグレーション
- 初期データの投入（テストユーザー、場所マスタ）

### 4. アプリケーションへのアクセス

起動が完了したら、ブラウザで以下のURLにアクセス：

- **フロントエンド**: http://localhost:5173
- **バックエンドAPI**: http://localhost:3001
- **ヘルスチェック**: http://localhost:3001/health

## テストアカウント

初期データとして以下のテストアカウントが作成されます：

| 役割 | メールアドレス | パスワード | 名前 |
|------|----------------|------------|------|
| マスター | master@test.com | password123 | 佐藤大地 |
| メンバー | member@test.com | password123 | 田中太郎 |
| サポート | support@test.com | password123 | 坂本一志 |

## 基本的な使い方

### 1. ログイン

1. http://localhost:5173 にアクセス
2. テストアカウントでログイン

### 2. スケジュール作成

1. サイドバーから「スケジュール」を選択
2. カレンダーの日付をクリックまたは「新規作成」ボタンをクリック
3. 日付・時間・場所・活動内容を入力
4. 「保存」ボタンをクリック

### 3. 週次報告作成

1. サイドバーから「週次報告」を選択
2. 「新規作成」ボタンをクリック
3. 週・今週の活動・来週の予定を入力
4. 「下書き保存」または「提出」ボタンをクリック

### 4. ユーザー管理（マスターのみ）

1. サイドバーから「ユーザー管理」を選択
2. ユーザー一覧が表示されます

### 5. 場所管理（マスターのみ）

1. サイドバーから「場所管理」を選択
2. 新しい場所を追加したり、既存の場所を有効化/無効化できます

## 開発環境

### バックエンド開発

```bash
cd backend
npm install
npm run dev
```

### フロントエンド開発

```bash
cd frontend
npm install
npm run dev
```

### データベースマイグレーション

```bash
cd backend
npm run migrate:dev
```

### 初期データの再投入（テストユーザー作成）

**重要**: テストログインを使用するには、必ずシードを実行してください。

```bash
cd backend
npm run seed
```

シードが正常に実行されると、以下のテストユーザーが作成されます：

| 役割 | メールアドレス | パスワード | 名前 |
|------|----------------|------------|------|
| マスター | master@test.com | password123 | 佐藤大地 |
| メンバー | member@test.com | password123 | 田中太郎 |
| サポート | support@test.com | password123 | 坂本一志 |

**データベースの確認方法**:

Prisma Studioを使用してデータベースの内容を確認できます：

```bash
cd backend
npx prisma studio
```

ブラウザが自動的に開き、データベースの内容を確認できます。

**詳細なセットアップ手順**: `SETUP_GUIDE.md` を参照してください。

## プロジェクト構成

```
kyoryokutai-portal/
├── backend/
│   ├── src/
│   │   ├── routes/         # APIルート
│   │   ├── middleware/     # ミドルウェア
│   │   ├── lib/            # ユーティリティ
│   │   └── index.ts        # エントリーポイント
│   ├── prisma/
│   │   ├── schema.prisma   # データベーススキーマ
│   │   └── seed.ts         # 初期データ
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # Reactコンポーネント
│   │   ├── pages/          # ページコンポーネント
│   │   ├── stores/         # 状態管理（Zustand）
│   │   ├── utils/          # ユーティリティ
│   │   ├── types/          # TypeScript型定義
│   │   ├── App.tsx         # アプリケーションルート
│   │   └── main.tsx        # エントリーポイント
│   └── package.json
├── docker-compose.yml
└── README.md
```

## API エンドポイント

### Phase 1 APIs

#### 認証
- `POST /api/auth/register` - ユーザー登録
- `POST /api/auth/login` - ログイン
- `GET /api/auth/me` - 現在のユーザー情報取得

#### ユーザー管理
- `GET /api/users` - ユーザー一覧（管理者のみ）
- `GET /api/users/:id` - ユーザー詳細
- `PUT /api/users/:id` - ユーザー更新
- `DELETE /api/users/:id` - ユーザー削除（マスターのみ）

#### スケジュール
- `GET /api/schedules` - スケジュール取得
- `POST /api/schedules` - スケジュール作成
- `PUT /api/schedules/:id` - スケジュール更新
- `DELETE /api/schedules/:id` - スケジュール削除

#### 場所マスタ
- `GET /api/locations` - 場所一覧
- `POST /api/locations` - 場所追加（マスターのみ）
- `PUT /api/locations/:id` - 場所更新（マスターのみ）
- `DELETE /api/locations/:id` - 場所削除（マスターのみ）

#### 週次報告
- `GET /api/weekly-reports` - 週次報告一覧
- `GET /api/weekly-reports/:userId/:week` - 特定の週次報告取得
- `POST /api/weekly-reports` - 週次報告作成
- `PUT /api/weekly-reports/:id` - 週次報告更新

### Phase 2 APIs（実装準備完了）

#### 起業準備進捗管理
- `GET /api/goals` - 目標一覧
- `GET /api/goals/:id` - 目標詳細（進捗計算済み）
- `POST /api/goals` - 目標作成
- `POST /api/goals/:id/approve` - 目標承認/差し戻し
- `POST /api/goals/:goalId/mid-goals` - 中目標作成
- `POST /api/goals/:id/recalculate-weights` - 重み再計算

#### プロジェクト管理
- `GET /api/projects` - プロジェクト一覧
- `POST /api/projects` - プロジェクト作成
- `POST /api/projects/:projectId/tasks` - タスク作成
- `POST /api/projects/:id/approve` - プロジェクト承認

#### イベント管理
- `GET /api/events` - イベント一覧
- `POST /api/events` - イベント作成
- `POST /api/events/:eventId/participate` - イベント参加登録
- `GET /api/events/points/:userId` - ポイント集計

#### SNS投稿管理
- `GET /api/sns-posts/:userId/:week` - 週の投稿状況
- `POST /api/sns-posts` - 投稿記録
- `GET /api/sns-posts/unpublished?week=YYYY-WW` - 未投稿者一覧

#### 月次報告
- `GET /api/monthly-reports` - 月次報告一覧
- `POST /api/monthly-reports/generate` - 月次報告自動生成
- `POST /api/monthly-reports/:id/support-records` - 支援記録追加

#### 町民データベース
- `GET /api/contacts` - 町民一覧
- `POST /api/contacts` - 町民登録
- `POST /api/contacts/:contactId/histories` - 接触履歴追加

## トラブルシューティング

### ポートが使用中の場合

別のアプリケーションがポート5173（フロントエンド）または3001（バックエンド）を使用している場合：

1. `.env` ファイルでポートを変更
2. `docker-compose.yml` のポートマッピングを変更
3. `docker-compose down` でコンテナを停止
4. `docker-compose up --build` で再起動

### データベースのリセット

```bash
docker-compose down -v
docker-compose up --build
```

### ログの確認

```bash
# すべてのコンテナのログ
docker-compose logs

# 特定のコンテナのログ
docker-compose logs backend
docker-compose logs frontend
docker-compose logs database
```

## Phase 2 実装について

Phase 2の詳細な実装手順とコード例は `PHASE2_IMPLEMENTATION_GUIDE.md` に記載されています。

### Phase 2 実装済み項目

✅ **データベーススキーマ** - 全モデル定義完了
✅ **進捗計算サービス** - 階層的な進捗自動計算
✅ **重み計算サービス** - 均等割り・期間比率計算
✅ **月次報告生成サービス** - スケジュールからの自動抽出
✅ **目標管理API** - 完全実装

### 残りの実装タスク

バックエンド:
- プロジェクト管理API（コード例あり）
- イベント管理API（コード例あり）
- SNS投稿管理API（コード例あり）
- 月次報告API（コード例あり）
- 町民データベースAPI（コード例あり）
- バッチジョブ（自動化処理）

フロントエンド:
- 目標管理ページ（ツリー表示）
- プロジェクト管理ページ
- イベント管理ページ
- SNS投稿状況ページ
- 月次報告ページ
- 町民データベースページ

### 今後の開発予定（Phase 3）

- ファイル・写真管理
- コミュニケーション機能
- 通知機能
- レポート自動生成の強化

## ライセンス

このプロジェクトは長沼町地域おこし協力隊向けに開発されたシステムです。

## 問い合わせ

開発に関する質問や問題がある場合は、プロジェクト管理者にお問い合わせください。
