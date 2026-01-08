# Next.js デプロイ設定ガイド

このドキュメントでは、Next.jsアプリをRenderでデプロイするための設定変更を説明します。

## 変更内容の概要

以下のファイルを修正・作成します：

1. `package.json` - Next.js依存関係とスクリプトの追加
2. `tsconfig.json` - Next.js用のTypeScript設定
3. `next.config.js` - Next.js設定ファイル
4. `postcss.config.js` - autoprefixer設定の確認
5. ディレクトリ構造の整理（`src/app/`, `src/lib/`, `src/validations/`）

## 変更ファイル一覧

### 1. package.json
- Next.js関連の依存関係を追加
- autoprefixerをdependenciesに移動（本番ビルドで必要）
- ビルド・起動スクリプトをNext.js用に変更

### 2. tsconfig.json
- Next.js用の設定に変更
- paths設定を修正（`@/*` → `./src/*`）
- baseUrlを適切に設定

### 3. next.config.js（新規作成）
- Next.jsの設定ファイル

### 4. postcss.config.js
- autoprefixer設定の確認

### 5. ディレクトリ構造
- `src/lib/` ディレクトリの作成（必要に応じて）
- `src/validations/` ディレクトリの作成（必要に応じて）

