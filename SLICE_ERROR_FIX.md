# sliceエラー修正

## 問題

`TypeError: t.slice is not a function`というエラーが発生していました。

## 原因

`slice`メソッドは配列または文字列に対してのみ使用できますが、以下の場合にエラーが発生していました：

1. **APIレスポンスが配列でない**: `response.data`が配列ではなく、オブジェクトや`undefined`の場合
2. **状態が配列でない**: `schedules`などの状態が配列でない場合に`slice`を呼び出している
3. **文字列が`undefined`**: `startTime`や`endTime`が`undefined`の場合に`slice`を呼び出している

## 実施した修正

### 1. 配列チェックの追加

すべての`slice`呼び出しの前に`Array.isArray`チェックを追加：

```typescript
// 修正前
{schedules.slice(0, 5).map(...)}

// 修正後
{Array.isArray(schedules) && schedules.slice(0, 5).map(...)}
```

### 2. APIレスポンスの配列チェック

APIレスポンスが配列であることを確認：

```typescript
const response = await api.get<Schedule[]>(`/api/schedules?${params}`);
const data = response.data;
// 配列であることを確認
setSchedules(Array.isArray(data) ? data : []);
```

### 3. 文字列の安全な処理

文字列の`slice`呼び出しを安全に：

```typescript
// 修正前
{schedule.startTime.slice(0, 5)}

// 修正後
{typeof schedule.startTime === 'string' ? schedule.startTime.slice(0, 5) : schedule.startTime}
```

## 修正したファイル

1. `frontend/src/pages/Dashboard.tsx`
   - `fetchThisWeekSchedules`: 配列チェックを追加
   - `schedules.slice(0, 5)`: `Array.isArray`チェックを追加

2. `frontend/src/components/schedule/PendingScheduleAlert.tsx`
   - `loadPendingSchedules`: 配列チェックを追加
   - `pendingSchedules.slice(0, 3)`: `Array.isArray`チェックを追加

3. `frontend/src/components/schedule/DraggableCalendar.tsx`
   - `getSchedulesForDay`: 配列チェックを追加
   - `startTime.slice`/`endTime.slice`: 型チェックを追加

4. `frontend/src/pages/Schedule.tsx`
   - APIレスポンスの配列チェックを追加

## デプロイ手順

1. **変更をコミット・プッシュ**
   ```bash
   git add .
   git commit -m "fix: Add array checks before using slice method"
   git push origin main
   ```

2. **Renderで再デプロイ**
   - フロントエンド: Manual Deploy > Deploy latest commit

3. **確認**
   - ブラウザでログイン
   - ダッシュボードが正常に表示されることを確認
   - コンソールエラーがないことを確認

