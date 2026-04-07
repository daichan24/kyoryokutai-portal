# スケジュール編集エラー修正

## 概要
スケジュール画面からタスクを編集する際に「保存に失敗しました: [object Object]」というエラーが表示される問題を修正しました。

## 修正内容

### 1. フロントエンド - エラーハンドリングの改善
**ファイル**: `frontend/src/components/project/TaskModal.tsx`

#### 変更点:
- エラーオブジェクトを適切に文字列化するロジックを追加
- エラーレスポンスの構造に応じて適切なメッセージを抽出
- スケジュール更新時のバリデーションを強化
- デバッグ用のコンソールログを追加

```typescript
// 修正前
const errorMessage = err.response?.data?.error 
  || err.response?.data?.message 
  || err.message 
  || JSON.stringify(err.response?.data || err);

// 修正後
let errorMessage = 'エラーが発生しました';

if (err.response?.data) {
  if (typeof err.response.data === 'string') {
    errorMessage = err.response.data;
  } else if (err.response.data.error) {
    errorMessage = err.response.data.error;
  } else if (err.response.data.message) {
    errorMessage = err.response.data.message;
  } else {
    try {
      errorMessage = JSON.stringify(err.response.data);
    } catch {
      errorMessage = 'サーバーエラーが発生しました';
    }
  }
} else if (err.message) {
  errorMessage = err.message;
}
```

#### スケジュール更新時のバリデーション強化:
```typescript
// 日付のバリデーション
if (!dueDate) { alert('開始日を入力してください'); setLoading(false); return; }
if (!endDate) { alert('終了日を入力してください'); setLoading(false); return; }
if (endDate < dueDate) { 
  alert('終了日は開始日以降の日付を指定してください'); 
  setLoading(false); 
  return; 
}
```

### 2. バックエンド - エラーレスポンスの改善
**ファイル**: `backend/src/routes/schedules.ts`

#### 変更点:
- Zodバリデーションエラーのメッセージをより分かりやすく
- Prismaエラーの詳細を含めるように修正
- エラーメッセージを日本語化

```typescript
// 修正前
if (error instanceof z.ZodError) {
  return res.status(400).json({ error: 'バリデーションエラー', details: error.errors });
}
res.status(500).json({ 
  error: 'Failed to update schedule', 
  message: error instanceof Error ? error.message : String(error) 
});

// 修正後
if (error instanceof z.ZodError) {
  return res.status(400).json({ 
    error: 'バリデーションエラー', 
    details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
  });
}

// Prismaエラーの詳細を返す
if (error && typeof error === 'object' && 'code' in error) {
  const prismaError = error as any;
  return res.status(500).json({ 
    error: 'データベースエラー',
    message: prismaError.message || 'データベース操作に失敗しました',
    code: prismaError.code
  });
}

res.status(500).json({ 
  error: 'スケジュールの更新に失敗しました', 
  message: error instanceof Error ? error.message : String(error) 
});
```

## テスト方法

### 1. 正常系のテスト
1. スケジュール画面を開く
2. 既存のスケジュールをクリック
3. 時間を変更（例: 09:00-10:00 → 10:00-11:00）
4. 保存ボタンをクリック
5. 正常に保存されることを確認

### 2. エラー系のテスト
1. スケジュール画面を開く
2. 既存のスケジュールをクリック
3. 場所を空にする
4. 保存ボタンをクリック
5. 「場所を入力してください」というエラーメッセージが表示されることを確認

### 3. バリデーションのテスト
1. スケジュール画面を開く
2. 既存のスケジュールをクリック
3. 終了日を開始日より前の日付に変更
4. 保存ボタンをクリック
5. 「終了日は開始日以降の日付を指定してください」というエラーメッセージが表示されることを確認

## 影響範囲
- スケジュール編集機能
- タスク編集機能（同じモーダルを使用）
- エラーメッセージの表示

## 注意事項
- この修正により、エラーメッセージがより詳細に表示されるようになります
- デバッグ用のコンソールログが追加されているため、本番環境では適宜削除してください
- バリデーションが強化されているため、既存のデータに不整合がある場合はエラーが表示される可能性があります

## 次のステップ
1. 開発環境でテストを実施
2. 問題がなければステージング環境にデプロイ
3. 本番環境にデプロイ
4. ユーザーからのフィードバックを収集
