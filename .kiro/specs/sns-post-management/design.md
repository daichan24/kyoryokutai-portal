# Design Document: SNS投稿管理システム

## Overview

SNS投稿管理システムは、組織メンバーのSNS活動を週次で追跡・管理するWebアプリケーションです。React + TypeScriptのフロントエンドとExpress + Prismaのバックエンドで構成され、週単位の投稿記録、複数アカウント管理、フォロワー数追跡、スタッフによる全体閲覧機能を提供します。

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ SNSPosts     │  │ SNSPost      │  │ SNSAccount   │      │
│  │ Page         │  │ DetailModal  │  │ Modal        │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ WeeklyStatus │  │ Follower     │                        │
│  │ Alert        │  │ Graph        │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ REST API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend (Express + Prisma)                  │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ /api/        │  │ /api/        │                        │
│  │ sns-posts    │  │ sns-accounts │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Database (PostgreSQL)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ SNSPost      │  │ SNSAccount   │  │ User         │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Frontend**: React 18, TypeScript, TanStack Query, date-fns
- **Backend**: Express.js, Prisma ORM, Zod validation
- **Database**: PostgreSQL
- **Authentication**: JWT-based authentication middleware

## Components and Interfaces

### Frontend Components

#### SNSPosts Page
メインページコンポーネント。個人タブと閲覧タブを提供。

**Props**: なし（認証情報はuseAuthStoreから取得）

**State**:
- `isAddModalOpen`: boolean - 追加モーダルの表示状態
- `addModalDefaultType`: 'STORY' | 'FEED' - 追加モーダルのデフォルト投稿種別
- `addModalDefaultDate`: string | undefined - 追加モーダルのデフォルト日付
- `editingPost`: SNSPost | null - 編集中の投稿
- `selectedAccountId`: string | null - 選択中のアカウントID
- `isAccountModalOpen`: boolean - アカウント管理モーダルの表示状態
- `editingAccount`: SNSAccount | null - 編集中のアカウント
- `selectedMonth`: string - 月フィルタ（閲覧モード用）
- `selectedUserId`: string - ユーザーフィルタ（閲覧モード用）

**Computed Values**:
- `viewMode`: 'personal' | 'view' - 表示モード（ロールとworkspaceModeから計算）
- `currentMonthSnsStatus`: { story: boolean, feed: boolean } - 今月の投稿状況
- `currentWeekStatus`: MemberStatus[] - 現在の週の全メンバー投稿状況
- `historicalPosts`: SNSPost[] - 過去の投稿（日付降順）
- `availableMonths`: string[] - フィルタ可能な月リスト

#### SNSPostDetailModal
投稿の追加・編集モーダル。

**Props**:
- `isOpen`: boolean - モーダルの表示状態
- `post?`: SNSPost | null - 編集対象の投稿（新規作成時はnull）
- `defaultPostType?`: 'STORY' | 'FEED' - デフォルトの投稿種別
- `defaultPostedDate?`: string - デフォルトの投稿日（YYYY-MM-DD）
- `onClose`: () => void - 閉じる時のコールバック
- `onSaved`: () => void - 保存成功時のコールバック

**State**:
- `postedAt`: string - 投稿日（YYYY-MM-DD形式）
- `postType`: 'STORY' | 'FEED' - 投稿種別
- `url`: string - 投稿URL（任意）
- `note`: string - 備考（任意、最大2000文字）
- `followerCount`: string - フォロワー数（任意）
- `loading`: boolean - 保存処理中フラグ

#### WeeklyStatusAlert
現在の週の投稿状況を表示するアラートコンポーネント。

**Props**: なし

**Query**: `/api/sns-posts/weekly-status` - 60秒ごとに自動更新

**Display Logic**:
- hasStory && hasFeed → 成功メッセージ（緑）
- !hasStory && hasFeed → ストーリーズ未完了警告（黄）
- hasStory && !hasFeed → フィード未完了警告（黄）
- !hasStory && !hasFeed → 両方未完了エラー（赤）

