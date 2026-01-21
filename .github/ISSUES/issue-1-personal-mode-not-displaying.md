# [RESOLVED] 個人モードで追加したミッション・プロジェクト・タスクが表示されない

## 問題の概要
メンバー以外の役職（MASTER等）で「個人」モードから新規追加したミッション・プロジェクト・タスクが、追加直後に一覧に表示されない問題が発生しました。データは保存されており、ダッシュボードのウィジェットやスケジュールには反映されていました。

## エラーの詳細
- **発生箇所**: `frontend/src/pages/Goals.tsx`, `frontend/src/pages/Projects.tsx`, `frontend/src/pages/Tasks.tsx`
- **症状**: 
  - 「個人」モードで新規追加したデータが一覧に表示されない
  - データは保存されている（ウィジェットには表示される）
  - ページをリロードすると表示される

## 原因
1. `useQuery`の`enabled`条件が`!!user?.id || viewMode === 'view'`となっており、「個人」モード（`viewMode === 'create'`）で`user?.id`が存在しても、条件が満たされない場合があった
2. `viewMode === 'create'`のときに、一覧表示のコードが存在せず、空のメッセージのみが表示されていた

## 解決方法

### 1. `enabled`条件の修正
```typescript
// 修正前
enabled: !!user?.id || viewMode === 'view'

// 修正後
enabled: !!user?.id
```

### 2. `refetchOnMount`の追加
```typescript
refetchOnMount: true, // マウント時に再取得
refetchOnWindowFocus: false, // ウィンドウフォーカス時は再取得しない
```

### 3. `viewMode === 'create'`での一覧表示の追加
- `Goals.tsx`: 「個人」モードでもミッション一覧を表示するように修正
- `Projects.tsx`: 「個人」モードでもプロジェクト一覧を表示するように修正
- `Tasks.tsx`: 「個人」モードでもタスク一覧を表示するように修正

## 関連コミット
- `fix: メンバー以外の役職で個人モードから追加したデータが表示されない問題を修正`
- `fix: Goals.tsxのenabled条件を修正`
- `fix: 個人モードでミッション一覧が表示されるように修正`
- `fix: 個人モードでプロジェクト・タスク一覧が表示されるように修正`

## ラベル
`bug`, `frontend`, `react-query`, `resolved`

