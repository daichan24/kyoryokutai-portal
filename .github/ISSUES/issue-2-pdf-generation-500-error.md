# [RESOLVED] PDF生成時の500エラー

## 問題の概要
視察記録、週次報告、月次報告のPDF出力時に、頻繁に500 Internal Server Errorが発生していました。

## エラーの詳細
- **発生箇所**: `backend/src/routes/inspections.ts`, `backend/src/routes/weeklyReports.ts`, `backend/src/routes/monthlyReports.ts`
- **エラーメッセージ**: `Request failed with status code 500`
- **症状**: PDF出力ボタンを押すと毎回「PDF出力に失敗しました」と表示される

## 原因
1. PDF生成時のエラーハンドリングが不十分で、具体的なエラー内容がフロントエンドに伝わっていなかった
2. `puppeteer`のタイムアウト設定が短すぎた可能性
3. PDF生成時にユーザー情報が存在しない場合のエラーハンドリングが不足していた

## 解決方法

### 1. エラーハンドリングの強化
- バックエンドで詳細なエラーメッセージを返すように修正
- フロントエンドでJSONエラーレスポンスをパースして表示

```typescript
// バックエンド例
catch (error: any) {
  console.error('PDF generation error:', error);
  return res.status(500).json({
    error: 'Failed to generate PDF',
    details: error.message || 'Unknown error'
  });
}

// フロントエンド例
catch (error: any) {
  const errorMessage = error.response?.data?.details || error.response?.data?.error || 'PDF出力に失敗しました';
  alert(errorMessage);
}
```

### 2. タイムアウト設定の調整
```typescript
// backend/src/services/pdfGenerator.ts
timeout: 60000, // 60秒に延長
```

### 3. ユーザー情報の存在確認
```typescript
if (!inspection.user?.name) {
  throw new Error('User information is missing');
}
```

## 関連コミット
- `fix: PDF生成時のエラーハンドリングを改善`
- `fix: PDF生成サービスのタイムアウトを延長`

## ラベル
`bug`, `backend`, `pdf-generation`, `puppeteer`, `resolved`

