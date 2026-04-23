# 本番環境への順番入れ替え機能の反映（クイックガイド）

## 最も簡単な方法：Renderダッシュボードから実行

### ステップ1: Renderにログイン

1. https://dashboard.render.com にアクセス
2. ログイン

### ステップ2: バックエンドサービスのShellを開く

1. 左サイドバーから「Services」をクリック
2. バックエンドサービス（`kyoryokutai-backend`など）をクリック
3. 右上の「Shell」ボタンをクリック

### ステップ3: マイグレーションを実行

Shellに以下のコマンドを入力：

```bash
# マイグレーションを実行
npx prisma migrate deploy

# Prismaクライアントを再生成
npx prisma generate
```

### ステップ4: サービスを再起動

1. Shellを閉じる
2. 「Manual Deploy」タブをクリック
3. 「Deploy latest commit」ボタンをクリック

### ステップ5: 確認

1. 本番環境のURLにアクセス
2. ログイン
3. プロジェクト一覧ページを開く
4. 右上のモード切替で「個人」を選択
5. 各プロジェクトカードの右上に上下矢印ボタンが表示されることを確認

## 代替方法：Renderの環境変数を使用

Renderのサービス設定で、Start Commandを以下に変更：

```bash
npx prisma migrate deploy && npm start
```

これにより、サービス起動時に自動的にマイグレーションが実行されます。

### 設定手順

1. Renderダッシュボード → バックエンドサービス
2. 「Settings」タブをクリック
3. 「Build & Deploy」セクションを探す
4. 「Start Command」を編集：
   ```bash
   npx prisma migrate deploy && npm start
   ```
5. 「Save Changes」をクリック
6. サービスが自動的に再デプロイされます

## トラブルシューティング

### 問題: 上下矢印ボタンが表示されない

**原因1: キャッシュ**
- ブラウザのキャッシュをクリア
- Ctrl+Shift+R（Windows）または Cmd+Shift+R（Mac）でハードリロード

**原因2: モードが「閲覧」になっている**
- 右上のモード切替で「個人」を選択

**原因3: フロントエンドが更新されていない**
- Renderのフロントエンドサービスも再デプロイ

### 問題: マイグレーションエラー

**エラー: "Migration already applied"**
```bash
# マイグレーション状態を確認
npx prisma migrate status
```

**エラー: "Column already exists"**
```bash
# マイグレーションを既に適用済みとしてマーク
npx prisma migrate resolve --applied 20260423000000_add_project_order
```

## 確認コマンド

マイグレーションが正しく適用されたか確認：

```bash
# Renderのシェルで実行
npx prisma migrate status
```

期待される出力：
```
Database schema is up to date!
```

## 注意事項

- マイグレーションは本番データベースを変更します
- 実行前にバックアップを取ることを推奨します
- ピーク時間を避けて実行することを推奨します

## 完了後の確認項目

✅ プロジェクト一覧で上下矢印ボタンが表示される
✅ ミッション一覧で上下矢印ボタンが表示される（デフォルトミッション以外）
✅ タスク一覧で上下矢印ボタンが表示される
✅ 矢印ボタンをクリックして順番が変更できる
✅ TaskModalでミッション選択時にプロジェクトがフィルタリングされる
