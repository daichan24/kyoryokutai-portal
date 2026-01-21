# 過去のエラーと解決方法の記録

このドキュメントには、開発中に発生した主要なエラーとその解決方法を記録しています。

## Issue 1: 個人モードで追加したミッション・プロジェクト・タスクが表示されない

### 問題の概要
メンバー以外の役職（MASTER等）で「個人」モードから新規追加したミッション・プロジェクト・タスクが、追加直後に一覧に表示されない問題が発生しました。データは保存されており、ダッシュボードのウィジェットやスケジュールには反映されていました。

### エラーの詳細
- **発生箇所**: `frontend/src/pages/Goals.tsx`, `frontend/src/pages/Projects.tsx`, `frontend/src/pages/Tasks.tsx`
- **症状**: 
  - 「個人」モードで新規追加したデータが一覧に表示されない
  - データは保存されている（ウィジェットには表示される）
  - ページをリロードすると表示される

### 原因
1. `useQuery`の`enabled`条件が`!!user?.id || viewMode === 'view'`となっており、「個人」モード（`viewMode === 'create'`）で`user?.id`が存在しても、条件が満たされない場合があった
2. `viewMode === 'create'`のときに、一覧表示のコードが存在せず、空のメッセージのみが表示されていた

### 解決方法
1. **`enabled`条件の修正**:
   ```typescript
   // 修正前
   enabled: !!user?.id || viewMode === 'view'
   
   // 修正後
   enabled: !!user?.id
   ```

2. **`refetchOnMount`の追加**:
   ```typescript
   refetchOnMount: true, // マウント時に再取得
   refetchOnWindowFocus: false, // ウィンドウフォーカス時は再取得しない
   ```

3. **`viewMode === 'create'`での一覧表示の追加**:
   - `Goals.tsx`: 「個人」モードでもミッション一覧を表示するように修正
   - `Projects.tsx`: 「個人」モードでもプロジェクト一覧を表示するように修正
   - `Tasks.tsx`: 「個人」モードでもタスク一覧を表示するように修正

### 関連コミット
- `fix: メンバー以外の役職で個人モードから追加したデータが表示されない問題を修正`
- `fix: Goals.tsxのenabled条件を修正`
- `fix: 個人モードでミッション一覧が表示されるように修正`
- `fix: 個人モードでプロジェクト・タスク一覧が表示されるように修正`

---

## Issue 2: PDF生成時の500エラー

### 問題の概要
視察記録、週次報告、月次報告のPDF出力時に、頻繁に500 Internal Server Errorが発生していました。

### エラーの詳細
- **発生箇所**: `backend/src/routes/inspections.ts`, `backend/src/routes/weeklyReports.ts`, `backend/src/routes/monthlyReports.ts`
- **エラーメッセージ**: `Request failed with status code 500`
- **症状**: PDF出力ボタンを押すと毎回「PDF出力に失敗しました」と表示される

### 原因
1. PDF生成時のエラーハンドリングが不十分で、具体的なエラー内容がフロントエンドに伝わっていなかった
2. `puppeteer`のタイムアウト設定が短すぎた可能性
3. PDF生成時にユーザー情報が存在しない場合のエラーハンドリングが不足していた

### 解決方法
1. **エラーハンドリングの強化**:
   - バックエンドで詳細なエラーメッセージを返すように修正
   - フロントエンドでJSONエラーレスポンスをパースして表示

2. **タイムアウト設定の調整**:
   ```typescript
   // backend/src/services/pdfGenerator.ts
   timeout: 60000, // 60秒に延長
   ```

3. **ユーザー情報の存在確認**:
   ```typescript
   if (!inspection.user?.name) {
     throw new Error('User information is missing');
   }
   ```

### 関連コミット
- `fix: PDF生成時のエラーハンドリングを改善`
- `fix: PDF生成サービスのタイムアウトを延長`

---

## Issue 3: スケジュール作成時の500エラー

### 問題の概要
スケジュール作成時に、必須項目を入力しても500エラーが発生する問題がありました。

### エラーの詳細
- **発生箇所**: `backend/src/routes/schedules.ts`
- **エラーメッセージ**: `The column startDate does not exist in the current database`
- **症状**: スケジュール作成時に保存できない

### 原因
1. Prismaスキーマに`startDate`と`endDate`フィールドが追加されていたが、データベースマイグレーションが実行されていなかった
2. バックエンドのコードが新しいスキーマを参照していたが、データベースが古いスキーマのままだった

### 解決方法
1. **マイグレーションファイルの作成**:
   ```sql
   -- backend/prisma/migrations/20260130000000_add_start_end_date_to_schedule/migration.sql
   ALTER TABLE "Schedule" ADD COLUMN "startDate" TIMESTAMP(3);
   ALTER TABLE "Schedule" ADD COLUMN "endDate" TIMESTAMP(3);
   UPDATE "Schedule" SET "startDate" = "date", "endDate" = "date" WHERE "startDate" IS NULL;
   ```

2. **マイグレーションの実行**:
   ```bash
   npx prisma migrate deploy
   ```

### 関連コミット
- `fix: スケジュール作成時のデータベースエラーを修正`
- `feat: ScheduleモデルにstartDateとendDateを追加`

---

## Issue 4: フロントエンドビルドエラー（重複宣言）

### 問題の概要
フロントエンドのビルド時に、変数の重複宣言エラーが発生しました。

### エラーの詳細
- **発生箇所**: `frontend/src/pages/Wishes.tsx`
- **エラーメッセージ**: `ERROR: The symbol "currentWishIndex" has already been declared`
- **症状**: GitHub Actionsでのビルドが失敗する

### 原因
同じ変数が2回宣言されていた

### 解決方法
重複した変数宣言を削除

### 関連コミット
- `fix: Wishes.tsxの重複宣言を削除`

---

## Issue 5: スケジュールカレンダーの横幅がはみ出す

### 問題の概要
スケジュール管理のカレンダー表示で、横幅が画面からはみ出る問題がありました。

### エラーの詳細
- **発生箇所**: `frontend/src/pages/Schedule.tsx`
- **症状**: カレンダーの横幅が画面からはみ出る

### 原因
カレンダーグリッドの幅が固定されておらず、コンテナに`overflow-x-auto`が設定されていなかった

### 解決方法
1. カレンダーグリッドに`min-w-[1260px]`を設定
2. 親コンテナに`overflow-x-auto`を追加

### 関連コミット
- `fix: スケジュールカレンダーの横幅がはみ出す問題を修正`

---

## Issue 6: タスクが全員に公開されている

### 問題の概要
タスクが全メンバーに公開されてしまい、本来は自分のタスクのみ表示されるべきだった。

### エラーの詳細
- **発生箇所**: `frontend/src/pages/Tasks.tsx`
- **症状**: メンバーが他のメンバーのタスクも見えてしまう

### 原因
タスク取得時に`userId`フィルタが適用されていなかった

### 解決方法
メンバーの場合は、`userId`パラメータを追加して自分のタスクのみを取得するように修正

### 関連コミット
- `fix: タスクが全員に公開されている問題を修正`

---

## まとめ

これらのエラーは主に以下のカテゴリに分類されます：

1. **データ取得・表示の問題**: `useQuery`の設定や条件分岐の問題
2. **データベーススキーマの問題**: マイグレーションの未実行
3. **エラーハンドリングの問題**: エラーメッセージが適切に表示されない
4. **UI/UXの問題**: レイアウトや表示の問題
5. **ビルドエラー**: コードの構文エラーや重複宣言

今後の開発では、これらの問題を参考にして、同様のエラーを防ぐことができます。

