# カレンダー日付表示の修正

## 問題
カレンダーの日付に「日」が表示され、数字のサイズが大きい

## 原因
1. FullCalendarの日本語ロケール（`locale="ja"`）が自動的に「日」を追加
2. CSSの詳細度が不足してスタイルが適用されない可能性
3. Render.comのCDNキャッシュにより古いCSSが配信される

## 実施した修正

### 1. FullCalendarコンポーネントの修正
`frontend/src/components/schedule/DraggableCalendarView.tsx`

```tsx
dayCellContent={(arg) => {
  // 日付の数字のみを表示（「日」を削除）
  return arg.dayNumberText.replace('日', '');
}}
```

この設定により、FullCalendarが生成する日付テキストから「日」を削除します。

### 2. CSSの詳細度を強化
`frontend/src/index.css`

```css
/* カレンダーの日付を中央揃え */
.fc-daygrid-day-number,
.fc .fc-daygrid-day-number {
  @apply text-center w-full;
  padding: 4px 0 !important;
  justify-content: center !important;
  font-size: 0.875rem !important; /* 数字のサイズを小さく (14px) */
}
```

セレクタを追加して詳細度を上げ、確実にスタイルが適用されるようにしました。

## デプロイ手順

### Render.comでの反映方法

1. **コミット＆プッシュ**
   ```bash
   git add .
   git commit -m "fix: カレンダー日付表示から「日」を削除し、数字サイズを縮小"
   git push origin main
   ```

2. **Render.comで自動デプロイ**
   - Render.comは自動的に新しいビルドを開始します
   - ビルドログで確認：`npm run build`が実行される

3. **キャッシュクリア（重要）**
   
   デプロイ後、以下の方法でキャッシュをクリアしてください：
   
   a. **ブラウザのハードリフレッシュ**
      - Chrome/Edge: `Ctrl+Shift+R` (Windows) / `Cmd+Shift+R` (Mac)
      - Firefox: `Ctrl+F5` (Windows) / `Cmd+Shift+R` (Mac)
      - Safari: `Cmd+Option+R`
   
   b. **ブラウザのキャッシュクリア**
      - 開発者ツール（F12）を開く
      - Network タブを開く
      - 「Disable cache」にチェック
      - ページをリロード
   
   c. **Render.comのCDNキャッシュ**
      - Render.comのダッシュボードで「Clear Build Cache」を実行
      - または、ビルドコマンドに`rm -rf node_modules dist`が含まれているため、自動的にクリーンビルドされます

4. **確認方法**
   - ブラウザの開発者ツール（F12）を開く
   - Elements タブで `.fc-daygrid-day-number` を検索
   - Computed スタイルで `font-size: 14px` (0.875rem) が適用されているか確認
   - 日付に「日」が表示されていないことを確認

## ビルドの確認

Viteのビルド設定により、CSSファイルにはハッシュが付与されます：
```
assets/[name].[hash].css
```

これにより、新しいビルドでは異なるファイル名が生成され、ブラウザキャッシュの問題を回避できます。

## トラブルシューティング

### それでも反映されない場合

1. **ビルドログを確認**
   - Render.comのダッシュボードでビルドログを確認
   - エラーがないか確認

2. **ローカルでビルドテスト**
   ```bash
   cd frontend
   npm run build
   npm run preview
   ```
   - ローカルのプロダクションビルドで動作確認

3. **CSSが正しく読み込まれているか確認**
   - ブラウザの開発者ツールで Network タブを開く
   - CSSファイルが200 OKで読み込まれているか確認
   - CSSファイルの内容に修正が含まれているか確認

4. **Render.comの設定確認**
   - `render.yaml`の`buildCommand`が正しいか確認
   - 環境変数が正しく設定されているか確認

## 期待される結果

- カレンダーの日付から「日」が削除される
- 日付の数字が約14px（0.875rem）のサイズで表示される
- 月表示、週表示、日表示すべてで適用される
