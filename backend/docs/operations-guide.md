# SNS投稿管理システム 運用ガイド

## データバックアップ手順

### 本番データベースのバックアップ

```bash
# PostgreSQL ダンプ（SNS関連テーブルのみ）
pg_dump $DATABASE_URL \
  -t "SNSPost" \
  -t "SNSAccount" \
  --no-owner \
  --no-acl \
  -f sns_backup_$(date +%Y%m%d).sql
```

### バックアップの確認

```sql
-- 投稿数の確認
SELECT COUNT(*) FROM "SNSPost";

-- アカウント数の確認
SELECT COUNT(*) FROM "SNSAccount";

-- 最新の投稿を確認
SELECT id, "userId", week, "postType", "postedAt"
FROM "SNSPost"
ORDER BY "createdAt" DESC
LIMIT 10;
```

---

## トラブルシューティング

### 問題1: 週キーが正しく計算されない

**症状**: 投稿が間違った週に記録される

**確認方法**:
```sql
SELECT id, "postedAt", week
FROM "SNSPost"
WHERE week NOT LIKE '____-W__'
ORDER BY "createdAt" DESC;
```

**原因と対処**:
- 古い数値形式の週キー（例: `3`）が残っている場合は、マイグレーションで修正
- タイムゾーンの問題の場合は、`postedAt` の値を確認

### 問題2: 同じ週に重複投稿が作成される

**症状**: 同じユーザーの同じ週・同じ種別の投稿が複数存在する

**確認方法**:
```sql
SELECT "userId", week, "postType", COUNT(*) as count
FROM "SNSPost"
GROUP BY "userId", week, "postType"
HAVING COUNT(*) > 1;
```

**対処**: 古いレコードを削除し、unique制約が正しく設定されているか確認

### 問題3: デフォルトアカウントが複数存在する

**症状**: ユーザーのデフォルトアカウントが複数ある

**確認方法**:
```sql
SELECT "userId", COUNT(*) as default_count
FROM "SNSAccount"
WHERE "isDefault" = true
GROUP BY "userId"
HAVING COUNT(*) > 1;
```

**対処**:
```sql
-- 最新のアカウントのみデフォルトに設定
UPDATE "SNSAccount" a
SET "isDefault" = false
WHERE "isDefault" = true
  AND id NOT IN (
    SELECT DISTINCT ON ("userId") id
    FROM "SNSAccount"
    WHERE "isDefault" = true
    ORDER BY "userId", "createdAt" DESC
  );
```

### 問題4: P3009マイグレーションエラー

**症状**: `prisma migrate deploy` が失敗する

**対処**:
```bash
# 失敗したマイグレーションを確認
npx prisma migrate status

# 失敗したマイグレーションを解決済みとしてマーク
npx prisma migrate resolve --applied <migration_name>

# または、ロールバック済みとしてマーク
npx prisma migrate resolve --rolled-back <migration_name>
```

---

## よくある質問

**Q: 投稿を誤って削除してしまいました。復元できますか？**

A: バックアップから復元できます。定期的なバックアップを実施してください。削除前にバックアップがない場合は復元できません。

**Q: メンバーが週次投稿を記録できないと言っています。**

A: 以下を確認してください：
1. 認証トークンが有効か（ログアウト→ログインで更新）
2. `postedAt` の日付が正しい形式か（YYYY-MM-DD または ISO 8601）
3. `postType` が `STORY` または `FEED` か

**Q: スタッフが全メンバーの投稿を見られません。**

A: ユーザーのロールを確認してください。`MASTER`、`SUPPORT`、`GOVERNMENT` のいずれかである必要があります。

**Q: フォロワー数グラフが表示されません。**

A: フォロワー数が記録された投稿が少なくとも1件必要です。投稿記録時にフォロワー数を入力してください。

**Q: 週次ステータスが更新されません。**

A: ページは60秒ごとに自動更新されます。手動で更新する場合はブラウザをリロードしてください。

---

## 監視ポイント

- 投稿作成時のP2002エラー頻度（競合状態の指標）
- 週キー形式の不整合（データ品質の指標）
- APIレスポンスタイム（パフォーマンスの指標）

```bash
# ログからP2002エラーを確認
grep "P2002" /var/log/app.log | tail -20
```
