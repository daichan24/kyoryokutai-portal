# スケジュールドラッグ&ドロップ 9時間ずれ問題の修正

## 問題の概要
スケジュールの週/日表示でタスクをドラッグアンドドロップすると、置いた場所から9時間後の時間にスライドしてしまう問題が発生していました。

## 原因
日本時間(JST)とUTC間の時差が9時間であることから、タイムゾーン変換の問題と特定しました。

具体的には:
1. `Date.getHours()` と `Date.getMinutes()` はブラウザのローカルタイムゾーンの時刻を返す
2. FullCalendarの `timeZone: 'Asia/Tokyo'` 設定があっても、JavaScriptの `Date` オブジェクトは常にローカルタイムゾーンで動作する
3. ドラッグ&ドロップ時に取得される `event.start` は、FullCalendarが内部的にUTCで管理している時刻をローカルタイムゾーンに変換したもの

## 修正内容

### 1. `getJSTDateString` 関数の修正
```typescript
// 修正前
const getJSTDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 修正後
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
```

### 2. `getJSTTimeString` 関数の修正
```typescript
// 修正前
const getJSTTimeString = (date: Date): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

// 修正後
const getJSTTimeString = (date: Date): string => {
  const jstTimeStr = date.toLocaleString('ja-JP', { 
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
  return jstTimeStr;
};
```

### 3. ドラッグ&ドロップ処理の修正
終了時刻の計算を、ローカルタイムゾーンの `getHours()` / `getMinutes()` ではなく、JST変換後の時刻文字列から計算するように変更:

```typescript
// 修正前
const newStartMinutes = newStart.getHours() * 60 + newStart.getMinutes();

// 修正後
const [startHours, startMinutes] = newStartTime.split(':').map(Number);
const newStartMinutes = startHours * 60 + startMinutes;
```

### 4. リサイズ処理の修正
else節でも `getJSTTimeString` を使用するように統一:

```typescript
// 修正前
startTime = `${String(newStart.getHours()).padStart(2, '0')}:${String(newStart.getMinutes()).padStart(2, '0')}`;

// 修正後
startTime = getJSTTimeString(newStart);
```

## 技術的な説明

`toLocaleString()` メソッドに `timeZone: 'Asia/Tokyo'` オプションを指定することで:
- ブラウザがどのタイムゾーンで動作していても
- Date オブジェクトが内部的にどのタイムゾーンで保持されていても
- 常に日本時間(JST)での日付・時刻文字列を取得できる

これにより、FullCalendarから返される Date オブジェクトを正確にJSTとして解釈し、データベースに保存できるようになりました。

## 影響範囲
- ドラッグ&ドロップによるスケジュール移動
- リサイズによる時刻変更
- 日付クリックによる新規作成（週/日表示）

すべての操作で正確な日本時間が使用されるようになりました。

## テスト方法
1. スケジュール画面を週表示または日表示で開く
2. タスクをドラッグして別の時間帯に移動
3. 移動先の時刻に正確に配置されることを確認
4. タスクの上下端をドラッグしてリサイズ
5. リサイズした時刻に正確に変更されることを確認

## 修正日時
2026年4月20日
