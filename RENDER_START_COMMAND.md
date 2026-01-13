# Render Start Command 設定手順

## 設定内容

RenderのBackend Serviceの **Start Command** を以下に設定してください：

```bash
cd backend && echo "RUN MIGRATE" && npx prisma migrate deploy && echo "MIGRATE DONE" && node dist/index.js
```

## 設定手順

1. Renderダッシュボードにログイン
2. Backend Serviceを選択
3. **Settings** タブを開く
4. **Start Command** フィールドに上記コマンドを貼り付け
5. **Save Changes** をクリック
6. 自動デプロイが開始されます（または手動で **Manual Deploy** を実行）

## 確認方法

### 1. Migration実行ログの確認

デプロイ後、Renderの **Logs** タブで以下が表示されることを確認：

```
RUN MIGRATE
Prisma schema loaded from prisma/schema.prisma
Datasource "db": PostgreSQL database "xxxxx", schema "public" at "xxxxx:5432"
...
Applying migration `20260112202610_add_citizen_fields`
Applying migration `20260112214352_add_contact_fields`
...
MIGRATE DONE
```

### 2. DB接続情報の確認

ログに以下が表示されることを確認：

```
🔵 [DB] Database Host: xxxxx
🔵 [DB] Database Name: xxxxx
🔵 [DB] Database Port: 5432 (default)
```

### 3. API動作確認

`POST /api/citizens` が200を返すことを確認：

```bash
# 例: curlで確認
curl -X POST https://your-backend.onrender.com/api/citizens \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"テストユーザー"}'
```

## トラブルシューティング

### "RUN MIGRATE" が表示されない場合

- Start Commandが正しく設定されているか確認
- `cd backend` でディレクトリ移動が失敗していないか確認
- Build Commandで`backend`ディレクトリに移動しているか確認

### "MIGRATE DONE" が表示されない場合

- `npx prisma migrate deploy` がエラーで停止している可能性
- ログでエラーメッセージを確認
- DATABASE_URLが正しく設定されているか確認

### P2022エラーが継続する場合

- migrationが適用されていない可能性
- ログで "Applying migration" が表示されているか確認
- 別のDBに接続している可能性（DB Host/Nameログを確認）