#### FollowerGraph
フォロワー数の推移を折れ線グラフで表示。

**Props**:
- `posts`: Array<{ postedAt: string, followerCount?: number | null, postType: 'STORY' | 'FEED' }> - 投稿データ
- `accountName?`: string - アカウント名（表示用）

**Rendering**:
- SVGで折れ線グラフを描画
- X軸: 日付（M/d形式）
- Y軸: フォロワー数（3段階の目盛り）
- データポイント: FEED=青、STORY=紫の円
- グリッド線: 破線で3本

#### SNSAccountModal
SNSアカウントの追加・編集・削除を行うモーダル。

**Props**:
- `isOpen`: boolean - モーダルの表示状態
- `account?`: SNSAccount | null - 編集対象のアカウント
- `onClose`: () => void - 閉じる時のコールバック
- `onSaved`: () => void - 保存成功時のコールバック

### Backend API Endpoints

#### GET /api/sns-posts
投稿一覧を取得。

**Query Parameters**:
- `userId?`: string - 特定ユーザーの投稿のみ取得
- `from?`: string - 開始日（YYYY-MM-DD）
- `to?`: string - 終了日（YYYY-MM-DD）
- `week?`: string - 週キー（YYYY-WW形式、後方互換性）
- `accountId?`: string - 特定アカウントの投稿のみ取得

**Response**: SNSPost[]

**Authorization**:
- MEMBERは自分の投稿のみ取得可能
- Staffは全ユーザーの投稿を取得可能

#### GET /api/sns-posts/weekly-status
現在の週の投稿状況を取得。

**Query Parameters**:
- `userId?`: string - 対象ユーザー（省略時は自分）

**Response**:
```typescript
{
  weekStart: string;  // ISO 8601
  weekEnd: string;    // ISO 8601
  hasStory: boolean;
  hasFeed: boolean;
}
```

#### POST /api/sns-posts
投稿を作成または更新（upsert）。

**Request Body**:
```typescript
{
  postedAt: string;           // ISO日時 or YYYY-MM-DD
  postType: 'STORY' | 'FEED';
  accountId?: string | null;
  url?: string;
  note?: string;
  followerCount?: number | null;
}
```

**Logic**:
1. postedAtから週キー（weekKey）を計算
2. userId + week + postType + accountIdで既存レコードを検索
3. 存在する場合はIDベースで更新
4. 存在しない場合は新規作成
5. P2002エラー（unique制約違反）時は再検索して更新

**Response**: SNSPost

#### PUT /api/sns-posts/:id
投稿を更新。

**Request Body**: POST /api/sns-postsと同じ（部分更新可能）

**Authorization**:
- MEMBERは自分の投稿のみ更新可能
- MASTERは全ての投稿を更新可能

**Response**: SNSPost

#### DELETE /api/sns-posts/:id
投稿を削除。

**Authorization**:
- MEMBERは自分の投稿のみ削除可能
- MASTERは全ての投稿を削除可能

**Response**: { message: string }

#### GET /api/sns-accounts
自分のSNSアカウント一覧を取得。

**Query Parameters**:
- `userId?`: string - 対象ユーザー（Staffのみ指定可能）

**Response**: SNSAccount[]

#### GET /api/sns-accounts/all
全メンバーのSNSアカウント一覧を取得（Staff専用）。

**Authorization**: MASTER, SUPPORT, GOVERNMENT

**Response**: SNSAccount[] (userオブジェクトを含む)

#### POST /api/sns-accounts
SNSアカウントを作成。

**Request Body**:
```typescript
{
  platform: string;           // 最大50文字
  accountName: string;        // 最大200文字
  displayName?: string | null;
  url?: string | null;
  isDefault?: boolean;
}
```

**Logic**:
1. isDefault=trueの場合、他のアカウントのisDefaultをfalseに設定
2. 最初のアカウントは自動的にisDefault=true

**Response**: SNSAccount

#### PUT /api/sns-accounts/:id
SNSアカウントを更新。

