# P3009 エラー解決手順（Render 無料版対応）

## 問題

- Render の無料版ではデータベース管理画面から直接SQLを実行できない
- P3009 エラー: 失敗したマイグレーションが残っているため、新しいマイグレーションが適用できない

## 解決方法

### 方法1: ローカルから Prisma migrate resolve を実行（推奨）

#### ステップ1: 本番環境の DATABASE_URL を取得

1. Render ダッシュボードにアクセス
2. データベースサービスを選択
3. 「Connect」タブを開く
4. 「Internal Database URL」をコピー（または「External Database URL」）

#### ステップ2: ローカルで環境変数を設定

```bash
# 本番環境の DATABASE_URL を一時的に設定
export DATABASE_URL="postgresql://user:password@host:port/database"

# または、.env ファイルに追加（既存の DATABASE_URL をバックアップ推奨）
cd backend
cp .env .env.backup
# .env ファイルを編集して DATABASE_URL を本番環境のものに変更
```

#### ステップ3: Prisma migrate resolve を実行

```bash
cd backend

# 失敗したマイグレーションを「適用済み」としてマーク
npx prisma migrate resolve --applied 20260119000000_fix_snspost_week_format
```

#### ステップ4: 修正版マイグレーションを再適用

マイグレーションファイルは既に修正済み（冪等性を確保）なので、再度デプロイを試みます。

```bash
# マイグレーションの状態を確認
npx prisma migrate status

# 再度デプロイを試みる（または Render で自動デプロイ）
npx prisma migrate deploy
```

#### ステップ5: 環境変数を元に戻す

```bash
# .env ファイルを元に戻す
mv .env.backup .env
# または、export した環境変数を unset
unset DATABASE_URL
```

### 方法2: 新しいマイグレーションを作成（代替案）

もし方法1がうまくいかない場合、新しいマイグレーションとして修正を適用します。

#### ステップ1: 失敗したマイグレーションを解決

```bash
cd backend
export DATABASE_URL="<本番環境のDATABASE_URL>"
npx prisma migrate resolve --applied 20260119000000_fix_snspost_week_format
```

#### ステップ2: 新しいマイグレーションを作成

```bash
# 新しいマイグレーションを作成
npx prisma migrate dev --create-only --name fix_snspost_week_format_v2
```

#### ステップ3: 新しいマイグレーションファイルを編集

`backend/prisma/migrations/YYYYMMDDHHMMSS_fix_snspost_week_format_v2/migration.sql` に、以下をコピー:

```sql
-- 既に適用されている場合はスキップする安全なマイグレーション
-- (backend/scripts/manual-fix-week-field.sql の内容)
```

#### ステップ4: マイグレーションを適用

```bash
npx prisma migrate deploy
```

### 方法3: Render のデプロイログから確認

Render のデプロイログで、マイグレーションがどの段階で失敗したかを確認し、手動で修正します。

## 推奨手順（最も簡単）

1. **本番環境の DATABASE_URL を取得**
2. **ローカルで一時的に DATABASE_URL を設定**
3. **`npx prisma migrate resolve --applied 20260119000000_fix_snspost_week_format` を実行**
4. **環境変数を元に戻す**
5. **コードをプッシュして Render で再デプロイ**

修正版のマイグレーションファイルは既に冪等性を確保しているため、部分的に適用されていても安全に再実行できます。

## 注意事項

- 本番環境の DATABASE_URL は機密情報です。環境変数として安全に管理してください
- 操作前に必ずバックアップを取得してください（Render のバックアップ機能を使用）
- ローカルから本番DBに接続する際は、ネットワーク接続を確認してください
- 操作後は必ず環境変数を元に戻してください

