# マイグレーション問題の根本対応

## 現状の問題点

### 1. DB接続不安定（P1001: Can't reach database server）
- Render Free Tierの制限により、非アクティブ時にDBが停止
- 起動時の接続タイミングによってエラーが変化
- migrate resolve/deploy実行前にDB接続が確立されていない

### 2. start commandで毎回大量のmigrate resolve
```json
"start:prod:fix-timeadjustment": "echo 'RESOLVE EXISTING MIGRATIONS' && npx prisma migrate resolve --applied 20260123000000_add_event_updated_by 2>/dev/null; ... (30個以上のresolve) ..."
```

**問題点:**
- 起動時に30個以上のresolveコマンドを実行
- 各resolveでDB接続が必要
- 接続不安定時にエラーが変化する原因
- デプロイごとに同じresolveを繰り返す（無駄）

### 3. add_handover migrationのupdatedAt NULL問題
- 修正済みだが、失敗したマイグレーションがDB上に残っている
- `_prisma_migrations`テーブルに失敗レコードが存在
- 新しいマイグレーションが適用されない

## 根本対応策

### 対応1: DB接続確認スクリプトの追加

起動前にDB接続を確認し、接続が確立されるまで待機する。

**新規ファイル:** `backend/scripts/wait-for-db.ts`

### 対応2: migrate resolveの一括実行スクリプト化

毎回resolveするのではなく、必要な時だけ実行する専用スクリプトを作成。

**新規ファイル:** `backend/scripts/resolve-migrations.ts`

### 対応3: start commandのシンプル化

通常起動では`prisma migrate deploy`のみ実行。
resolveが必要な場合は専用スクリプトを手動実行。

**修正ファイル:** `backend/package.json`

### 対応4: 失敗したマイグレーションの手動解決手順

Render Shellから直接実行する手順を明確化。

**新規ファイル:** `RENDER_SHELL_FIX.md`

## 実装の優先順位

1. **即座に実施（緊急）**: Render Shellから失敗したマイグレーションを解決
2. **短期（今回のデプロイ）**: start commandをシンプル化
3. **中期（次回以降）**: DB接続確認スクリプトの追加
4. **長期（運用改善）**: マイグレーション管理の自動化

## 次のステップ

1. Render Shellで失敗したマイグレーションを解決
2. package.jsonのstart commandを修正
3. 再デプロイ
4. DB接続確認スクリプトを追加（次回以降）
