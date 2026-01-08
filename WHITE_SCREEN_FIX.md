# 白画面問題の修正

## 問題の原因

ログイン後にダッシュボードが一瞬表示された後、真っ白の画面になる問題は、以下の原因が考えられます：

1. **APIレスポンスの処理エラー**: `api.get`が`AxiosResponse`を返すのに、`.data`を取得していなかった
2. **エラーハンドリングの不足**: エラーが発生した場合に適切に処理されていなかった
3. **存在しないプロパティへのアクセス**: `schedule.user?.avatarColor`などが`undefined`の場合の処理が不十分

## 実施した修正

### 1. APIレスポンスの修正

すべての`api.get`呼び出しで`.data`を取得するように修正：

- `Dashboard.tsx`
- `NotificationBell.tsx`
- `ScheduleSuggestionNotification.tsx`
- `Settings/Locations.tsx`
- `Settings/Users.tsx`
- `WeeklyReport.tsx`
- `PendingScheduleAlert.tsx`
- `ScheduleModal.tsx`

### 2. エラーハンドリングの改善

エラーが発生した場合に空配列を設定するように修正：

```typescript
try {
  const response = await api.get<Type[]>('/api/endpoint');
  setData(response.data || []);
} catch (error) {
  console.error('Failed to fetch:', error);
  setData([]); // エラー時は空配列を設定
}
```

### 3. エラーバウンダリの追加

`ErrorBoundary`コンポーネントを追加して、予期しないエラーが発生した場合に白画面ではなくエラーメッセージを表示：

- `frontend/src/components/ErrorBoundary.tsx`を新規作成
- `frontend/src/main.tsx`で`ErrorBoundary`でアプリをラップ

### 4. 安全なプロパティアクセス

`schedule.user?.avatarColor`などが`undefined`の場合のデフォルト値を設定：

```typescript
style={{ backgroundColor: schedule.user?.avatarColor || '#6B7280' }}
{schedule.user?.name?.charAt(0) || '?'}
```

## デプロイ手順

1. **変更をコミット・プッシュ**
   ```bash
   git add .
   git commit -m "fix: Fix white screen issue by correcting API response handling"
   git push origin main
   ```

2. **Renderで再デプロイ**
   - フロントエンド: Manual Deploy > Deploy latest commit

3. **確認**
   - ブラウザでログイン
   - ダッシュボードが正常に表示されることを確認
   - DevToolsのConsoleタブでエラーがないことを確認

## トラブルシューティング

### まだ白画面が表示される場合

1. **ブラウザのコンソールを確認**
   - DevTools → Consoleタブ
   - エラーメッセージを確認

2. **Networkタブを確認**
   - DevTools → Networkタブ
   - APIリクエストが成功しているか確認
   - レスポンスの内容を確認

3. **エラーバウンダリが表示される場合**
   - エラーメッセージの詳細を確認
   - エラーの原因を特定して修正

### よくあるエラー

- **`Cannot read property 'data' of undefined`**: APIレスポンスが`undefined`の場合
  - 解決策: `response?.data || []`のようにオプショナルチェーンを使用

- **`TypeError: Cannot read property 'user' of undefined`**: `schedule.user`が`undefined`の場合
  - 解決策: `schedule.user?.name`のようにオプショナルチェーンを使用

- **`@/components/ui/*`が見つからない**: UIコンポーネントが存在しない
  - 解決策: これらのコンポーネントを使用している箇所を確認し、代替コンポーネントを使用するか、コンポーネントを作成

