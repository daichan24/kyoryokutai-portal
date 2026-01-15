# P3009 エラー クイック解決手順（Render 無料版）

## 🎯 最も簡単な解決方法

Render の無料版ではデータベース管理画面から直接SQLを実行できないため、**ローカルから本番DBに接続**して解決します。

## 📋 手順（5分で完了）

### ステップ1: 本番環境の DATABASE_URL を取得

1. Render ダッシュボードにアクセス
2. **データベースサービス**を選択
3. **「Connect」タブ**を開く
4. **「Internal Database URL」**をコピー
   - 例: `postgresql://user:password@host:port/database`

### ステップ2: ローカルで一時的に環境変数を設定

```bash
cd backend

# 本番環境の DATABASE_URL を一時的に設定
export DATABASE_URL="<コピーしたInternal Database URL>"

# 確認（接続テスト）
npx prisma db pull
```

### ステップ3: 失敗したマイグレーションを解決

```bash
# 失敗したマイグレーションを「適用済み」としてマーク
npx prisma migrate resolve --applied 20260119000000_fix_snspost_week_format
```

### ステップ4: 環境変数を元に戻す

```bash
# 環境変数をクリア（または元の値に戻す）
unset DATABASE_URL

# または、.env ファイルを元に戻す（バックアップから）
```

### ステップ5: コードをプッシュして再デプロイ

```bash
git add .
git commit -m "fix: SNSPost.week マイグレーションを冪等性確保版に修正"
git push origin main
```

Render で自動デプロイが実行され、修正版のマイグレーションが適用されます。

## ✅ 確認

デプロイ後、Render のログで以下を確認:

```
RUN MIGRATE
Applying migration `20260119000000_fix_snspost_week_format`
✅ すべての week が "YYYY-WWW" 形式に変換されました
MIGRATE DONE
```

## 🔍 トラブルシューティング

### エラー: "Can't reach database server"

- 本番DBの Internal Database URL を使用しているか確認
- ネットワーク接続を確認
- Render のデータベースが起動しているか確認

### エラー: "Migration not found"

- マイグレーション名が正確か確認: `20260119000000_fix_snspost_week_format`
- `npx prisma migrate status` で状態を確認

### エラー: "Migration already applied"

- 既に解決済みの可能性があります
- `npx prisma migrate status` で状態を確認

## 📝 注意事項

- 本番環境の DATABASE_URL は機密情報です。操作後は必ず環境変数をクリアしてください
- 操作前に Render のバックアップ機能でバックアップを取得することを推奨します

