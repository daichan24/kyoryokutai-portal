# SNS投稿管理 API仕様書

## 概要

SNS投稿管理APIは、組織メンバーのSNS投稿活動を週次で管理・追跡するためのRESTful APIです。

## 認証

すべてのエンドポイントはJWT認証が必要です。

```
Authorization: Bearer <token>
```

## ロール

| ロール | 説明 |
|--------|------|
| MEMBER | 一般メンバー。自分の投稿のみ操作可能 |
| MASTER | 管理者。全ての投稿・アカウントを操作可能 |
| SUPPORT | サポートスタッフ。全投稿の閲覧可能 |
| GOVERNMENT | 行政担当者。全投稿の閲覧可能 |

---

## SNS投稿 API

### GET /api/sns-posts

投稿一覧を取得します。

**クエリパラメータ**

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| userId | string | 特定ユーザーの投稿のみ取得（Staff専用） |
| from | string | 開始日（YYYY-MM-DD） |
| to | string | 終了日（YYYY-MM-DD） |
| week | string | 週キー（YYYY-WNN形式、後方互換性） |
| accountId | string | 特定アカウントの投稿のみ取得 |

**権限**
- MEMBER: 自分の投稿のみ取得可能（userIdパラメータは無視）
- Staff: 全ユーザーの投稿を取得可能

**レスポンス例**

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "userId": "user-id",
    "week": "2024-W03",
    "postedAt": "2024-01-15T03:00:00.000Z",
    "postType": "STORY",
    "accountId": null,
    "url": "https://instagram.com/p/example",
    "note": "投稿メモ",
    "followerCount": 1500,
    "createdAt": "2024-01-15T04:00:00.000Z",
    "updatedAt": "2024-01-15T04:00:00.000Z",
    "user": {
      "id": "user-id",
      "name": "山田太郎"
    }
  }
]
```

---

### GET /api/sns-posts/weekly-status

現在の週の投稿状況を取得します。

**クエリパラメータ**

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| userId | string | 対象ユーザー（省略時は自分） |

**レスポンス例**

```json
{
  "weekStart": "2024-01-15T00:00:00.000Z",
  "weekEnd": "2024-01-22T00:00:00.000Z",
  "hasStory": true,
  "hasFeed": false
}
```

---

### POST /api/sns-posts

投稿を作成または更新（upsert）します。

同じ `userId + week + postType + accountId` の組み合わせが存在する場合は更新します。

**リクエストボディ**

```json
{
  "postedAt": "2024-01-15",
  "postType": "STORY",
  "accountId": null,
  "url": "https://instagram.com/p/example",
  "note": "投稿メモ",
  "followerCount": 1500
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| postedAt | string | ✓ | 投稿日時（ISO 8601 または YYYY-MM-DD） |
| postType | "STORY" \| "FEED" | ✓ | 投稿種別 |
| accountId | string \| null | - | SNSアカウントID（UUID） |
| url | string | - | 投稿URL（空文字列または有効なURL） |
| note | string | - | 備考（最大2000文字） |
| followerCount | number \| null | - | フォロワー数（0〜99,999,999） |

**レスポンス**: 作成または更新された投稿オブジェクト

---

### PUT /api/sns-posts/:id

投稿を更新します（部分更新可能）。

**権限**
- MEMBER: 自分の投稿のみ更新可能
- MASTER: 全ての投稿を更新可能

**レスポンス**: 更新された投稿オブジェクト

---

### DELETE /api/sns-posts/:id

投稿を削除します。

**権限**
- MEMBER: 自分の投稿のみ削除可能
- MASTER: 全ての投稿を削除可能

**レスポンス**

```json
{ "message": "削除しました" }
```

---

## SNSアカウント API

### GET /api/sns-accounts

自分のSNSアカウント一覧を取得します。

**クエリパラメータ**

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| userId | string | 対象ユーザー（Staff専用） |

**レスポンス例**

```json
[
  {
    "id": "account-id",
    "userId": "user-id",
    "platform": "instagram",
    "accountName": "@example",
    "displayName": "Example Account",
    "url": "https://instagram.com/example",
    "isDefault": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

---

### GET /api/sns-accounts/all

全メンバーのSNSアカウント一覧を取得します（Staff専用）。

**権限**: MASTER, SUPPORT, GOVERNMENT

---

### POST /api/sns-accounts

SNSアカウントを作成します。

**リクエストボディ**

```json
{
  "platform": "instagram",
  "accountName": "@example",
  "displayName": "Example Account",
  "url": "https://instagram.com/example",
  "isDefault": false
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| platform | string | ✓ | プラットフォーム名（最大50文字） |
| accountName | string | ✓ | アカウント名（最大200文字） |
| displayName | string \| null | - | 表示名（最大200文字） |
| url | string \| null | - | アカウントURL |
| isDefault | boolean | - | デフォルトアカウントフラグ |

**注意**: 最初のアカウントは自動的にデフォルトになります。`isDefault=true` を指定すると他のアカウントのデフォルトフラグが解除されます。

---

### PUT /api/sns-accounts/:id

SNSアカウントを更新します。

**権限**
- 自分のアカウントのみ更新可能
- MASTER: 全てのアカウントを更新可能

---

### DELETE /api/sns-accounts/:id

SNSアカウントを削除します。

**権限**
- 自分のアカウントのみ削除可能
- MASTER: 全てのアカウントを削除可能

---

## エラーコード

| HTTPステータス | 説明 |
|--------------|------|
| 400 | バリデーションエラー（無効な入力値） |
| 401 | 認証エラー（トークンなし・無効） |
| 403 | 権限エラー（他ユーザーのデータへのアクセス） |
| 404 | リソースが見つからない |
| 500 | サーバーエラー |

**400エラーレスポンス例**

```json
{
  "error": "Validation failed",
  "details": [
    {
      "code": "invalid_enum_value",
      "path": ["postType"],
      "message": "Invalid enum value. Expected 'STORY' | 'FEED', received 'BOTH'"
    }
  ]
}
```
