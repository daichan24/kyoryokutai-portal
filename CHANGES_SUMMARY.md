# SNSPost.week 型不一致修正 - 変更サマリー

## 📋 問題

- Render で P3009 エラー: マイグレーション `20260119000000_fix_snspost_week_format` が失敗
- API で P2032 エラー: `SNSPost.week` が String 型を期待しているが、数値（"3"）が保存されている

## ✅ 修正内容

### 1. マイグレーション（最小ロジック版）

**ファイル**: `backend/prisma/migrations/20260119000000_fix_snspost_week_format/migration.sql`

#### 改善点
- 複雑な CTE を削除し、シンプルな関数を使用
- エラーハンドリングを強化
- unique 制約の重複を事前に処理
- 段階的な変換（postedAt → createdAt → now）

#### 主な変更
1. **Step 1**: week フィールドを TEXT 型に正規化（安全な型変換）
2. **Step 2**: 数値のみの week を "YYYY-WWW" 形式に変換
   - `calculate_week_from_date()` 関数を使用
   - postedAt → createdAt → now の優先順位
3. **Step 3**: unique 制約の重複を事前に削除
4. **Step 4**: データ整合性の確認

### 2. バックエンド暫定回避策

#### `backend/src/routes/snsPosts.ts`

**GET /api/sns-posts**
- week が数値形式の場合、文字列に変換して返す

**GET /api/sns-posts/weekly-status**
- week フィールドを select から除外（P2032 エラー回避）

#### `backend/src/jobs/weekendReminder.ts`

**findUnique → findFirst に変更**
- week フィールドの型不一致を回避

## 📝 変更ファイル

1. `backend/prisma/migrations/20260119000000_fix_snspost_week_format/migration.sql` - マイグレーション修正
2. `backend/src/routes/snsPosts.ts` - 暫定回避策追加
3. `backend/src/jobs/weekendReminder.ts` - findUnique → findFirst に変更
4. `LOCAL_MIGRATION_TEST.md` - ローカル検証手順（新規）
5. `MIGRATION_FIX_SUMMARY.md` - 修正サマリー（新規）
6. `DEPLOYMENT_CHECKLIST.md` - デプロイチェックリスト（新規）

## 🧪 ローカル検証手順

詳細は `LOCAL_MIGRATION_TEST.md` を参照。

### 簡易手順

```bash
# 1. テストデータ準備
psql $DATABASE_URL -c "INSERT INTO \"SNSPost\" (...) VALUES (..., '3', ...);"

# 2. マイグレーション実行
cd backend
npx prisma migrate deploy

# 3. 確認
psql $DATABASE_URL -c "SELECT COUNT(*) FROM \"SNSPost\" WHERE week ~ '^[0-9]+$';"
# 期待値: 0

# 4. API テスト
curl http://localhost:3001/api/sns-posts -H "Authorization: Bearer <token>"
```

## 🚀 デプロイ手順

1. **コードをプッシュ**
   ```bash
   git add .
   git commit -m "fix: SNSPost.week 型不一致を修正（最小ロジック版 + 暫定回避策）"
   git push origin main
   ```

2. **Render で自動デプロイ**
   - マイグレーションが自動実行される
   - ログで `RUN MIGRATE` と `MIGRATE DONE` を確認

3. **動作確認**
   - API が正常に動作する
   - P2032 エラーが発生しない

## ✅ 期待される結果

- ✅ マイグレーションが成功する（P3009 エラーが解消）
- ✅ すべての week が "YYYY-WWW" 形式になる
- ✅ API が正常に動作する（P2032 エラーが解消）
- ✅ 既存データに "3" が残っても API が落ちない（暫定回避策により）
