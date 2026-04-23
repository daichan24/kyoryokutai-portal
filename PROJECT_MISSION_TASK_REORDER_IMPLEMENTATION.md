# プロジェクト・ミッション・タスク順番入れ替え機能実装

## 実装概要

プロジェクト、ミッション、タスクの表示順序を変更できる機能を実装しました。

## 実装内容

### 1. データベース変更

#### マイグレーション
- ファイル: `backend/prisma/migrations/20260423000000_add_project_order/migration.sql`
- `Project`テーブルに`order`フィールドを追加（INTEGER, DEFAULT 0）
- `Mission`テーブルに`order`フィールドを追加（INTEGER, DEFAULT 0）
- `Task`テーブルには既に`order`フィールドが存在

#### Prismaスキーマ更新
- `backend/prisma/schema.prisma`
  - `Project`モデルに`order Int @default(0)`を追加
  - `Mission`モデルに`order Int @default(0)`を追加
  - インデックスを追加: `@@index([userId, order])`

### 2. バックエンドAPI

#### プロジェクト順番入れ替え
- エンドポイント: `POST /api/projects/:id/reorder`
- パラメータ: `{ direction: 'up' | 'down' }`
- 機能: 同じユーザーのプロジェクト間で順番を入れ替え

#### ミッション順番入れ替え
- エンドポイント: `POST /api/missions/:id/reorder`
- パラメータ: `{ direction: 'up' | 'down' }`
- 機能: 同じユーザーのミッション間で順番を入れ替え
- 制約: デフォルトミッション（協力隊業務・役場業務）は順番変更不可

#### タスク順番入れ替え
- エンドポイント: `POST /api/missions/:missionId/tasks/:id/reorder`
- パラメータ: `{ direction: 'up' | 'down' }`
- 機能: 同じミッション内のタスク間で順番を入れ替え

#### 一覧取得の変更
- プロジェクト一覧: `orderBy: [{ order: 'asc' }, { createdAt: 'asc' }]`
- ミッション一覧: `orderBy: [{ order: 'asc' }, { createdAt: 'asc' }]`
- タスク一覧: `orderBy: [{ order: 'asc' }, { createdAt: 'asc' }]`

### 3. フロントエンド

#### Projects.tsx
- 上下矢印ボタンを追加（viewMode === 'create'の場合のみ表示）
- `handleReorder`関数を実装
- ArrowUp, ArrowDownアイコンをimport

#### Goals.tsx
- 上下矢印ボタンを追加（viewMode === 'create'かつデフォルトミッション以外）
- `handleReorderMission`関数を実装
- デフォルトミッション（協力隊業務・役場業務）は順番変更不可

#### Tasks.tsx
- 上下矢印ボタンを追加（viewMode === 'create'の場合のみ表示）
- `handleReorderTask`関数を実装

#### TaskModal.tsx
- ミッション選択時にプロジェクトをフィルタリング
- ミッションとプロジェクトのドロップダウンを登録順（古い順）にソート
- `filteredProjects`: 選択されたミッションに紐づくプロジェクトのみ表示
- `sortedMissions`: orderフィールドまたはcreatedAtでソート
- `sortedFilteredProjects`: orderフィールドまたはcreatedAtでソート

#### 型定義更新
- `frontend/src/types/index.ts`
  - `Project`インターフェースに`order`, `createdAt`, `updatedAt`を追加
  - `Mission`インターフェースに`order`を追加

## 使用方法

### マイグレーション実行
```bash
cd backend
npx prisma migrate dev --name add_project_mission_order
```

### 順番入れ替え
1. プロジェクト/ミッション/タスク一覧ページで「個人」モードに切り替え
2. 各アイテムの右上に表示される上下矢印ボタンをクリック
3. 上矢印: 1つ上に移動
4. 下矢印: 1つ下に移動

### TaskModalでのフィルタリング
1. タスク追加/編集モーダルを開く
2. ミッションを選択
3. プロジェクトドロップダウンには、選択したミッションに紐づくプロジェクトのみが表示される
4. ミッションとプロジェクトは登録順（古い順）で表示される

## 制約事項

1. デフォルトミッション（協力隊業務・役場業務）は順番変更不可
2. 順番入れ替えは同じユーザー/ミッション内でのみ可能
3. 順番入れ替えボタンは「個人」モード（viewMode === 'create'）でのみ表示

## 技術的な詳細

### 順番入れ替えのロジック
1. 現在のアイテムと隣接するアイテムを特定
2. トランザクション内で両方のorderフィールドを入れ替え
3. クエリキャッシュを無効化して一覧を再取得

### ソート順序
- 初期表示: `order`フィールドの昇順、次に`createdAt`の昇順
- `order`が同じ場合は登録順（古い順）で表示
- 新規作成時は最後に追加（最大order + 1）

## 関連ファイル

### バックエンド
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20260423000000_add_project_order/migration.sql`
- `backend/src/routes/projects.ts`
- `backend/src/routes/missions.ts`
- `backend/src/routes/tasks.ts`

### フロントエンド
- `frontend/src/pages/Projects.tsx`
- `frontend/src/pages/Goals.tsx`
- `frontend/src/pages/Tasks.tsx`
- `frontend/src/components/project/TaskModal.tsx`
- `frontend/src/types/index.ts`
