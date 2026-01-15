# データベース接続エラー解決手順

## 問題

`P1001: Can't reach database server` エラーが発生している。

## 原因

Render の **Internal Database URL** は Render の内部ネットワークからのみ接続可能です。ローカルから接続する場合は **External Database URL** を使用する必要があります。

## 解決方法

### ステップ1: External Database URL を取得

1. Render ダッシュボードにアクセス
2. **データベースサービス**を選択
3. **「Connect」タブ**を開く
4. **「External Database URL」**をコピー
   - 例: `postgresql://user:password@dpg-xxxxx-a.singapore-postgres.render.com:5432/database`
   - ポート番号（通常は 5432）が含まれていることを確認

### ステップ2: 接続テスト

```bash
cd backend

# External Database URL を設定
export DATABASE_URL="<コピーしたExternal Database URL>"

# 接続テスト
npx prisma db pull
```

### ステップ3: マイグレーション解決

接続が成功したら、失敗したマイグレーションを解決:

```bash
# 失敗したマイグレーションを「適用済み」としてマーク
npx prisma migrate resolve --applied 20260119000000_fix_snspost_week_format

# マイグレーションの状態を確認
npx prisma migrate status
```

### ステップ4: 環境変数をクリア

```bash
unset DATABASE_URL
```

## 代替方法: Render のシェルを使用

もし External Database URL が取得できない場合、Render のシェル機能を使用します。

### ステップ1: Render のシェルにアクセス

1. Render ダッシュボードにアクセス
2. **バックエンドサービス**を選択
3. **「Shell」タブ**を開く（または「Manual Deploy」→「Run Shell」）

### ステップ2: シェルでコマンドを実行

```bash
cd /opt/render/project/src/backend
npx prisma migrate resolve --applied 20260119000000_fix_snspost_week_format
```

## 注意事項

- External Database URL は機密情報です。環境変数として安全に管理してください
- 接続がタイムアウトする場合は、ファイアウォール設定を確認してください
- Render の無料版では External Database URL が提供されない場合があります

