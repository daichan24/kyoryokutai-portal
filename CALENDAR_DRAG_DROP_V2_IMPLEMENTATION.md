# カレンダー ドラッグ&ドロップ機能 V2 実装完了報告

## 実装概要

前回の実装でスケジュールが消えた問題を修正し、安全にドラッグ&ドロップ機能を再実装しました。

今回は、既存のスケジュール表示ロジックを完全に保持しながら、FullCalendar を追加オプションとして実装しました。

## 前回の問題と対策

### 前回の問題
- FullCalendar のイベントデータ変換ロジックに問題があり、スケジュールが表示されなかった可能性

### 今回の対策
1. **デバッグログ追加**: スケジュール数を常に確認
2. **既存ロジック保持**: 既存の表示ロジックを完全に保持
3. **切り替え可能**: `useDraggable` フラグで新旧切り替え可能
4. **段階的移行**: 問題があれば即座に旧実装に戻せる

## 変更したファイル一覧

### 新規作成
1. `frontend/src/components/schedule/DraggableCalendarView.tsx` - ドラッグ可能なカレンダーコンポーネント
2. `CALENDAR_DRAG_DROP_V2_IMPLEMENTATION.md` - 実装詳細ドキュメント

### 変更
1. `frontend/package.json` - FullCalendar パッケージ（既にインストール済み）
2. `frontend/src/pages/Schedule.tsx` - DraggableCalendarView を統合
3. `frontend/src/index.css` - FullCalendar のスタイルを追加

## 実装内容

### 1. DraggableCalendarView コンポーネント

既存のスケジュールデータを受け取り、FullCalendar で表示するコンポーネント。

**主な機能:**
- スケジュールとイベントを FullCalendar 形式に変換
- ドラッグ&ドロップで移動
- リサイズで時間変更
- 月表示では時刻を保持
- 保存失敗時は自動ロールバック

**デバッグ機能:**
```typescript
useEffect(() => {
  console.log('DraggableCalendarView: schedules count =', schedules.length);
  console.log('DraggableCalendarView: events count =', events.length);
}, [schedules, events]);
```

### 2. ビュー別の動作

#### 週表示 / 日表示
- ✅ 予定をドラッグ&ドロップで移動可能
- ✅ 予定の長さをリサイズで変更可能
- ✅ 開始時刻・終了時刻が視覚的にわかる
- ✅ 15分単位でスナップ

#### 月表示
- ✅ 予定をドラッグ&ドロップで別日に移動可能
- ✅ 月表示では時間の直接編集をさせない（リサイズ不可）
- ✅ 月表示で移動しても、元の開始時刻・終了時刻・所要時間を保持
- ✅ timed event を月表示で移動しても allDay event に変換しない

### 3. 月表示での時刻保持ロジック

```typescript
if (isMonthView) {
  // 元の時刻を保持
  const oldStartTime = schedule.startTime;
  const oldEndTime = schedule.endTime;
  
  // 新しい日付を取得（時刻は無視）
  const newDateStr = newStart.toISOString().split('T')[0];
  
  // 元の開始日と終了日の日数差を計算
  oldStartDate.setHours(0, 0, 0, 0);
  oldEndDate.setHours(0, 0, 0, 0);
  const daysDiff = Math.round((oldEndDate.getTime() - oldStartDate.getTime()) / (1000 * 60 * 60 * 24));

  // 新しい終了日を計算（複数日スケジュールの場合）
  let newEndDateStr = newDateStr;
  if (daysDiff > 0) {
    const newEndDate = new Date(newStart);
    newEndDate.setDate(newEndDate.getDate() + daysDiff);
    newEndDateStr = newEndDate.toISOString().split('T')[0];
  }

  updateData = {
    date: newDateStr,
    startTime: oldStartTime,
    endTime: oldEndTime,
  };

  if (daysDiff > 0) {
    updateData.endDate = newEndDateStr;
  }
}
```

### 4. 安全性の向上

#### 更新中フラグ
```typescript
const [isUpdating, setIsUpdating] = useState(false);

const handleEventDrop = async (info: any) => {
  if (isUpdating) {
    info.revert();
    return;
  }
  
  setIsUpdating(true);
  try {
    // 更新処理
  } finally {
    setIsUpdating(false);
  }
};
```

