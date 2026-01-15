# UI/UX再設計 実装サマリー

## 実装完了項目

### ✅ 1. サイドバー構成の再設計

**変更内容:**
- 「方向性」カテゴリを追加（Mission）
- 「進行中の取り組み」カテゴリを追加（Project, Task）
- 「大目標・中目標・小目標」という直接表現を削除

**実装ファイル:**
- `frontend/src/components/layout/Sidebar.tsx`

### ✅ 2. Task一覧画面の作成

**実装内容:**
- 独立したTask一覧ページを作成（`/tasks`）
- ProjectとMissionのbreadcrumb表示
- タスク一覧から直接編集・完了・削除が可能
- スケジュール連携ボタンを配置

**実装ファイル:**
- `frontend/src/pages/Tasks.tsx`
- `frontend/src/App.tsx`（ルート追加）

**機能:**
- フィルタ: 状態（未着手/進行中/完了）、プロジェクト
- ソート: 期限順、状態順、プロジェクト順、作成日順
- 各タスクカードに操作ボタン（編集、削除、完了、スケジュール連携）

### ✅ 3. Project一覧画面の改善

**変更内容:**
- 関連Mission名を表示（「方向性:」ラベル付き）
- 紐づくTask数を表示（完了数/進行中数も表示）
- 視覚的な改善

**実装ファイル:**
- `frontend/src/pages/Projects.tsx`

## 未実装項目（スキーマ変更が必要）

### ⚠️ スキーマ変更が必要な理由

現在のスキーマでは、TaskがMission配下にあり、Projectは任意で紐づいています。これにより：

1. **Task一覧ページの実装が複雑**: Project経由でTaskを取得する必要がある
2. **要件との不一致**: 要件では「Task は Project に必須で紐づく、Mission と Task は直接紐づけない」
3. **パフォーマンスの問題**: Task一覧を取得する際に、全Projectを取得してからTaskを集約する必要がある

### 提案するスキーマ変更

詳細は `SCHEMA_CHANGE_PROPOSAL.md` を参照してください。

**主な変更:**
- Taskの`missionId`を削除
- Taskの`projectId`を必須にする
- APIを`/api/projects/:projectId/tasks`に変更

## 現在の制限事項

1. **Task一覧ページ**: 現在はProject経由でTaskを取得しているため、パフォーマンスが劣る可能性がある
2. **Task作成**: 現在のAPI構造では、Task作成時に`missionId`が必要（暫定的に`projectId`を使用）
3. **Task削除**: 現在のAPI構造では、Task削除時に`missionId`が必要

## 次のステップ

1. **スキーマ変更の実装**（推奨）
   - `SCHEMA_CHANGE_PROPOSAL.md`に従ってスキーマを修正
   - マイグレーションを作成・適用
   - APIを修正

2. **UIトーンの調整**
   - Taskカードをより強調（背景色、ボーダー、フォント）
   - Mission表示をより控えめに（薄い色、小さめの表示）

3. **ソート・フィルタ機能の拡張**
   - Project一覧にもソート・フィルタを追加
   - 期限範囲でのフィルタリング

4. **スケジュール連携機能**
   - Task一覧からスケジュールに追加する機能を実装

## 実装ファイル一覧

### 新規作成
- `frontend/src/pages/Tasks.tsx` - Task一覧ページ
- `UI_REDESIGN_PROPOSAL.md` - UI再設計提案
- `SCHEMA_CHANGE_PROPOSAL.md` - スキーマ変更提案

### 修正
- `frontend/src/components/layout/Sidebar.tsx` - サイドバー再設計
- `frontend/src/pages/Projects.tsx` - Project一覧改善
- `frontend/src/App.tsx` - Task一覧ルート追加

