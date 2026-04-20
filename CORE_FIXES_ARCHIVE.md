# 🔧 コア修正アーカイブ（重要な技術的修正の記録）

このドキュメントは、プロジェクトで発生した重要な技術的問題とその解決方法を記録しています。
同様の問題が再発した場合の参考資料として保管してください。

---

## 📅 修正1: スケジュールドラッグ&ドロップ 9時間ずれ問題

**修正日:** 2026年4月20日  
**影響範囲:** スケジュール機能全体  
**重要度:** 🔴 Critical

### 問題の概要

スケジュールの週/日表示で、タスクをドラッグ&ドロップすると、置いた場所から9時間後の時間にスライドしてしまう問題が発生。

**具体例:**
- 10:00にタスクを配置 → 瞬時に19:00に移動
- 17:00にタスクを配置 → 瞬時に翌日02:00に移動

### 根本原因

FullCalendarの `timeZone: 'Asia/Tokyo'` 設定が、タイムゾーンの二重変換を引き起こしていた。

**技術的な詳細:**
1. FullCalendarは内部的にすべての時刻をUTCで管理
2. `timeZone: 'Asia/Tokyo'` を設定すると、表示時にJSTに変換される
3. しかし、イベントハンドラーで取得される `event.start` は**ブラウザのローカルタイムゾーン**の Date オブジェクト
4. 日本のブラウザ（JST）で動作している場合、既にJSTの Date オブジェクトが返される
5. これをさらに「Asia/Tokyo」として解釈すると、二重変換が発生

**変換の流れ（問題のあるケース）:**
```
ユーザーが10:00に配置
↓
FullCalendar内部: UTC 01:00として管理
↓
timeZone: 'Asia/Tokyo'設定により、JST 10:00として表示
↓
ドラッグ&ドロップ時: event.start = JST 10:00の Date オブジェクト
↓
FullCalendarが再度「Asia/Tokyo」として解釈
↓
結果: 19:00に表示される（10:00 + 9時間）
```

### 解決策

**フロントエンド修正:**
```typescript
// 修正前
<FullCalendar
  timeZone="Asia/Tokyo"  // ❌ 二重変換を引き起こす
  // ...
/>

// 修正後
<FullCalendar
  timeZone="local"  // ✅ ブラウザのローカルタイムゾーンを使用
  // ...
/>
```

**バックエンド修正:**
```typescript
// 修正前
const startDate = new Date(`${data.date}T12:00:00+09:00`);
// ❌ ISO 8601文字列はUTCに変換される

// 修正後
const [year, month, day] = data.date.split('-').map(Number);
const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
// ✅ ローカルタイムゾーンで直接作成
```

**カレンダーイベント作成:**
```typescript
// 修正前
const startDateTime = `${startDate}T${schedule.startTime}:00+09:00`;
// ❌ タイムゾーン情報を付けると二重変換

// 修正後
const startDateTime = `${startDate}T${schedule.startTime}:00`;
// ✅ タイムゾーン情報なしで渡す
```

**データベースから読み込む時:**
```typescript
// Prismaの@db.Date型は "2026-04-20T00:00:00.000Z" (UTC) として返される
// これを正しく解釈する

// 修正前
const d = new Date(schedule.startDate);
const year = d.getFullYear();  // ❌ ローカルタイムゾーンに変換される

// 修正後
const d = new Date(schedule.startDate);
const year = d.getUTCFullYear();  // ✅ UTC日付部分を取得
const month = String(d.getUTCMonth() + 1).padStart(2, '0');
const day = String(d.getUTCDate()).padStart(2, '0');
```

### 修正されたファイル

1. `frontend/src/components/schedule/DraggableCalendarView.tsx`
   - FullCalendarの `timeZone` 設定を `"local"` に変更
   - カレンダーイベント作成時のタイムゾーン情報を削除
   - データベースから読み込む時に `getUTCFullYear()` 等を使用