**Authorization**:
- 自分のアカウントのみ更新可能
- MASTERは全てのアカウントを更新可能

**Response**: SNSAccount

#### DELETE /api/sns-accounts/:id
SNSアカウントを削除。

**Authorization**:
- 自分のアカウントのみ削除可能
- MASTERは全てのアカウントを削除可能

**Response**: { message: string }

## Data Models

### SNSPost

```typescript
interface SNSPost {
  id: string;              // UUID
  userId: string;          // 投稿者のユーザーID
  week: string;            // 週キー（YYYY-WW形式）
  postedAt: Date;          // 投稿日時（UTC）
  postType: 'STORY' | 'FEED';
  accountId?: string | null;  // 関連するSNSアカウントID
  url?: string | null;     // 投稿URL
  note?: string | null;    // 備考（最大2000文字）
  followerCount?: number | null;  // フォロワー数（0-99,999,999）
  createdAt: Date;
  updatedAt: Date;
  user?: User;             // リレーション
  account?: SNSAccount;    // リレーション
}
```

**Unique Constraint**: (userId, week, postType, accountId)

**Indexes**:
- userId + week（検索用）
- postedAt（日付範囲検索用）

### SNSAccount

```typescript
interface SNSAccount {
  id: string;              // UUID
  userId: string;          // 所有者のユーザーID
  platform: string;        // プラットフォーム名（最大50文字）
  accountName: string;     // アカウント名（最大200文字）
  displayName?: string | null;  // 表示名（最大200文字）
  url?: string | null;     // アカウントURL
  isDefault: boolean;      // デフォルトアカウントフラグ
  createdAt: Date;
  updatedAt: Date;
  user?: User;             // リレーション
}
```

**Indexes**:
- userId（検索用）
- userId + isDefault（デフォルトアカウント検索用）

### Week Boundary Calculation

週の境界は月曜日9:00 JST（UTC 0:00）で計算されます。

