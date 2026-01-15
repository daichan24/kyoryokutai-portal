# P3009 エラー解決（最も簡単な方法）

## 問題

- P3009 エラー: 失敗したマイグレーションが残っている
- Internal Database URL はローカルから接続できない

## 解決方法: Render のシェルを使用（推奨）

Render のバックエンドサービスから直接コマンドを実行します。これが最も簡単で確実な方法です。

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

## 期待される結果

デプロイ後、Render のログで以下を確認:

```
RUN MIGRATE
Applying migration `20260119000000_fix_snspost_week_format`
✅ すべての week が "YYYY-WWW" 形式に変換されました
MIGRATE DONE
```

## 注意事項

- Render のシェルは一時的なセッションです。コマンドを実行した後、セッションが終了します
- マイグレーションファイルは既に冪等性を確保しているため、部分的に適用されていても安全に再実行できます

