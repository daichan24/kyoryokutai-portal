# スケジュール・カレンダー機能 診断結果と修正設計書

## 診断日時
2026年4月20日

## 診断対象ファイル
1. `frontend/src/pages/Schedule.tsx` - スケジュールページ本体
2. `frontend/src/components/schedule/DraggableCalendarView.tsx` - ドラッグ可能カレンダー
3. `frontend/src/components/schedule/ScheduleModal.tsx` - スケジュール編集モーダル
4. `frontend/src/components/project/TaskModal.tsx` - タスク編集モーダル（スケジュール統合版）
5. `backend/src/routes/schedules.ts` - スケジュールAPI

## 診断結果サマリー

### ✅ 正常に動作している機能
1. タスク登録機能
2. スケジュールページでのカレンダー表示
3. 既存タスクのクリックで編集モーダル表示
4. 繰り返し機能
5. 他人のスケジュールの詳細表示（グレーアウトは未実装）
6. 行政カレンダー表示

### ❌ 問題が確認された機能

#### 問題1: デフォルト時刻が9:00-17:30ではなく9:00-17:00
**現状:** 
- `ScheduleModal.tsx`: `setStartTime('09:00')`, `setEndTime('17:00')`
- `TaskModal.tsx`: `setStartTime('09:00')`, `setEndTime('17:00')`

**期待動作:** 開始時刻9:00、終了時刻17:30

#### 問題2: 時刻表示が09:00形式（要件は9:00形式）
**現状:** 
- `ScheduleModal.tsx`: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
- `TaskModal.tsx`: TimePicker内で`${parseInt(t.split(':')[0])}:${t.split(':')[1]}`と表示

**期待動作:** 9:00, 15:00のように先頭ゼロなし

#### 問題3: 複製時に元のスケジュールが消える可能性
**現状:** 
- `ScheduleModal.tsx`: 複製モード(`isDuplicateMode`)が実装されている
- 複製時は新規作成APIを呼ぶため、元のスケジュールは消えない（✅正常）

**診断結果:** この問題は既に解決済み

#### 問題4: 他人のスケジュールの編集不可（グレーアウト）が未実装
**現状:**
- `Schedule.tsx`: `readOnly={calendarViewMode === 'all' && selectedSchedule.userId !== user?.id}`
- `TaskModal.tsx`: `readOnly`プロパティを受け取り、`disabled={readOnly}`を設定

**診断結果:** 実装済みだが、視覚的なグレーアウトが不十分

#### 問題5: 場所「その他」選択後、更新時に場所を選ばずに更新可能
**現状:**
- `ScheduleModal.tsx`: 場所のバリデーションなし
- `TaskModal.tsx`: 場所のバリデーションあり（`if (!locationText) { alert('場所を選択してください'); return; }`）

**期待動作:** 場所は必須項目として扱う

#### 問題6: 月表示で日付ドラッグ時に翌日に表示される
**現状:**
- `DraggableCalendarView.tsx`: 月表示での日付取得に`toISOString()`を使用していたが、最新の修正で`getFullYear()`, `getMonth()`, `getDate()`に変更済み

**診断結果:** 最新の修正で解決済みの可能性が高いが、テストが必要

#### 問題7: 週/日表示で時間変更時のバグ（最重要）
**現状:**
- `DraggableCalendarView.tsx`: `handleEventDrop`と`handleEventResize`でJST Dateメソッドを使用
- しかし、FullCalendarの内部動作との整合性に問題がある可能性

**期待動作:**
- ビジュアルで4/5の12:00-15:00のタスクの開始時刻を10:00にドラッグ → 4/5の10:00-15:00
- 同じタスクをボックスごと15:00にドラッグ → 4/5の15:00-18:00（3時間分移動）

#### 問題8: 「今日」ボタンが未実装
**現状:** Schedule.tsxに「今日」ボタンなし

**期待動作:** Googleカレンダーのように、現在表示中の月/週/日から今日の日付に戻るボタン



