# メンバー「佐藤大地」を「さとうだいち」に更新する方法

## 方法1: APIエンドポイントを使用（推奨）

ブラウザのコンソール（開発者ツール）から以下のコードを実行してください：

```javascript
// ログインしている状態で実行
fetch('/api/admin/update-member-sato-name', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
})
.then(res => res.json())
.then(data => {
  console.log('更新結果:', data);
  if (data.success) {
    alert('更新成功: ' + data.message);
    // ページをリロードして変更を反映
    window.location.reload();
  } else {
    alert('更新失敗: ' + data.message);
  }
})
.catch(error => {
  console.error('エラー:', error);
  alert('エラーが発生しました: ' + error.message);
});
```

## 方法2: curlコマンドを使用

```bash
# トークンを取得してから実行
curl -X POST https://kyoryokutai-backend.onrender.com/api/admin/update-member-sato-name \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## 方法3: seed.tsを実行

本番環境でseed.tsを実行する場合：

```bash
cd backend
DATABASE_URL="your_production_database_url" npm run seed
```

**注意:** seed.tsは既存のデータを削除する可能性があるため、注意して実行してください。

## 実行後の確認

更新後、以下の点を確認してください：

1. ユーザー管理画面でメンバー「さとうだいち」が表示されること
2. すべての画面で「さとうだいち」と表示されること
3. マスターの「佐藤大地」とは別のユーザーとして認識されること