2. `backend/src/routes/schedules.ts`
   - POST/PUTエンドポイントで日付を `new Date(year, month, day)` で作成
   - ISO 8601文字列ではなく、年月日を個別に指定

### 学んだ教訓

1. **FullCalendarのtimeZone設定は慎重に**
   - `timeZone: 'Asia/Tokyo'` は、サーバーがUTCで動作している場合に有用
   - しかし、ブラウザが既にJSTで動作している場合は、`timeZone: 'local'` を使用すべき

2. **Prismaの@db.Date型の挙動**
   - データベースには日付のみを保存（時刻なし）
   - しかし、読み込む時は `YYYY-MM-DDT00:00:00.000Z` (UTC) として返される
   - `getUTCFullYear()` 等を使って、UTC日付部分を取得する必要がある

3. **タイムゾーン変換は一度だけ**
   - タイムゾーン情報を付けた文字列（`+09:00`）は、二重変換を引き起こす可能性がある
   - FullCalendarに渡す時は、タイムゾーン情報なしで渡す

4. **デバッグの重要性**
   - `console.log()` で各段階の値を確認することが重要
   - `toISOString()`, `toString()`, `getTimezoneOffset()` を併用して、タイムゾーンの状態を把握

### テスト方法

1. 週表示または日表示でスケジュールを開く
2. 10:00の枠をクリックして新規作成
3. 作成されたスケジュールが10:00に表示されることを確認
4. そのスケジュールを11:00にドラッグ
5. 11:00に表示されることを確認
6. ページをリロードして、11:00のまま保存されていることを確認

### 関連コミット

- `da55142`: タイムゾーン問題の根本修正（バックエンド+フロントエンド）
- `393ce1e`: データベースから読み込んだ日付のタイムゾーン変換を修正
- `8e6d983`: FullCalendarにタイムゾーン付きISO 8601形式で時刻を渡す（後に取り消し）
- `47f073c`: 日付をローカルタイムゾーンのDateオブジェクトとして作成
- `939a336`: タイムゾーン二重変換を修正（+09:00を削除）
- `686fc01`: FullCalendarのtimeZoneをlocalに変更（最終修正）

---

## 🔄 修正2: Prismaマイグレーション競合問題（P3009エラー）

**修正日:** 2026年4月上旬  
**影響範囲:** データベースマイグレーション  
**重要度:** 🔴 Critical

### 問題の概要

Render環境でのデプロイ時に、Prismaマイグレーションが競合し、P3009エラーが発生。

**エラーメッセージ:**
```
Error: P3009: migrate found failed migrations in the target database
```

### 根本原因

1. ローカル環境とRender環境でマイグレーション履歴が不一致
2. 失敗したマイグレーションがデータベースに記録されている
3. Prismaが自動的にロールバックできない状態

### 解決策

**手動でマイグレーション履歴をクリーンアップ:**

```sql
-- 失敗したマイグレーションを確認
SELECT * FROM "_prisma_migrations" WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;

-- 失敗したマイグレーションを削除
DELETE FROM "_prisma_migrations" WHERE migration_name = '失敗したマイグレーション名';

-- または、すべてのマイグレーション履歴をリセット（注意！）
TRUNCATE TABLE "_prisma_migrations";
```

**マイグレーションを再実行:**
```bash
npx prisma migrate deploy
```

### 予防策

1. **ローカルでテスト:** マイグレーションは必ずローカル環境でテストしてからデプロイ
2. **バックアップ:** 本番環境のデータベースは必ずバックアップを取る
3. **段階的デプロイ:** 大きな変更は複数のマイグレーションに分割

### 関連ドキュメント

- `FIX_P3009_ERROR.md`
- `HANDOVER_MIGRATION_FIX.md`

---

## 📝 修正3: 月次報告自動抽出機能の実装

**修正日:** 2026年4月中旬  
**影響範囲:** 月次報告機能  
**重要度:** 🟡 Medium

