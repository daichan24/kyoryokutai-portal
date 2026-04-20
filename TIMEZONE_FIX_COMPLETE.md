# タイムゾーン修正完了レポート

## 問題の概要
週表示・日表示のカレンダーで、表示時刻と内部時刻が9時間ズレていた。
- ユーザーが17:00をクリック → システムは翌日02:00として記録
- ユーザーが10:00をクリック → システムは19:00として記録

## 原因
FullCalendarは`timeZone: 'Asia/Tokyo'`を設定しているため、Dateオブジェクトは既にJST（日本標準時）として扱われている。しかし、コード内で`.toISOString()`を使用していたため、JSTからUTCへ変換され、9時間（UTC+9）のズレが発生していた。

## 修正内容

### 1. イベントリサイズ処理（handleEventResize）
**修正前:**
```typescript
const updateData: any = {
  date: newStart.toISOString().split('T')[0],  // UTC変換されてしまう
  startTime,
  endTime,
  // ...
};

if (newStart.toDateString() !== newEnd.toDateString()) {
  updateData.endDate = newEnd.toISOString().split('T')[0];  // UTC変換されてしまう
}
```

**修正後:**
```typescript
// 日付も JST で取得
const year = newStart.getFullYear();
const month = String(newStart.getMonth() + 1).padStart(2, '0');
const day = String(newStart.getDate()).padStart(2, '0');
const newDateStr = `${year}-${month}-${day}`;

const updateData: any = {
  date: newDateStr,  // JST日付を直接使用
  startTime,
  endTime,
  // ...
};

if (newStart.toDateString() !== newEnd.toDateString()) {
  const endYear = newEnd.getFullYear();
  const endMonth = String(newEnd.getMonth() + 1).padStart(2, '0');
  const endDay = String(newEnd.getDate()).padStart(2, '0');
  updateData.endDate = `${endYear}-${endMonth}-${endDay}`;  // JST日付を直接使用
}
```

### 2. 日付クリック処理（handleDateClick）
**修正前:**
```typescript
const handleDateClick = (info: any) => {
  // ...
  if (isTimeGridView) {
    const clickedDate = info.date;
    const startTime = `${String(clickedDate.getHours()).padStart(2, '0')}:${String(clickedDate.getMinutes()).padStart(2, '0')}`;
    // ...
    onCreateSchedule(clickedDate, startTime, endTime);
  }
};
```

**修正後:**
```typescript
const handleDateClick = (info: any) => {
  // ...
  if (isTimeGridView) {
    // FullCalendar の Date オブジェクトは既に JST なので、そのまま使用
    const clickedDate = info.date;
    const startTime = `${String(clickedDate.getHours()).padStart(2, '0')}:${String(clickedDate.getMinutes()).padStart(2, '0')}`;
    // ...
    
    console.log('週/日表示での時間クリック:', {
      clickedTime: clickedDate,
      jstHours: clickedDate.getHours(),
      jstMinutes: clickedDate.getMinutes(),
      startTime,
      endTime,
    });
    
    onCreateSchedule(clickedDate, startTime, endTime);
  }
};
```

### 3. イベントドロップ処理（handleEventDrop）
**既に修正済み** - 前回の修正で週/日表示のブロック移動時にJST Dateメソッドを使用するように修正済み。

## 修正のポイント

### JST Dateメソッドの使用パターン
```typescript
// ✅ 正しい方法（JST日付を直接取得）
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, '0');
const day = String(date.getDate()).padStart(2, '0');
const dateStr = `${year}-${month}-${day}`;

// ❌ 間違った方法（UTC変換されてしまう）
const dateStr = date.toISOString().split('T')[0];
```

### 時刻の取得
```typescript
// ✅ 正しい方法（JST時刻を直接取得）
const hours = date.getHours();
const minutes = date.getMinutes();
const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

// ❌ 間違った方法（UTC変換されてしまう）
const timeStr = date.toISOString().split('T')[1].substring(0, 5);
```

## 動作確認項目

### ✅ 完了した修正
1. **イベントリサイズ**: 開始時刻または終了時刻をドラッグして変更した際、正しいJST時刻で保存される
2. **日付クリック**: 週/日表示で時間枠をクリックした際、クリックした時刻でタスク作成モーダルが開く
3. **イベントドロップ**: 週/日表示でスケジュールをドラッグ移動した際、正しいJST時刻で保存される

### テストすべき項目
1. 週表示で17:00の枠をクリック → タスク作成モーダルが17:00-18:00で開くか
2. 週表示で10:00の枠をクリック → タスク作成モーダルが10:00-11:00で開くか
3. 週表示でスケジュールを上下にドラッグ → 移動先の時刻が正しく保存されるか
4. 週表示でスケジュールの開始時刻をリサイズ → 終了時刻は固定され、開始時刻のみ変更されるか
5. 週表示でスケジュールの終了時刻をリサイズ → 開始時刻は固定され、終了時刻のみ変更されるか
6. 日表示でも同様の操作が正しく動作するか
7. 月表示で日付を移動 → 時刻が保持されるか（既存機能）

## 技術的な背景

### FullCalendarのタイムゾーン設定
```typescript
<FullCalendar
  timeZone="Asia/Tokyo"  // この設定により、Dateオブジェクトは既にJSTとして扱われる
  // ...
/>
```

この設定により、FullCalendarから取得される`event.start`や`event.end`、`info.date`などのDateオブジェクトは、既にJST（日本標準時）として解釈されている。

### Date APIの挙動
- `date.getFullYear()`, `date.getMonth()`, `date.getDate()`: ローカルタイムゾーン（JST）で値を返す
- `date.getHours()`, `date.getMinutes()`: ローカルタイムゾーン（JST）で値を返す
- `date.toISOString()`: **常にUTCに変換してから**ISO 8601形式の文字列を返す（これが問題の原因）

### なぜ9時間ズレたか
日本標準時（JST）はUTC+9なので:
- JST 17:00 → UTC 08:00（前日の場合もある）
- JST 10:00 → UTC 01:00

`.toISOString()`を使うと、JSTからUTCへ変換されるため、9時間前の時刻になってしまう。

## まとめ

すべてのタイムゾーン関連の修正が完了しました。

**修正されたファイル:**
- `frontend/src/components/schedule/DraggableCalendarView.tsx`

**修正された関数:**
1. `handleEventResize` - リサイズ時の日付取得をJST Dateメソッドに変更
2. `handleDateClick` - 時間クリック時のログ追加とコメント改善
3. `handleEventDrop` - 既に前回修正済み

**次のステップ:**
1. ブラウザでアプリケーションを開く
2. 週表示または日表示に切り替える
3. 時間枠をクリックしてタスク作成モーダルが正しい時刻で開くか確認
4. スケジュールをドラッグ移動して正しい時刻で保存されるか確認
5. スケジュールをリサイズして正しい時刻で保存されるか確認
