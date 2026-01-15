# P3009 エラー解決（接続できない場合の代替方法）

## 問題

ローカルから本番DBに接続できない場合（External Database URL が取得できない、または接続がタイムアウトする）。

## 解決方法: Render のシェルを使用

Render のバックエンドサービスから直接コマンドを実行します。

### ステップ1: Render のシェルにアクセス

1. Render ダッシュボードにアクセス
2. **バックエンドサービス**を選択
3. **「Shell」タブ**を開く
   - または、「Manual Deploy」→「Run Shell」をクリック

### ステップ2: シェルでコマンドを実行

```bash
# プロジェクトディレクトリに移動
cd /opt/render/project/src/backend

# マイグレーションの状態を確認
npx prisma migrate status

# 失敗したマイグレーションを「適用済み」としてマーク
npx prisma migrate resolve --applied 20260119000000_fix_snspost_week_format

# マイグレーションの状態を再確認
npx prisma migrate status
```

### ステップ3: デプロイを再実行

シェルで解決した後、Render で再度デプロイを実行します。

1. **「Manual Deploy」**をクリック
2. **「Deploy latest commit」**を選択
3. デプロイの進行状況を確認

## 代替方法: 新しいマイグレーションを作成

もし Render のシェルも使用できない場合、新しいマイグレーションとして修正を適用します。

### ステップ1: ローカルで新しいマイグレーションを作成

```bash
cd backend

# 新しいマイグレーションを作成（適用はしない）
npx prisma migrate dev --create-only --name fix_snspost_week_format_v2
```

### ステップ2: 新しいマイグレーションファイルを編集

`backend/prisma/migrations/YYYYMMDDHHMMSS_fix_snspost_week_format_v2/migration.sql` に、以下をコピー:

```sql
-- 既に適用されている場合はスキップする安全なマイグレーション
-- backend/scripts/manual-fix-week-field.sql の内容を使用
```

### ステップ3: コードをプッシュ

```bash
git add .
git commit -m "fix: SNSPost.week 修正を新しいマイグレーションとして追加"
git push origin main
```

Render で自動デプロイが実行され、新しいマイグレーションが適用されます。

## 推奨手順

1. **まず Render のシェルを試す**（最も簡単）
2. **シェルが使えない場合、新しいマイグレーションを作成**

