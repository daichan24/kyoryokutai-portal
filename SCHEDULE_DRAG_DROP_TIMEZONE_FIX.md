# スケジュールドラッグ&ドロップ タイムゾーン修正

## 問題の概要
カレンダーの週/日表示で、スケジュールをドラッグして時間を移動させると、時間が9時間後ろにズレる問題が発生していました。

例:
- 17:00のスケジュールを18:00に移動 → 実際には09:00に保存される
- 10:00のスケジュールを11:00に移動 → 実際には02:00に保存される

## 原因
FullCalendarは`timeZone: 'Asia/Tokyo'`を設定しているため、内部のDateオブジェクトはJST（日本標準時）として扱われます。しかし、コード内で`.toISOString()`メソッドを使用していたため、JSTからUTCへ変換され、9時間（UTC+9）のズレが発生していました。

## 修正内容

### 1. イベントデータ変換（スケジュール）
**修正前:**
```typescript
const startDate = schedule.startDate 
  ? (typeof schedule.startDate === 'string' ? schedule.startDate.split('T')[0] : new Date(schedule.startDate).toISOString().split('T')[0])
  : (typeof schedule.date === 'string' ? schedule.date.split('T')[0] : new Date(schedule.date).toISOString().split('T')[0]);
```

**修正後:**
```typescript
let startDate: string;
if (schedule.startDate) {
  if (typeof schedule.startDate === 'string') {
    startDate = schedule.startDate.split('T')[0];
  } else {
    const d = new Date(schedule.startDate);
    startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
} else {
  if (typeof schedule.date === 'string') {
    startDate = schedule.date.split('T')[0];
  } else {
    const d = new Date(schedule.date);
    startDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
```

### 2. イベントデータ変換（町の行事など）
**修正前:**
```typescript
const dateStr = typeof event.date === 'string' ? event.date.split('T')[0] : new Date(event.date).toISOString().split('T')[0];
```

**修正後:**
```typescript
let dateStr: string;
if (typeof event.date === 'string') {
  dateStr = event.date.split('T')[0];
} else {
  const d = new Date(event.date);
  dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
```

### 3. 月表示での日付取得
**修正前:**
```typescript
const newDateStr = newStart.toISOString().split('T')[0];
```

**修正後:**
```typescript
const year = newStart.getFullYear();
const month = String(newStart.getMonth() + 1).padStart(2, '0');
const day = String(newStart.getDate()).padStart(2, '0');
const newDateStr = `${year}-${month}-${day}`;
```

### 4. 月表示での終了日計算
**修正前:**
```typescript
if (daysDiff > 0) {
  const newEndDate = new Date(newStart);
  newEndDate.setDate(newEndDate.getDate() + daysDiff);
  newEndDateStr = newEndDate.toISOString().split('T')[0];
}
```

**修正後:**
```typescript
if (daysDiff > 0) {
  const newEndDate = new Date(newStart);
  newEndDate.setDate(newEndDate.getDate() + daysDiff);
  const endYear = newEndDate.getFullYear();
  const endMonth = String(newEndDate.getMonth() + 1).padStart(2, '0');
  const endDay = String(newEndDate.getDate()).padStart(2, '0');
  newEndDateStr = `${endYear}-${endMonth}-${endDay}`;
}
```

### 5. デバッグログの追加
週/日表示でのドラッグ時に、より詳細なログを追加しました:

```typescript
console.log('週/日表示でのブロック移動:', {
  scheduleId: schedule.id,
  oldDate: schedule.date,
  newDate: newDateStr,
  oldStartTime: schedule.startTime,
  newStartTime,
  oldEndTime: schedule.endTime,
  newEndTime,
  duration: `${duration}分`,
  jstHours,
  jstMinutes,
  rawDateObject: newStart.toString(),
  updateData,
});
```

## 修正のポイント

### JST日付取得の正しい方法
```typescript
// ✅ 正しい方法（JST日付を直接取得）
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, '0');
const day = String(date.getDate()).padStart(2, '0');
const dateStr = `${year}-${month}-${day}`;

// ❌ 間違った方法（UTC変換されてしまう）
const dateStr = date.toISOString().split('T')[0];
```

### なぜ9時間ズレたか
日本標準時（JST）はUTC+9なので:
- JST 17:00 → UTC 08:00
- JST 10:00 → UTC 01:00

`.toISOString()`を使うと、JSTからUTCへ変換されるため、9時間前の時刻になってしまいます。

## 動作確認項目

### 週/日表示
1. スケジュールを上下にドラッグして時間を変更
2. 移動先の時刻が正しく保存されるか確認
3. ブラウザのコンソールでログを確認

### 月表示
1. スケジュールを別の日にドラッグ
2. 移動後も時刻が保持されているか確認
3. 複数日スケジュールの場合、日数が保持されているか確認

### 確認方法
1. ブラウザでアプリケーションを開く
2. スケジュールページに移動
3. 週表示または日表示に切り替え
4. スケジュールをドラッグして時間を変更
5. ページを再読み込みして、変更が正しく保存されているか確認
6. ブラウザのコンソールでログを確認

## 修正されたファイル
- `frontend/src/components/schedule/DraggableCalendarView.tsx`

## 技術的な背景

### FullCalendarのタイムゾーン設定
```typescript
<FullCalendar
  timeZone="Asia/Tokyo"  // この設定により、Dateオブジェクトは既にJSTとして扱われる
  // ...
/>
```

### Date APIの挙動
- `date.getFullYear()`, `date.getMonth()`, `date.getDate()`: ローカルタイムゾーン（JST）で値を返す
- `date.getHours()`, `date.getMinutes()`: ローカルタイムゾーン（JST）で値を返す
- `date.toISOString()`: **常にUTCに変換してから**ISO 8601形式の文字列を返す（これが問題の原因）

## まとめ

すべての`.toISOString()`の使用箇所を、JST Dateメソッド（`getFullYear()`, `getMonth()`, `getDate()`）を使った日付取得に変更しました。これにより、カレンダーのドラッグ&ドロップ時に正しいJST時刻で保存されるようになります。