```typescript
// 週の開始・終了を取得
function getCurrentWeekBoundary(): { weekStart: Date, weekEnd: Date } {
  const now = new Date();
  const jstOffset = 9 * 60; // JST = UTC+9
  const jstNow = new Date(now.getTime() + jstOffset * 60 * 1000);
  
  // 月曜日9:00 JSTを見つける
  const dayOfWeek = jstNow.getUTCDay();
  const hourOfDay = jstNow.getUTCHours();
  
  let daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  if (dayOfWeek === 1 && hourOfDay < 9) {
    daysToMonday = -7;
  }
  
  const weekStart = new Date(jstNow);
  weekStart.setUTCDate(jstNow.getUTCDate() + daysToMonday);
  weekStart.setUTCHours(0, 0, 0, 0);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekStart.getUTCDate() + 7);
  
  return { weekStart, weekEnd };
}

// 週キーを生成（YYYY-WW形式）
function getWeekKey(date: Date): string {
  const { weekStart } = getWeekBoundaryForDate(date);
  const year = weekStart.getUTCFullYear();
  const weekNumber = getWeekNumber(weekStart);
  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Week Boundary Consistency
*For any* date and time, calculating the week boundary and then calculating it again for any time within that week should produce the same week key.

**Validates: Requirements 1.2**

### Property 2: Post Type Independence
*For any* user and week, creating a STORY post should not affect the ability to create a FEED post, and vice versa.

**Validates: Requirements 2.4**

### Property 3: Default Account Uniqueness
*For any* user, after setting an account as default, exactly one account for that user should have isDefault=true.

**Validates: Requirements 3.2, 3.3**

### Property 4: First Account Default
*For any* user with zero accounts, creating their first account should result in that account having isDefault=true.

**Validates: Requirements 3.4**

### Property 5: Weekly Status Completeness
*For any* user and week, if at least one STORY post and at least one FEED post exist within the week boundaries, the weekly status should indicate both types as complete.

**Validates: Requirements 4.2, 4.3, 4.4, 4.5**

### Property 6: Follower Count Validation
*For any* follower count input, if it contains only digits and optional commas, and the numeric value is between 0 and 99,999,999, it should be accepted and stored.

**Validates: Requirements 5.2, 5.3**

### Property 7: Date Range Filtering
*For any* date range (from, to), all returned posts should have postedAt >= from AND postedAt <= to (end of day).

**Validates: Requirements 8.1, 8.2, 8.3**

### Property 8: Upsert Idempotence
*For any* post data with the same userId, week, postType, and accountId, calling the create endpoint multiple times should result in exactly one post record with the latest data.

**Validates: Requirements 10.1, 10.2**

### Property 9: Authorization Boundary
*For any* MEMBER user, attempting to edit or delete another user's post should be rejected with a 403 error.

**Validates: Requirements 9.4, 9.5**

### Property 10: Week Recalculation on Date Change
*For any* post, if the postedAt date is changed to a date in a different week, the week field should be updated to match the new week.

**Validates: Requirements 9.2**

### Property 11: URL Validation
*For any* URL input, if it is empty string or a valid URL format, it should be accepted; otherwise it should be rejected.

**Validates: Requirements 10.4**

### Property 12: Note Length Limit
*For any* note input, if its length exceeds 2000 characters, it should be rejected.

**Validates: Requirements 10.5**

### Property 13: Month Status Calculation
*For any* user and month, if at least one post of a given type exists with postedAt within the month boundaries, the month status for that type should be true.

**Validates: Requirements 11.2, 11.3, 11.4, 11.5**

### Property 14: Fiscal Year Month Inclusion
*For any* current date, the available months list should include all months from the current fiscal year (April to March) plus the previous fiscal year's last 3 months.

**Validates: Requirements 12.1, 12.2**

## Error Handling

### Validation Errors (400)
- Invalid date format in postedAt
- Invalid postType (not STORY or FEED)
- Invalid URL format
- Note exceeding 2000 characters
- Follower count outside valid range (0-99,999,999)
- Missing required fields

### Authorization Errors (403)
- MEMBER attempting to access other users' data
- Non-staff attempting to access staff-only endpoints
- User attempting to modify another user's posts or accounts

### Not Found Errors (404)
- Post ID not found
- Account ID not found

### Conflict Errors (409)
- Handled internally via upsert logic (P2002 errors)

### Server Errors (500)
- Database connection failures
- Unexpected errors during upsert retry logic
- Prisma query failures

## Testing Strategy

### Unit Testing
- Week boundary calculation functions
- Week key generation
- Date parsing (YYYY-MM-DD vs ISO format)
- Follower count validation and formatting
- URL validation
- Authorization checks
- Fiscal year month calculation

### Property-Based Testing
Each correctness property should be implemented as a property-based test with minimum 100 iterations. Tests should be tagged with:

**Feature: sns-post-management, Property {number}: {property_text}**

Example:
```typescript
// Feature: sns-post-management, Property 1: Week Boundary Consistency
test('week boundary consistency', () => {
  fc.assert(
    fc.property(fc.date(), (date) => {
      const { weekStart, weekEnd } = getWeekBoundaryForDate(date);
      const randomTimeInWeek = new Date(
        weekStart.getTime() + Math.random() * (weekEnd.getTime() - weekStart.getTime())
      );
      const weekKey1 = getWeekKey(date);
      const weekKey2 = getWeekKey(randomTimeInWeek);
      expect(weekKey1).toBe(weekKey2);
    }),
    { numRuns: 100 }
  );
});
```

### Integration Testing
- POST /api/sns-posts upsert logic with concurrent requests
- Default account flag management across multiple operations
- Weekly status calculation with various post combinations
- Date range filtering with edge cases (month boundaries, year boundaries)
- Authorization enforcement across all endpoints

### End-to-End Testing
- Complete user flow: create account → record posts → view weekly status
- Staff flow: browse all members → filter by month/user → view details
- Multi-account flow: create multiple accounts → set default → filter by account
- Follower tracking flow: record posts with follower counts → view graph
