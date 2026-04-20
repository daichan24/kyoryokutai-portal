# タイムゾーン問題の根本原因と修正

## 問題の本質

スケジュールのドラッグ&ドロップで9時間ずれる問題は、**フロントエンドとバックエンドの両方**にタイムゾーン処理の問題がありました。

### 問題1: バックエンドの日付変換（最も重要）

```typescript
// ❌ 問題のあるコード
const startDate = new Date(data.date); // "2024-04-20" → UTC 2024-04-20 00:00:00

// ✅ 修正後
const startDate = new Date(`${data.date}T12:00:00+09:00`); // JST 2024-04-20 12:00:00
```

**なぜ問題だったか:**
- フロントエンドから `"2024-04-20"` という文字列が送られる
- `new Date("2024-04-20")` は **UTC の 2024-04-20 00:00:00** として解釈される
- データベースに保存される際、Prismaが日本時間として扱うため、9時間のずれが発生
- 結果: 2024-04-19 15:00:00 JST として保存される（前日になる）

**修正方法:**
- `T12:00:00+09:00` を付加することで、明示的に JST の正午として解釈
- これにより、日付のずれを防ぐ

### 問題2: フロントエンドの時刻取得

```typescript
// ❌ 以前の試み（toLocaleString）
const jstTimeStr = date.toLocaleString('ja-JP', { 
  timeZone: 'Asia/Tokyo',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
});

// ✅ 正しい方法
const hours = String(date.getHours()).padStart(2, '0');
const minutes = String(date.getMinutes()).padStart(2, '0');
const timeStr = `${hours}:${minutes}`;
```

**なぜ `toLocaleString` がダメだったか:**
- FullCalendar は `timeZone: 'Asia/Tokyo'` を設定している
- これにより、FullCalendar から返される Date オブジェクトは**既に JST として解釈されている**
- `date.getHours()` などは既に JST の値を返している
- `toLocaleString` で再度タイムゾーン変換すると、二重変換になる可能性がある

## 修正内容

### 1. バックエンド: `backend/src/routes/schedules.ts`

#### POST エンドポイント（新規作成）
```typescript
// 修正前
const startDate = new Date(data.date);
const endDate = data.endDate ? new Date(data.endDate) : startDate;

// 修正後
const startDate = new Date(`${data.date}T12:00:00+09:00`);
const endDate = data.endDate 
  ? new Date(`${data.endDate}T12:00:00+09:00`) 
  : startDate;
```

#### PUT エンドポイント（更新）
```typescript
// 修正前
if (data.date) {
  const startDate = new Date(data.date);
  const endDate = dataWithEndDate.endDate ? new Date(dataWithEndDate.endDate) : startDate;
  // ...
}

// 修正後
if (data.date) {
  const startDate = new Date(`${data.date}T12:00:00+09:00`);
  const endDate = dataWithEndDate.endDate 
    ? new Date(`${dataWithEndDate.endDate}T12:00:00+09:00`) 
    : startDate;
  // ...
}
```

### 2. フロントエンド: `frontend/src/components/schedule/DraggableCalendarView.tsx`

#### ヘルパー関数の修正
```typescript
// 修正前（toLocaleString を使用）
const getJSTDateString = (date: Date): string => {
  const jstDateStr = date.toLocaleString('ja-JP', { 
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const [year, month, day] = jstDateStr.split('/');
  return `${year}-${month}-${day}`;
};

// 修正後（直接取得）
const getJSTDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
```

## 技術的な背景

### ISO 8601 日付文字列の解釈

JavaScriptの `new Date()` は、文字列の形式によって解釈が異なります:

```typescript
// UTC として解釈される
new Date("2024-04-20")           // → UTC 2024-04-20 00:00:00
new Date("2024-04-20T10:00:00")  // → UTC 2024-04-20 10:00:00

// タイムゾーン付きで解釈される
new Date("2024-04-20T10:00:00+09:00")  // → JST 2024-04-20 10:00:00
new Date("2024-04-20T12:00:00+09:00")  // → JST 2024-04-20 12:00:00
```

### なぜ正午（12:00）を使うのか

- 日付のみを扱う場合、時刻は重要ではない
- しかし、タイムゾーン変換で日付が変わるのを防ぐため、正午を使用
- 正午なら、どのタイムゾーンに変換しても日付が変わらない

例:
```
JST 2024-04-20 12:00:00 → UTC 2024-04-20 03:00:00 （同じ日）
JST 2024-04-20 00:00:00 → UTC 2024-04-19 15:00:00 （前日になる！）
```

### FullCalendar のタイムゾーン設定

```typescript
<FullCalendar
  timeZone="Asia/Tokyo"  // この設定により、内部の Date は JST として扱われる
  // ...
/>
```

この設定により:
- `event.start`, `event.end`, `info.date` などは JST として解釈される
- `date.getHours()`, `date.getMinutes()` は JST の値を返す
- 追加のタイムゾーン変換は不要（むしろ有害）

## デプロイ手順

1. **コードの確認**
   ```bash
   # フロントエンドの変更を確認
   git diff frontend/src/components/schedule/DraggableCalendarView.tsx
   
   # バックエンドの変更を確認
   git diff backend/src/routes/schedules.ts
   ```

2. **コミット**
   ```bash
   git add frontend/src/components/schedule/DraggableCalendarView.tsx
   git add backend/src/routes/schedules.ts
   git commit -m "fix: タイムゾーン問題の根本修正（バックエンド+フロントエンド）"
   ```

3. **プッシュ**
   ```bash
   git push origin main
   ```

4. **Render でのデプロイ確認**
   - Render のダッシュボードで自動デプロイを確認
   - デプロイログでエラーがないか確認

5. **本番環境での確認**
   - ブラウザでハードリロード（Cmd+Shift+R / Ctrl+Shift+R）
   - 週表示または日表示でスケジュールをドラッグ
   - 移動先の時刻に正確に配置されることを確認
   - ブラウザのコンソールでログを確認

## テスト項目

### 1. ドラッグ&ドロップ
- [ ] 17:00 のスケジュールを 18:00 に移動 → 18:00 に保存される
- [ ] 10:00 のスケジュールを 11:00 に移動 → 11:00 に保存される
- [ ] 日をまたぐ移動（月曜 10:00 → 火曜 14:00）

### 2. リサイズ
- [ ] 開始時刻を変更（17:00-18:00 → 16:00-18:00）
- [ ] 終了時刻を変更（17:00-18:00 → 17:00-19:00）

### 3. 新規作成
- [ ] 週表示で時間枠をクリック → 正しい時刻でモーダルが開く
- [ ] 日表示で時間枠をクリック → 正しい時刻でモーダルが開く

### 4. 月表示
- [ ] 別の日にドラッグ → 時刻が保持される
- [ ] 複数日スケジュールの移動 → 日数が保持される

## まとめ

今回の修正により:
1. **バックエンド**: 日付文字列を JST として明示的に解釈
2. **フロントエンド**: FullCalendar の Date を直接使用（二重変換を回避）

これで、ドラッグ&ドロップ時に正確な時刻で保存されるようになります。

## 修正日時
2026年4月20日