### 問題の概要

月次報告作成時に、スケジュールから活動内容を自動抽出する機能が必要だった。

### 解決策

**スケジュールモデルに `isAutoExtracted` フラグを追加:**

```prisma
model Schedule {
  // ...
  isAutoExtracted Boolean @default(false) // 月次報告自動抽出フラグ
  // ...
}
```

**バックエンドで自動抽出ロジックを実装:**

```typescript
// 指定月のスケジュールを取得
const schedules = await prisma.schedule.findMany({
  where: {
    userId,
    startDate: { gte: monthStart, lte: monthEnd },
    isAutoExtracted: false, // まだ抽出されていないもの
  },
});

// 月次報告に追加
// ...

// 抽出済みフラグを立てる
await prisma.schedule.updateMany({
  where: { id: { in: scheduleIds } },
  data: { isAutoExtracted: true },
});
```

### 学んだ教訓

1. **フラグ管理:** 一度抽出したスケジュールを再度抽出しないように、フラグで管理
2. **日付範囲:** 月の境界を正確に扱う（UTC vs JST）
3. **トランザクション:** 複数のデータベース操作は、可能な限りトランザクションで実行

---

## 🎨 修正4: カレンダー表示の最適化

**修正日:** 2026年4月中旬  
**影響範囲:** スケジュール表示  
**重要度:** 🟢 Low

### 問題の概要

カレンダーに大量のスケジュールを表示すると、パフォーマンスが低下する。

### 解決策

**React.useMemoでイベントデータをメモ化:**

```typescript
const calendarEvents = React.useMemo(() => {
  return schedules.map((schedule) => ({
    id: schedule.id,
    title: schedule.title,
    start: `${schedule.date}T${schedule.startTime}:00`,
    end: `${schedule.date}T${schedule.endTime}:00`,
    // ...
  }));
}, [schedules, events, calendarViewMode]);
```

**FullCalendarの設定を最適化:**

```typescript
<FullCalendar
  dayMaxEvents={3}  // 1日あたりの最大表示数
  eventDisplay="block"  // ブロック表示
  // ...
/>
```

### 学んだ教訓

1. **メモ化:** 重い計算は `useMemo` でメモ化
2. **表示制限:** 大量のデータは表示数を制限
3. **仮想化:** 必要に応じて仮想スクロールを検討

---

## 📚 今後の参考資料

### タイムゾーン関連

