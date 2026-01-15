# SNSPost.week 型不一致修正サマリー

## 修正内容

### 1. マイグレーション（最小ロジック版）

**ファイル**: `backend/prisma/migrations/20260119000000_fix_snspost_week_format/migration.sql`

#### 変更点
- **Step 1**: week フィールドを TEXT 型に正規化（安全な型変換）
- **Step 2**: 数値のみの week を "YYYY-WWW" 形式に変換
  - postedAt → createdAt → now の優先順位
  - シンプルな関数を使用（複雑な CTE を削除）
- **Step 3**: unique 制約の重複を事前に処理
- **Step 4**: データ整合性の確認

#### 改善点
- エラーハンドリングを強化
- 複雑な CTE を削除してシンプルに
- 関数を使用してロジックを明確化

### 2. バックエンド暫定回避策

#### `backend/src/routes/snsPosts.ts`

**変更箇所 1: GET /api/sns-posts**
```typescript
// 暫定回避: week が数値形式の場合、文字列に変換して返す
const normalizedPosts = posts.map(post => {
  if (post.week && /^[0-9]+$/.test(post.week)) {
    const year = new Date().getFullYear();
    const weekNum = parseInt(post.week, 10);
    return {
      ...post,
      week: `${year}-W${weekNum.toString().padStart(2, '0')}`,
    };
  }
  return post;
});
```

**変更箇所 2: GET /api/sns-posts/weekly-status**
- week フィールドを select から除外（P2032 エラー回避）

#### `backend/src/jobs/weekendReminder.ts`

**変更箇所: findUnique → findFirst**
```typescript
// 暫定回避: week フィールドの型不一致を回避
const snsPost = await prisma.sNSPost.findFirst({
  where: {
    userId: user.id,
    week: thisWeek,
  },
});
```

## ローカル検証手順

詳細は `LOCAL_MIGRATION_TEST.md` を参照。

### 簡易手順

```bash
# 1. テストデータの準備（SQL）
psql $DATABASE_URL -c "INSERT INTO \"SNSPost\" (...) VALUES (..., '3', ...);"

# 2. マイグレーション実行
cd backend
npx prisma migrate deploy

# 3. 確認
psql $DATABASE_URL -c "SELECT week FROM \"SNSPost\" WHERE week ~ '^[0-9]+$';"
# 結果: 0 rows (すべて変換されている)

# 4. API テスト
curl http://localhost:3001/api/sns-posts -H "Authorization: Bearer <token>"
```

## デプロイ手順

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

## 期待される結果

- ✅ マイグレーションが成功する（P3009 エラーが解消）
- ✅ すべての week が "YYYY-WWW" 形式になる
- ✅ API が正常に動作する（P2032 エラーが解消）
- ✅ 既存データに "3" が残っても API が落ちない（暫定回避策により）