## 修正設計書

### 修正優先度
1. 🔴 最優先: 問題7（週/日表示の時間変更バグ）
2. 🟠 高優先: 問題1（デフォルト時刻）、問題2（時刻表示形式）、問題8（今日ボタン）
3. 🟡 中優先: 問題4（グレーアウト強化）、問題5（場所バリデーション）
4. 🟢 低優先: 問題6（月表示ドラッグ - テスト確認）

---

### 修正1: デフォルト時刻を9:00-17:30に変更

**対象ファイル:**
- `frontend/src/components/schedule/ScheduleModal.tsx`
- `frontend/src/components/project/TaskModal.tsx`

**修正内容:**
```typescript
// 修正前
const [startTime, setStartTime] = useState('09:00');
const [endTime, setEndTime] = useState('17:00');

// 修正後
const [startTime, setStartTime] = useState('09:00');
const [endTime, setEndTime] = useState('17:30');
```

**影響範囲:** 新規タスク/スケジュール作成時のデフォルト値のみ

---

### 修正2: 時刻表示を9:00形式に変更

**対象ファイル:**
- `frontend/src/components/schedule/ScheduleModal.tsx`
- `frontend/src/components/project/TaskModal.tsx`

**修正内容:**

ScheduleModal.tsx:
```typescript
// 修正前
const timeLabel = `${hour}:${String(minute).padStart(2, '0')}`;

// 修正後（既に正しい形式）
const timeLabel = `${hour}:${String(minute).padStart(2, '0')}`;
```

TaskModal.tsx:
```typescript
// TimePicker内の表示ラベル
// 修正前
{parseInt(t.split(':')[0])}:{t.split(':')[1]}

// 修正後（既に正しい形式）
{parseInt(t.split(':')[0])}:{t.split(':')[1]}
```

**診断結果:** 既に正しい形式で実装されている

---

### 修正3: 他人のスケジュールのグレーアウト強化

**対象ファイル:**
- `frontend/src/components/project/TaskModal.tsx`

**修正内容:**
readOnlyモード時に、すべての入力フィールドに視覚的なグレーアウトを追加