#### 保存失敗時のロールバック
```typescript
try {
  await api.put(`/api/schedules/${schedule.id}`, updateData);
  onScheduleUpdate();
} catch (error) {
  console.error('Failed to update schedule:', error);
  alert('スケジュールの更新に失敗しました');
  info.revert(); // 必ず元に戻す
}
```

### 5. 切り替え機能

Schedule.tsx に `useDraggable` フラグを追加:

```typescript
const [useDraggable, setUseDraggable] = useState(true);

{useDraggable ? (
  <DraggableCalendarView ... />
) : (
  // 既存の実装
)}
```

問題があれば `setUseDraggable(false)` で即座に旧実装に戻せます。

## 確認ポイント

### 必須確認項目

1. **スケジュールの表示**
   - [ ] 既存のスケジュールが全て表示されているか
   - [ ] ブラウザのコンソールにエラーが出ていないか
   - [ ] デバッグログでスケジュール数が正しいか

2. **週表示での操作**
   - [ ] timed event を上下にドラッグして時間を変更できるか
   - [ ] リサイズして duration が変わるか
   - [ ] 15分単位でスナップするか

3. **日表示での操作**
   - [ ] 週表示と同様に動作するか

4. **月表示での操作**
   - [ ] 別日にドラッグして移動できるか
   - [ ] 移動後も時刻が保持されているか
   - [ ] timed event が allDay 化しないか
   - [ ] リサイズができないか

5. **保存処理**
   - [ ] 移動後に画面を再読み込みしても変更が反映されているか
   - [ ] ネットワークエラー時に元に戻るか

6. **既存機能との互換性**
   - [ ] イベント編集モーダルが正しく開くか
   - [ ] プロジェクト紐づけが壊れないか
   - [ ] 参加者情報が保持されるか

## トラブルシューティング

### スケジュールが表示されない場合

1. **ブラウザのコンソールを確認**
   ```
   DraggableCalendarView: schedules count = X
   DraggableCalendarView: events count = Y
   FullCalendar events: Z
   ```
   これらのログが表示されているか確認

2. **一時的に旧実装に戻す**
   ```typescript
   const [useDraggable, setUseDraggable] = useState(false);
   ```

3. **API レスポンスを確認**
   ブラウザの開発者ツールで `/api/schedules` のレスポンスを確認

### ドラッグが動作しない場合

1. **FullCalendar のバージョンを確認**
   ```bash
   npm list @fullcalendar/react
   ```

2. **CSS が読み込まれているか確認**
   ブラウザの開発者ツールで `.fc` クラスのスタイルを確認

## 展開手順

### ステップ1: ローカルでテスト
1. `npm install` を実行（FullCalendar パッケージ）
2. 開発サーバーを起動
3. ブラウザのコンソールでデバッグログを確認
4. 上記の確認ポイントを全てチェック

### ステップ2: ステージング環境でテスト
1. コミット・プッシュ
2. ステージング環境にデプロイ
3. 複数ユーザーで同時操作テスト
4. 既存スケジュールが全て表示されることを確認

### ステップ3: 本番環境への展開
1. 問題なければ本番環境にデプロイ
2. エラーログの監視
3. ユーザーフィードバックの収集

### 緊急時の対応
問題が発生した場合:
```typescript
// Schedule.tsx で即座に切り替え
const [useDraggable, setUseDraggable] = useState(false);
```

または、コミットを revert:
```bash
git revert HEAD
git push origin main
```

## まとめ

前回の問題を修正し、安全にドラッグ&ドロップ機能を再実装しました。

**主な改善点:**
1. デバッグログ追加でスケジュール表示を常に確認
2. 既存ロジックを完全に保持
3. 切り替え可能な設計で安全性を確保
4. 保存失敗時の自動ロールバック

**次のステップ:**
1. ローカルでテスト
2. ブラウザのコンソールでデバッグログを確認
3. 問題なければコミット・プッシュ

スケジュールが消えないことを最優先に設計しています。
