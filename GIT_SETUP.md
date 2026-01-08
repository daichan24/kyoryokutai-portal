# Git設定とプッシュ手順

## 現在の状態

✅ Gitリポジトリを初期化しました
✅ 変更をコミットしました

## 次のステップ：GitHubリポジトリにプッシュ

### オプション1: 既存のGitHubリポジトリがある場合

1. GitHubでリポジトリのURLをコピー（例: `https://github.com/username/kyoryokutai-portal.git`）

2. 以下のコマンドを実行：

```bash
cd /Users/satoudaichi/Downloads/07.Cursor/kyoryokutai-portal

# リモートリポジトリを追加
git remote add origin https://github.com/username/kyoryokutai-portal.git

# プッシュ
git push -u origin main
```

**注意**: `username`と`kyoryokutai-portal`を実際のリポジトリ名に置き換えてください。

### オプション2: 新しいGitHubリポジトリを作成する場合

1. [GitHub](https://github.com)にログイン
2. **New repository** をクリック
3. リポジトリ名を入力（例: `kyoryokutai-portal`）
4. **Public** または **Private** を選択
5. **Initialize this repository with a README** は**チェックしない**
6. **Create repository** をクリック
7. 表示されたURLをコピー（例: `https://github.com/username/kyoryokutai-portal.git`）

8. 以下のコマンドを実行：

```bash
cd /Users/satoudaichi/Downloads/07.Cursor/kyoryokutai-portal

# リモートリポジトリを追加
git remote add origin https://github.com/username/kyoryokutai-portal.git

# プッシュ
git push -u origin main
```

### オプション3: CursorのGit機能を使用する場合

1. Cursorの左サイドバーで**Source Control**アイコンをクリック
2. **Publish Branch** または **Push** ボタンをクリック
3. リモートリポジトリのURLを入力（新規作成する場合は自動的に作成されます）

## エラーが発生した場合

### エラー: "remote origin already exists"

既存のリモートリポジトリがある場合：

```bash
# 既存のリモートを確認
git remote -v

# 既存のリモートを削除（必要に応じて）
git remote remove origin

# 新しいリモートを追加
git remote add origin https://github.com/username/kyoryokutai-portal.git
```

### エラー: "failed to push some refs"

リモートリポジトリに既存のコミットがある場合：

```bash
# リモートの変更を取得
git pull origin main --allow-unrelated-histories

# 再度プッシュ
git push -u origin main
```

### エラー: "authentication failed"

GitHubの認証が必要な場合：

1. **Personal Access Token**を使用する方法：
   - GitHub > Settings > Developer settings > Personal access tokens > Tokens (classic)
   - **Generate new token** をクリック
   - `repo`スコープを選択
   - トークンをコピー
   - プッシュ時にパスワードの代わりにトークンを入力

2. **SSHキーを使用する方法**：
   ```bash
   # SSH URLを使用
   git remote set-url origin git@github.com:username/kyoryokutai-portal.git
   git push -u origin main
   ```

## プッシュ後の確認

プッシュが成功したら：

1. GitHubのリポジトリページを開く
2. `backend/package.json`を確認して、`prisma`が`dependencies`にあることを確認
3. Renderで再デプロイを実行

## Renderでの再デプロイ

プッシュが完了したら、Renderで：

1. バックエンドの設定ページを開く
2. **Manual Deploy** > **Deploy latest commit** をクリック
3. デプロイが成功するまで待つ

