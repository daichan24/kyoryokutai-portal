# メンバー「佐藤大地」を「さとうだいち」に更新する方法

## 方法1: ブラウザのコンソールから実行（推奨・最も簡単）

1. ポータルにログインしている状態で、ブラウザの開発者ツール（F12）を開く
2. 「Console」タブを選択
3. 以下のコードをコピー&ペーストしてEnterキーを押す：

```javascript
// メンバー「佐藤大地」を「さとうだいち」に更新
(async () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      alert('ログインが必要です');
      return;
    }
    
    const response = await fetch('https://kyoryokutai-backend.onrender.com/api/admin/update-member-sato-name', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    const data = await response.json();
    console.log('更新結果:', data);
    
    if (data.success) {
      alert('✅ 更新成功: ' + data.message);
      // ページをリロードして変更を反映
      window.location.reload();
    } else {
      alert('ℹ️ ' + data.message);
    }
  } catch (error) {
    console.error('エラー:', error);
    alert('❌ エラーが発生しました: ' + error.message);
  }
})();
```

**注意:** MASTERロールでログインしている必要があります。

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

