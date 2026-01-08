# Next.js デプロイエラー修正ガイド

このドキュメントでは、Next.jsアプリをRenderでデプロイする際のエラーを修正するための変更を説明します。

## 問題と解決策

### 1. autoprefixer 不足エラー

**問題**: 本番ビルド時にautoprefixerが見つからない

**解決策**: `autoprefixer`を`dependencies`に移動

### 2. @/lib/* @/validations/* module not found

**問題**: TypeScriptのpaths設定が正しく解決されない

**解決策**: `tsconfig.json`の`paths`と`baseUrl`を修正

### 3. tsconfig.json の paths / baseUrl 修正

**問題**: Next.js用の設定が不足している

**解決策**: Next.js推奨の設定に変更

## 変更ファイル

以下のファイルを修正します：

