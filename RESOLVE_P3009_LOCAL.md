# P3009 エラー解決手順（ローカルから実行）

## 問題

Render の無料版ではデータベース管理画面から直接SQLを実行できないため、ローカルから本番DBに接続して解決する必要があります。

## 解決方法

### 方法1: Prisma migrate resolve をローカルから実行（推奨）

#### ステップ1: 本番環境の DATABASE_URL を取得

1. Render ダッシュボードにアクセス
2. データベースサービスを選択
3. 「Connect」タブを開く
4. 「Internal Database URL」または「External Database URL」をコピー

#### ステップ2: ローカルで環境変数を設定

```bash
# 本番環境の DATABASE_URL を設定（一時的に）
export DATABASE_URL="postgresql://user:password@host:port/database"

# または、.env ファイルに追加（既存の DATABASE_URL をバックアップ）
cp backend/.env backend/.env.backup
echo 'DATABASE_URL="postgresql://user:password@host:port/database"' >> backend/.env
```

#### ステップ3: Prisma migrate resolve を実行

```bash
cd backend

# 失敗したマイグレーションを「適用済み」としてマーク
npx prisma migrate resolve --applied 20260119000000_fix_snspost_week_format
```

#### ステップ4: マイグレーションの状態を確認

```bash
# マイグレーションの状態を確認
npx prisma migrate status
```

#### ステップ5: 修正版マイグレーションを手動で実行

`backend/scripts/manual-fix-week-field.sql` の内容を、Prisma の raw query で実行するか、または新しいマイグレーションとして作成します。

### 方法2: 新しいマイグレーションを作成して修正を適用

失敗したマイグレーションを解決した後、修正版のマイグレーションを新しいマイグレーションとして作成します。

#### ステップ1: 失敗したマイグレーションを解決

```bash
cd backend
export DATABASE_URL="<本番環境のDATABASE_URL>"
npx prisma migrate resolve --applied 20260119000000_fix_snspost_week_format
```

#### ステップ2: 修正版マイグレーションを新しいマイグレーションとして作成

```bash
# 新しいマイグレーションを作成
npx prisma migrate dev --create-only --name fix_snspost_week_format_v2
```

#### ステップ3: 新しいマイグレーションファイルを編集

`backend/prisma/migrations/YYYYMMDDHHMMSS_fix_snspost_week_format_v2/migration.sql` に、`backend/scripts/manual-fix-week-field.sql` の内容をコピーします。

#### ステップ4: マイグレーションを適用

```bash
npx prisma migrate deploy
```

### 方法3: バックエンドコードから一時的にマイグレーションを実行

一時的なエンドポイントを作成して、マイグレーションを実行する方法（本番環境では推奨しませんが、緊急時には有効）。

## 推奨手順（最も安全）

1. **本番環境の DATABASE_URL を取得**
2. **ローカルで環境変数を設定**
3. **Prisma migrate resolve を実行**
4. **修正版マイグレーションを手動で実行**（新しいマイグレーションとして作成）
5. **デプロイ**

## 注意事項

- 本番環境の DATABASE_URL は機密情報です。環境変数として安全に管理してください
- 操作前に必ずバックアップを取得してください（Render のバックアップ機能を使用）
- ローカルから本番DBに接続する際は、ネットワーク接続を確認してください