- [MDN: Date](https://developer.mozilla.org/ja/docs/Web/JavaScript/Reference/Global_Objects/Date)
- [FullCalendar: timeZone](https://fullcalendar.io/docs/timeZone)
- [Prisma: DateTime](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference#datetime)

### Prismaマイグレーション

- [Prisma: Migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Prisma: Troubleshooting](https://www.prisma.io/docs/guides/migrate/production-troubleshooting)

### パフォーマンス最適化

- [React: useMemo](https://react.dev/reference/react/useMemo)
- [FullCalendar: Performance](https://fullcalendar.io/docs/performance)

---

## 🔍 デバッグのベストプラクティス

### 1. ログの活用

```typescript
console.log('=== デバッグ開始 ===');
console.log('入力値:', inputValue);
console.log('変換後:', convertedValue);
console.log('最終結果:', finalResult);
console.log('===================================');
```

### 2. タイムゾーンのデバッグ

```typescript
const date = new Date();
console.log('toString():', date.toString());
console.log('toISOString():', date.toISOString());
console.log('toLocaleString():', date.toLocaleString());
console.log('getTimezoneOffset():', date.getTimezoneOffset());
```

### 3. ブラウザの開発者ツール

- **Console:** ログの確認
- **Network:** APIリクエスト/レスポンスの確認
- **Application:** LocalStorage/SessionStorageの確認

### 4. Renderのログ

- バックエンドのログは Render Dashboard → Logs で確認
- リアルタイムでログを監視
- エラーが発生したら、スタックトレースを確認

---

## ✅ チェックリスト（同様の問題が発生した場合）

### タイムゾーン問題

- [ ] FullCalendarの `timeZone` 設定を確認
- [ ] ブラウザのタイムゾーンを確認（`Intl.DateTimeFormat().resolvedOptions().timeZone`）
- [ ] サーバーのタイムゾーンを確認（Renderは通常UTC）
- [ ] データベースに保存されている値を確認
- [ ] `getFullYear()` vs `getUTCFullYear()` の使い分けを確認
- [ ] ISO 8601文字列のタイムゾーン情報を確認（`+09:00` の有無）

### Prismaマイグレーション問題

- [ ] `_prisma_migrations` テーブルを確認
- [ ] 失敗したマイグレーションがないか確認
- [ ] ローカルとRenderのマイグレーション履歴が一致しているか確認
- [ ] データベースのバックアップを取る
- [ ] マイグレーションをローカルでテスト

### パフォーマンス問題

- [ ] React DevTools Profilerで計測
- [ ] 不要な再レンダリングがないか確認
- [ ] `useMemo` / `useCallback` の使用を検討
- [ ] データ量を制限（ページネーション、仮想スクロール）

---

**最終更新:** 2026年4月20日  
**作成者:** Kiro AI Assistant  
**バージョン:** 1.0


---

## 2026-04-21: タスクモーダル - ミッション・プロジェクト保持の修正

### 問題
スケジュールから「タスク編集」を開いたときに、ミッションとプロジェクトの情報が正しく表示・保持されない問題。

### 根本原因
1. **バックエンド**: スケジュール取得APIに`task`情報が含まれていなかった
2. **フロントエンド**: スケジュール編集時の初期値設定が不完全で、`schedule.task`を参照していなかった
3. **UI**: タイトルが「メモ」フィールドに重複して表示されていた

### 修正内容

#### バックエンド（backend/src/routes/schedules.ts）
```typescript
// スケジュール取得APIにtask情報を追加
task: {
  select: {
    id: true,
    missionId: true,
    projectId: true,
    title: true,
    linkKind: true,
  },
}
```

#### フロントエンド（frontend/src/components/project/TaskModal.tsx）
```typescript
// スケジュール編集時の初期値設定を完全に書き直し
if ((schedule as any).task) {
  const scheduleTask = (schedule as any).task;
  setSelectedMissionId(scheduleTask.missionId || '');
  setProjectId(scheduleTask.projectId || null);
  
  // linkKindからattachModeを設定
  const taskLinkKind = scheduleTask.linkKind;
  if (taskLinkKind === 'KYORYOKUTAI_WORK') {
    setAttachMode('KYORYOKUTAI');
  } else if (taskLinkKind === 'YAKUBA_WORK') {
    setAttachMode('YAKUBA');
  } else if (taskLinkKind === 'TRIAGE_PENDING') {
    setAttachMode('TRIAGE');
  } else if (scheduleTask.projectId) {
    setAttachMode('PROJECT');
  } else {
    setAttachMode('UNSET');
  }
}
```

### 影響範囲
- スケジュールページからの「タスク編集」
- タスク一覧からの「タスク編集」
- タスクの新規作成
- スケジュールの編集

### コミット
- `f4110c4` - feat: スケジュール取得APIにタスク情報を含める
- `739339d` - feat: スケジュール編集時にタスク情報からミッション・プロジェクトを取得
- `872674d` - fix: タイトルがメモに飛ぶ問題を修正とミッション保持の改善
- `7ea2c08` - fix: プロジェクト選択時にミッションがリセットされる問題を修正

### 詳細ドキュメント
[TASK_MODAL_MISSION_PROJECT_FIX.md](./TASK_MODAL_MISSION_PROJECT_FIX.md)

### 重要度
🔴 **CRITICAL** - タスク管理の基本機能に影響する重要な修正