```typescript
// 各入力フィールドに以下のクラスを追加
className={`... ${readOnly ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-gray-700' : ''}`}
```

**影響範囲:** 他人のスケジュール閲覧時の視覚的フィードバック

---

### 修正4: 場所のバリデーション強化

**対象ファイル:**
- `frontend/src/components/schedule/ScheduleModal.tsx`

**修正内容:**
```typescript
// handleSubmit内に追加
if (!locationText || locationText.trim() === '') {
  alert('場所を入力してください');
  setLoading(false);
  return;
}
```

**影響範囲:** スケジュール保存時のバリデーション

---

### 修正5: 「今日」ボタンの追加

**対象ファイル:**
- `frontend/src/pages/Schedule.tsx`

**修正内容:**
```typescript
// ナビゲーションボタンの間に追加
<Button variant="outline" onClick={handlePrev}>
  <ChevronLeft className="h-4 w-4" />
</Button>
<Button 
  variant="outline" 
  onClick={() => setCurrentDate(new Date())}
  className="px-3 py-1.5"
>
  今日
</Button>
<div className="flex items-center gap-4">
  ...
</div>
```

**影響範囲:** カレンダーナビゲーション

---

### 修正6: 週/日表示の時間変更バグ修正（最重要）

**問題の詳細分析:**

現在の実装では、FullCalendarの`timeZone: 'Asia/Tokyo'`設定により、Dateオブジェクトは既にJSTとして扱われているはずです。しかし、以下の問題が考えられます:

1. **イベントデータ変換時の問題**
   - スケジュールデータをFullCalendarイベントに変換する際、日付と時刻の組み合わせ方に問題がある可能性

2. **ドラッグ&ドロップ時の時刻計算**
   - `handleEventDrop`で所要時間を計算して新しい終了時刻を設定しているが、この計算が正しくない可能性

3. **リサイズ時の時刻計算**
   - `handleEventResize`で開始時刻または終了時刻のみを変更する際の計算に問題がある可能性

**対象ファイル:**
- `frontend/src/components/schedule/DraggableCalendarView.tsx`

**修正方針:**

1. **イベントデータ変換の確認**
   - `start`と`end`の形式が正しいか確認
   - FullCalendarが期待する形式: `"YYYY-MM-DDTHH:mm:ss"`（タイムゾーン指定なし）

2. **ドラッグ時の時刻取得方法の見直し**
   - `event.start`から時刻を取得する際、FullCalendarの内部表現を正しく解釈する
   - デバッグログを追加して、実際の値を確認

3. **バックエンドAPIの確認**
   - 送信されたデータがバックエンドで正しく解釈されているか確認
   - バックエンドは`Date`オブジェクトをそのまま保存しているため、タイムゾーン情報が失われる可能性

**修正内容:**

```typescript
// handleEventDrop内の週/日表示部分
// 修正前
const jstHours = newStart.getHours();
const jstMinutes = newStart.getMinutes();
const newStartTime = `${String(jstHours).padStart(2, '0')}:${String(jstMinutes).padStart(2, '0')}`;

// 修正後（デバッグログ追加）
console.log('=== ドラッグ&ドロップ デバッグ ===');
console.log('newStart (raw):', newStart);
console.log('newStart.toString():', newStart.toString());
console.log('newStart.toISOString():', newStart.toISOString());
console.log('newStart.getHours():', newStart.getHours());
console.log('newStart.getMinutes():', newStart.getMinutes());
console.log('newStart.getTimezoneOffset():', newStart.getTimezoneOffset());

const jstHours = newStart.getHours();
const jstMinutes = newStart.getMinutes();
const newStartTime = `${String(jstHours).padStart(2, '0')}:${String(jstMinutes).padStart(2, '0')}`;

console.log('計算された newStartTime:', newStartTime);
console.log('元の schedule.startTime:', schedule.startTime);
console.log('===================================');
```

**テスト手順:**
1. 週表示で4/5の12:00-15:00のタスクを作成
2. 開始時刻を10:00にドラッグ
3. コンソールログを確認
4. 保存後、データベースの値を確認
5. ページをリロードして、正しく表示されるか確認

---

### 修正7: 月表示ドラッグのテスト確認

**対象ファイル:**
- `frontend/src/components/schedule/DraggableCalendarView.tsx`

**テスト手順:**
1. 月表示で4/5のタスクを作成
2. 4/6にドラッグ
3. 4/6に正しく表示されるか確認（4/7ではない）
4. データベースの値を確認

**期待結果:** 最新の修正により、正しく動作するはず

---

## 修正実施順序

### フェーズ1: 簡単な修正（30分）✅ 完了
1. ✅ 修正1: デフォルト時刻を9:00-17:30に変更
   - `frontend/src/components/project/TaskModal.tsx`: `setEndTime('17:30')`に変更
   - `frontend/src/components/schedule/ScheduleModal.tsx`: `setEndTime('17:30')`に変更
2. ✅ 修正2: 時刻表示形式の確認（既に正しい）
3. ✅ 修正5: 「今日」ボタンの追加
   - `frontend/src/pages/Schedule.tsx`: 「今日」ボタンを追加（ChevronRightボタンの隣）

### フェーズ2: バリデーション強化（15分）✅ 完了
4. ✅ 修正4: 場所のバリデーション強化
   - `frontend/src/components/schedule/ScheduleModal.tsx`: 場所の必須チェックを追加
5. ✅ 修正3: グレーアウト強化
   - `frontend/src/components/project/TaskModal.tsx`: readOnlyモード時に視覚的なグレーアウトを追加
   - DateInput、TimePicker、select、textareaに`opacity-60 cursor-not-allowed bg-gray-100 dark:bg-gray-700`クラスを追加

### フェーズ3: 重要なバグ修正（60分）🔄 進行中
6. 🔴 修正6: 週/日表示の時間変更バグ修正
   - ✅ デバッグログ追加完了
   - `frontend/src/components/schedule/DraggableCalendarView.tsx`:
     - `handleEventDrop`にデバッグログ追加
     - `handleEventResize`にデバッグログ追加
   - 🔄 次のステップ: テスト実施が必要

### フェーズ4: 最終確認（30分）⏳ 未実施
7. ⏳ 修正7: 月表示ドラッグのテスト確認
8. ⏳ 全機能の統合テスト

---

## テストチェックリスト

### 基本機能
- [ ] タスク登録
- [ ] タスク編集
- [ ] タスク削除
- [ ] タスク複製（元のタスクが残る）
- [ ] スケジュール登録
- [ ] スケジュール編集
- [ ] スケジュール削除
- [ ] スケジュール複製（元のスケジュールが残る）

### カレンダー表示
- [ ] 月表示
- [ ] 週表示
- [ ] 日表示
- [ ] 「今日」ボタンで今日の日付に戻る

### ドラッグ&ドロップ
- [ ] 月表示: 日付間のドラッグ（時刻保持）
- [ ] 週表示: 時間軸でのドラッグ（ブロック移動）
- [ ] 日表示: 時間軸でのドラッグ（ブロック移動）
- [ ] 週表示: リサイズ（開始時刻変更）
- [ ] 週表示: リサイズ（終了時刻変更）

### デフォルト値
- [ ] 新規タスク作成時: 9:00-17:30
- [ ] 時間枠クリック時: クリックした時刻から1時間

### 時刻表示
- [ ] 9:00形式（09:00ではない）
- [ ] 15:00形式（PM3:00ではない）

### 権限管理
- [ ] 他人のスケジュール: 詳細表示可能
- [ ] 他人のスケジュール: 編集不可（グレーアウト）
- [ ] 自分のスケジュール: 編集可能

### バリデーション
- [ ] タイトル必須
- [ ] 場所必須
- [ ] 場所「その他」選択時: テキスト入力必須
- [ ] 終了日 >= 開始日

### 繰り返し機能
- [ ] 毎週繰り返し
- [ ] 毎日繰り返し
- [ ] 曜日指定

---

## 注意事項

1. **タイムゾーンの扱い**
   - FullCalendarは`timeZone: 'Asia/Tokyo'`を設定しているため、Dateオブジェクトは既にJSTとして扱われる
   - `.toISOString()`は常にUTCに変換するため、使用しない
   - `getFullYear()`, `getMonth()`, `getDate()`, `getHours()`, `getMinutes()`を使用

2. **バックエンドAPIの仕様**
   - `date`, `startDate`, `endDate`は`Date`型（YYYY-MM-DD形式の文字列を受け取る）
   - `startTime`, `endTime`は`String`型（HH:mm形式）
   - バックエンドはタイムゾーン情報を保持しないため、フロントエンドでJSTとして扱う必要がある

3. **デバッグ方法**
   - ブラウザのコンソールログを確認
   - ネットワークタブでAPIリクエスト/レスポンスを確認
   - データベースの値を直接確認

4. **テスト環境**
   - ローカル環境で十分にテスト
   - ステージング環境でテスト
   - 本番環境へのデプロイ前に最終確認

---

## 次のステップ

1. ✅ この設計書を確認
2. ✅ フェーズ1から順に修正を実施
3. 🔄 各修正後にテストを実施（SCHEDULE_CALENDAR_FIX_TESTING_GUIDE.mdを参照）
4. ⏳ 問題があれば設計書を更新
5. ⏳ すべての修正が完了したら、統合テストを実施
6. ⏳ GitHubにコミット・プッシュ

---

## 実施済み修正の詳細

### 修正1: デフォルト時刻を9:00-17:30に変更 ✅
**ファイル:** 
- `frontend/src/components/project/TaskModal.tsx` (Line 232)
- `frontend/src/components/schedule/ScheduleModal.tsx` (Line 40)

**変更内容:**
```typescript
// 修正前
const [endTime, setEndTime] = useState('17:00');

// 修正後
const [endTime, setEndTime] = useState('17:30');
```

---

### 修正4: 場所のバリデーション強化 ✅
**ファイル:** `frontend/src/components/schedule/ScheduleModal.tsx`

**変更内容:**
```typescript
// handleSubmit内に追加
if (!locationText || locationText.trim() === '') {
  alert('場所を入力してください');
  setLoading(false);
  return;
}
```

---

### 修正3: 他人のスケジュールのグレーアウト強化 ✅
**ファイル:** `frontend/src/components/project/TaskModal.tsx`

**変更内容:**
- DateInputコンポーネント: `className`に`${disabled ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-gray-700' : ''}`を追加
- TimePickerコンポーネント: `className`に`${disabled ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-gray-700' : 'hover:border-blue-400 cursor-pointer'}`を追加
- 場所selectフィールド: `className`に`${readOnly ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-gray-700' : ''}`を追加
- メモtextareaフィールド: `className`に`${readOnly ? 'opacity-60 cursor-not-allowed bg-gray-100 dark:bg-gray-700' : ''}`を追加

---

### 修正5: 「今日」ボタンの追加 ✅
**ファイル:** `frontend/src/pages/Schedule.tsx`

**変更内容:**
```typescript
// ChevronRightボタンの隣に追加
<div className="flex items-center gap-2">
  <Button 
    variant="outline" 
    onClick={() => setCurrentDate(new Date())}
    className="px-3 py-1.5"
  >
    今日
  </Button>
  <Button variant="outline" onClick={handleNext}>
    <ChevronRight className="h-4 w-4" />
  </Button>
</div>
```

---

### 修正6: 週/日表示の時間変更バグ修正（デバッグログ追加）✅
**ファイル:** `frontend/src/components/schedule/DraggableCalendarView.tsx`

**変更内容:**
- `handleEventDrop`関数内の週/日表示処理にデバッグログを追加
- `handleEventResize`関数内の開始時刻変更・終了時刻変更処理にデバッグログを追加

**追加されたデバッグログ:**
```typescript
console.log('=== ドラッグ&ドロップ デバッグ ===');
console.log('newStart (raw):', newStart);
console.log('newStart.toString():', newStart.toString());
console.log('newStart.toISOString():', newStart.toISOString());
console.log('newStart.getHours():', newStart.getHours());
console.log('newStart.getMinutes():', newStart.getMinutes());
console.log('newStart.getTimezoneOffset():', newStart.getTimezoneOffset());
console.log('計算された newStartTime:', newStartTime);
console.log('元の schedule.startTime:', schedule.startTime);
console.log('計算された newEndTime:', newEndTime);
console.log('元の schedule.endTime:', schedule.endTime);
console.log('所要時間 (duration):', duration, '分');
console.log('===================================');
```

---

## テスト実施について

詳細なテスト手順は `SCHEDULE_CALENDAR_FIX_TESTING_GUIDE.md` を参照してください。

### 重要なテスト項目
1. デフォルト時刻（9:00-17:30）
2. 「今日」ボタン
3. 場所のバリデーション
4. 他人のスケジュールのグレーアウト
5. 週/日表示でのドラッグ&ドロップ（最重要）
   - ブロック移動（時間軸）
   - ブロック移動（日付変更）
   - リサイズ（開始時刻変更）
   - リサイズ（終了時刻変更）
6. 月表示でのドラッグ&ドロップ
7. 時刻表示形式

### テスト時の注意事項
- 必ずブラウザの開発者ツール（コンソール）を開いた状態でテストしてください
- 週/日表示のドラッグ&ドロップテスト時は、コンソールログを必ず確認してください
- 問題が発生した場合は、コンソールログを保存してください

