# Render Start Command 設定手順

## 設定内容

RenderのBackend Serviceの **Start Command** を以下に設定してください：

```bash
echo "RUN MIGRATE" && npx prisma migrate deploy && echo "MIGRATE DONE" && if [ "$RUN_SEED" = "true" ]; then echo "=== RUN SEED ===" && npm run seed && echo "SEED DONE"; fi && npm start
```

## コマンドの説明

- `echo "RUN MIGRATE"` でログに開始を記録
- `npx prisma migrate deploy` で未適用のmigrationを適用（statusは削除、exit 1で失敗しないように）
- `RUN_SEED=true` 環境変数が設定されている場合のみ `npm run seed` で初期データを投入（本番環境では非推奨）
- `npm start` でアプリケーションを起動

## 重要な注意点

1. **`npx prisma migrate status` は削除**: 未適用migrationがあると exit 1 を返し、デプロイが失敗するため削除しました
2. **Root Directory が `backend` の場合**: `cd backend` は不要です（パスがずれます）
3. **Seed の実行**: 本番環境では `RUN_SEED=true` を設定しないことを推奨します（テスト環境のみ使用）

## 設定手順

1. Renderダッシュボードにログイン
2. Backend Serviceを選択
3. **Settings** タブを開く
4. **Start Command** フィールドに上記コマンドを貼り付け
5. **Save Changes** をクリック
6. 自動デプロイが開始されます（または手動で **Manual Deploy** を実行）

## 確認方法

デプロイ後、Renderのログで以下が表示されることを確認してください：

```
RUN MIGRATE
Applying migration `20260115000000_add_schedule_participants`
...
MIGRATE DONE
```

`RUN_SEED=true` が設定されている場合のみ：

```
=== RUN SEED ===
...
SEED DONE
```

### ログの確認ポイント

- `RUN MIGRATE` が表示されること
- `Applying migration` で未適用のmigrationが適用される（例: `20260115000000_add_schedule_participants`）
- `MIGRATE DONE` が表示されること
- `RUN_SEED=true` の場合のみ `=== RUN SEED ===` と `SEED DONE` が表示される

### API動作確認

`GET /api/inbox` で `scheduleInvites` が返ることを確認：

```bash
# 例: curlで確認
curl -X GET https://your-backend.onrender.com/api/inbox \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## トラブルシューティング

### "RUN MIGRATE" が表示されない場合

- Start Commandが正しく設定されているか確認
- Root Directoryが `backend` に設定されているか確認（この場合、`cd backend` は不要）
- `npx prisma migrate deploy` がエラーで停止している可能性

### Migrationが適用されない場合

- `Applying migration` のログを確認
- 特定のmigration（例: `20260115000000_add_schedule_participants`）が適用されているか確認
- エラーメッセージがあれば、それを確認

### デプロイが失敗する場合

- `npx prisma migrate status` が含まれていないか確認（exit 1で失敗するため削除済み）
- `npx prisma migrate deploy` のみが実行されているか確認

### ScheduleParticipant が存在しないエラーが出る場合

- `20260115000000_add_schedule_participants` migrationが適用されているか確認
- Renderログで `Applying migration` が表示されているか確認
- `/api/inbox` で `scheduleInvites` が空配列でも返ることを確認（エラーではなく空配列が正常）
