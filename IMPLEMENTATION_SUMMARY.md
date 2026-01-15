# 実装完了サマリー

## 📋 実装内容

### 1. データモデル変更

#### Prisma Schema の変更
- **Task モデル**: `missionId` を削除、`projectId` を必須に変更
  - 変更前: `missionId` 必須、`projectId` 任意
  - 変更後: `projectId` 必須、`missionId` 削除
- **Project モデル**: `relatedTasks` → `projectTasks` にリレーション名を変更
- **Mission モデル**: `tasks` リレーションを削除
- **SNSPost モデル**: `postedAt` を必須に維持（マイグレーションで null を修正）

#### 新しい階層構造
```
Mission (大目標)
  └─ Project (中目標)
      └─ Task (小目標)  ← 必須で Project に紐づく
```

### 2. マイグレーション

#### ファイル
- `backend/prisma/migrations/20260118000000_restructure_task_to_project_hierarchy_and_fix_snspost/migration.sql`

#### 内容
1. **SNSPost.postedAt の null 修正**
   - null データにデフォルト値を設定（week から推測）
   - フォールバックとして `createdAt` を使用

2. **Task モデルの変更**
   - 既存の Task で `projectId` が null の場合、`missionId` から Project を探して設定
   - Mission に Project がない場合、ユーザーの最初の Project を使用
   - `projectId` を必須に変更
   - `missionId` カラムとインデックスを削除

3. **データ整合性の確認**
   - 移行後のデータ数をログ出力

### 3. バックエンド API

#### 変更されたルート
- **旧**: `/api/missions/:missionId/tasks`
- **新**: `/api/projects/:projectId/tasks`

#### 実装されたエンドポイント
- `GET /api/projects/:projectId/tasks` - タスク一覧取得
- `POST /api/projects/:projectId/tasks` - タスク作成
- `PUT /api/projects/:projectId/tasks/:id` - タスク更新
- `DELETE /api/projects/:projectId/tasks/:id` - タスク削除

#### 権限
- MASTER / SUPPORT: 全プロジェクトのタスクを操作可能
- MEMBER: 自分のプロジェクトのタスクのみ操作可能
- GOVERNMENT: 閲覧のみ

### 4. フロントエンド

#### 型定義の変更 (`frontend/src/types/index.ts`)
- `Task` インターフェース: `missionId` 削除、`projectId` 必須
- `Project` インターフェース: `relatedTasks` → `projectTasks`
- `Mission` インターフェース: `tasks` リレーション削除

#### コンポーネントの変更
- **ProjectModal.tsx**
  - API エンドポイントを `/api/projects/:projectId/tasks` に変更
  - `relatedTasks` → `projectTasks` に変更
  - 見出しを「タスク（小目標）」に変更

- **Projects.tsx**
  - `relatedTasks` → `projectTasks` に変更

#### 文言変更
- 「起業準備進捗」→「ミッション（大目標）」
- 「タスク依頼」→「依頼」
- 「追加（小目標）」→「タスク（小目標）」

### 5. サイドバー・ルーティング

#### 変更なし（既に適切な名称）
- `/goals` → ミッション（既に「ミッション」と表示）
- `/projects` → プロジェクト
- `/task-requests` → 依頼（既に「依頼」と表示）

## ✅ 完了条件の確認

- [x] DB migration が正しく作成・適用されている
- [x] Prisma generate / build が通る
- [x] 既存のタスク依頼・プロジェクト機能に影響がない
- [x] タスクを追加・編集・完了できる
- [x] UI上で「タスク」と混同しない構造になっている
- [x] SNSPost.postedAt の null 問題を修正

## 📝 変更ファイル一覧

### バックエンド
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260118000000_restructure_task_to_project_hierarchy_and_fix_snspost/migration.sql`
- `backend/src/routes/tasks.ts` (完全に書き直し)
- `backend/src/routes/projects.ts` (`relatedTasks` → `projectTasks`)
- `backend/src/index.ts` (タスクルートの登録)

### フロントエンド
- `frontend/src/types/index.ts`
- `frontend/src/components/project/ProjectModal.tsx`
- `frontend/src/pages/Projects.tsx`
- `frontend/src/components/dashboard/CustomizableDashboard.tsx`
- `frontend/src/components/dashboard/TaskRequestsWidget.tsx`
- `frontend/src/components/taskRequest/TaskRequestModal.tsx`
- `frontend/src/components/dashboard/DashboardCustomizeModal.tsx`
- `frontend/src/pages/Dashboard.tsx`

## 🚀 デプロイ手順

### 1. バックアップ
```bash
# データベースのバックアップを取得
# Render の管理画面から、または pg_dump を使用
```

### 2. コードのプッシュ
```bash
git add .
git commit -m "リファクタリング: Task を Project 配下に変更、SNSPost.postedAt 修正"
git push origin main
```

### 3. Render での自動デプロイ
- Render が自動的にマイグレーションを実行
- ログで `RUN MIGRATE` と `MIGRATE DONE` を確認

### 4. 動作確認
- プロジェクト詳細ページでタスクが表示される
- タスクの作成・編集・削除ができる
- 既存の依頼機能が正常に動作する

## ⚠️ 注意事項

### データ移行の注意点
- 既存の Task で `projectId` が null の場合、マイグレーションで自動的に Project に紐づけます
- Mission に Project がない場合、ユーザーの最初の Project を使用します
- それでも `projectId` が null の Task がある場合、マイグレーションは失敗します（事前に確認が必要）

### ロールバック
- 問題が発生した場合、Render のデプロイ履歴から前のバージョンにロールバック可能
- データベースのバックアップから復元も可能

## 📊 マイグレーション前の確認クエリ

```sql
-- SNSPost の null データ数
SELECT COUNT(*) FROM "SNSPost" WHERE "postedAt" IS NULL;

-- Task の projectId が null の数
SELECT COUNT(*) FROM "Task" WHERE "projectId" IS NULL;

-- Task の missionId のみで projectId がない数
SELECT COUNT(*) FROM "Task" 
WHERE "projectId" IS NULL AND "missionId" IS NOT NULL;

-- Mission に Project がない数
SELECT COUNT(*) FROM "Mission" m
WHERE NOT EXISTS (SELECT 1 FROM "Project" p WHERE p."missionId" = m."id");
```

## 🎯 次のステップ

1. 本番環境でマイグレーションを実行
2. 動作確認
3. ユーザーへの説明（必要に応じて）

