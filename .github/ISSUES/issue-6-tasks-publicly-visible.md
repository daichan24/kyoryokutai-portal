# [RESOLVED] タスクが全員に公開されている

## 問題の概要
タスクが全メンバーに公開されてしまい、本来は自分のタスクのみ表示されるべきだった。

## エラーの詳細
- **発生箇所**: `frontend/src/pages/Tasks.tsx`
- **症状**: メンバーが他のメンバーのタスクも見えてしまう

## 原因
タスク取得時に`userId`フィルタが適用されていなかった

```typescript
// 問題のあったコード
const { data: allTasks = [], isLoading } = useQuery<Task[]>({
  queryKey: ['tasks', 'all'],
  queryFn: async () => {
    const response = await api.get('/api/missions');
    // userIdフィルタが適用されていない
  },
});
```

## 解決方法
メンバーの場合は、`userId`パラメータを追加して自分のタスクのみを取得するように修正

```typescript
// 修正後
const { data: allTasks = [], isLoading } = useQuery<Task[]>({
  queryKey: ['tasks', 'all', selectedUserId, user?.id, user?.role, viewMode],
  queryFn: async () => {
    // メンバーの場合は自分のタスクのみ取得
    if (user?.role === 'MEMBER') {
      // userIdフィルタを適用
      return tasks.filter((task) => task.userId === user.id);
    }
    // ...
  },
});
```

## 関連コミット
- `fix: タスクが全員に公開されている問題を修正`

## ラベル
`bug`, `frontend`, `security`, `data-filtering`, `resolved`

