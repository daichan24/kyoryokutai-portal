# [RESOLVED] スケジュール作成時の500エラー

## 問題の概要
スケジュール作成時に、必須項目を入力しても500エラーが発生する問題がありました。

## エラーの詳細
- **発生箇所**: `backend/src/routes/schedules.ts`
- **エラーメッセージ**: `The column startDate does not exist in the current database`
- **症状**: スケジュール作成時に保存できない

## 原因
1. Prismaスキーマに`startDate`と`endDate`フィールドが追加されていたが、データベースマイグレーションが実行されていなかった
2. バックエンドのコードが新しいスキーマを参照していたが、データベースが古いスキーマのままだった

## 解決方法

### 1. マイグレーションファイルの作成
```sql
-- backend/prisma/migrations/20260130000000_add_start_end_date_to_schedule/migration.sql
ALTER TABLE "Schedule" ADD COLUMN "startDate" TIMESTAMP(3);
ALTER TABLE "Schedule" ADD COLUMN "endDate" TIMESTAMP(3);
UPDATE "Schedule" SET "startDate" = "date", "endDate" = "date" WHERE "startDate" IS NULL;
```

### 2. マイグレーションの実行
```bash
npx prisma migrate deploy
```

### 3. エラーハンドリングの改善
バックエンドで詳細なエラーメッセージを返すように修正し、開発環境ではスタックトレースも含めるようにしました。

## 関連コミット
- `fix: スケジュール作成時のデータベースエラーを修正`
- `feat: ScheduleモデルにstartDateとendDateを追加`

## ラベル
`bug`, `backend`, `database`, `prisma`, `migration`, `resolved`

