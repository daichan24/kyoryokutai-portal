# Requirements Document

## Introduction

SNS投稿管理機能は、組織メンバーのSNS投稿活動を週次で管理・追跡するシステムです。各メンバーは週ごとにストーリーズとフィード投稿を記録し、スタッフは全メンバーの投稿状況を閲覧できます。複数のSNSアカウントに対応し、フォロワー数の推移も追跡可能です。

## Glossary

- **System**: SNS投稿管理システム全体
- **Member**: 投稿を記録する一般メンバー
- **Staff**: MASTER、SUPPORT、GOVERNMENT権限を持つ管理者
- **SNS_Post**: SNS投稿の記録（日付、種別、URL、備考、フォロワー数を含む）
- **Post_Type**: 投稿種別（STORY=ストーリーズ、FEED=フィード投稿）
- **Week**: 月曜日9:00 JST起算の週単位期間
- **SNS_Account**: ユーザーが登録したSNSアカウント情報
- **Weekly_Status**: 現在の週における投稿完了状況
- **Follower_Count**: 投稿時点でのフォロワー数

## Requirements

### Requirement 1: 週次投稿記録管理

**User Story:** As a Member, I want to record my SNS posts by week, so that I can track my posting activity and meet weekly posting requirements.

#### Acceptance Criteria

1. WHEN a Member creates a post record, THE System SHALL store the posted date, post type, optional URL, optional note, and optional follower count
2. WHEN determining the week for a post, THE System SHALL use Monday 9:00 JST as the week boundary
3. WHEN a Member records a post with only a date (YYYY-MM-DD), THE System SHALL interpret it as JST noon (12:00) for week calculation
4. WHEN a Member views their posting history, THE System SHALL display posts sorted by date in descending order
5. WHEN a Member records multiple posts of the same type in the same week, THE System SHALL allow multiple records

### Requirement 2: 投稿種別管理

**User Story:** As a Member, I want to distinguish between story and feed posts, so that I can track different types of posting requirements separately.

#### Acceptance Criteria

1. THE System SHALL support two post types: STORY and FEED
2. WHEN displaying post records, THE System SHALL visually distinguish between STORY and FEED posts
3. WHEN a Member creates a post record, THE System SHALL require selection of exactly one post type
4. WHEN calculating weekly status, THE System SHALL track STORY and FEED completion independently

### Requirement 3: 複数SNSアカウント対応

**User Story:** As a Member, I want to manage multiple SNS accounts, so that I can track posts across different platforms or accounts.

#### Acceptance Criteria

1. WHEN a Member creates an SNS account, THE System SHALL store platform, account name, optional display name, optional URL, and default flag
2. WHEN a Member has multiple accounts, THE System SHALL allow designation of one account as default
3. WHEN a Member sets an account as default, THE System SHALL automatically unset the default flag on other accounts
4. WHEN a Member creates their first account, THE System SHALL automatically set it as default
5. WHEN a Member views their posts, THE System SHALL allow filtering by specific account or viewing all accounts
6. WHEN a Member records a post, THE System SHALL optionally associate it with a specific account

### Requirement 4: 週次ステータス表示

**User Story:** As a Member, I want to see my current week's posting status, so that I know if I have completed my weekly posting requirements.

#### Acceptance Criteria

1. WHEN a Member views the SNS post page, THE System SHALL display an alert showing current week status
2. WHEN both STORY and FEED posts exist for the current week, THE System SHALL display a success message
3. WHEN only STORY posts exist for the current week, THE System SHALL display a warning about missing FEED posts
4. WHEN only FEED posts exist for the current week, THE System SHALL display a warning about missing STORY posts
5. WHEN neither STORY nor FEED posts exist for the current week, THE System SHALL display an error message
6. THE System SHALL refresh weekly status every 60 seconds

### Requirement 5: フォロワー数追跡

**User Story:** As a Member, I want to record follower counts with my posts, so that I can track my account growth over time.

#### Acceptance Criteria

1. WHEN a Member records a post, THE System SHALL allow optional input of follower count
2. WHEN a follower count is provided, THE System SHALL validate it is a non-negative integer not exceeding 99,999,999
3. WHEN a follower count contains commas, THE System SHALL remove them before validation
4. WHEN displaying posts with follower counts, THE System SHALL format numbers with thousand separators
5. WHEN a Member has recorded follower counts, THE System SHALL display a follower growth graph
6. WHEN displaying the follower graph, THE System SHALL show data points sorted chronologically with visual distinction between STORY and FEED posts

### Requirement 6: 週次カレンダー表示

**User Story:** As a Member, I want to view my posting history in a weekly calendar format, so that I can easily see which weeks I have posted and which I have not.

#### Acceptance Criteria

1. WHEN a Member views their personal tab, THE System SHALL display a weekly calendar showing the most recent 12 weeks
2. WHEN displaying each week, THE System SHALL show separate columns for STORY and FEED posts
3. WHEN a week has posts, THE System SHALL display each post with its date and optional follower count
4. WHEN a week has no posts of a type, THE System SHALL display an "未記録" (unrecorded) indicator
5. WHEN a Member clicks on a post in the calendar, THE System SHALL open the edit modal for that post
6. WHEN a Member clicks on an "未記録" cell, THE System SHALL open the add modal with the week's date pre-filled
7. WHEN a Member clicks the add button in a cell with existing posts, THE System SHALL open the add modal to add another post for that week and type

### Requirement 7: スタッフ閲覧機能

**User Story:** As Staff, I want to view all members' posting status, so that I can monitor team posting activity and identify members who need support.

#### Acceptance Criteria

1. WHEN Staff views the SNS post page in browse mode, THE System SHALL display a view tab showing all members' posts
2. WHEN displaying current week status, THE System SHALL show a table with all members and their STORY/FEED completion status
3. WHEN a member has completed a post type, THE System SHALL display a checkmark and post count
4. WHEN a member has not completed a post type, THE System SHALL display "未投稿" (not posted)
5. WHEN Staff filters by month, THE System SHALL display only posts within that month
6. WHEN Staff filters by member, THE System SHALL display only that member's posts
7. THE System SHALL refresh the view tab data every 60 seconds

### Requirement 8: 期間指定検索

**User Story:** As a user, I want to search posts by date range, so that I can review posting activity for specific periods.

#### Acceptance Criteria

1. WHEN a user provides a "from" date parameter, THE System SHALL return posts on or after that date
2. WHEN a user provides a "to" date parameter, THE System SHALL return posts on or before 23:59:59 of that date
3. WHEN both "from" and "to" parameters are provided, THE System SHALL return posts within that inclusive range
4. WHEN neither date parameter is provided but a week parameter is provided, THE System SHALL return posts for that week
5. WHEN no date or week parameters are provided, THE System SHALL return all posts for the requesting user

### Requirement 9: 投稿記録の編集・削除

**User Story:** As a Member, I want to edit and delete my post records, so that I can correct mistakes or remove incorrect entries.

#### Acceptance Criteria

1. WHEN a Member edits a post, THE System SHALL allow modification of posted date, post type, URL, note, and follower count
2. WHEN a Member changes the posted date, THE System SHALL recalculate and update the week assignment
3. WHEN a Member deletes a post, THE System SHALL require confirmation before deletion
4. WHEN a Member attempts to edit another member's post, THE System SHALL deny the operation
5. WHEN a Member attempts to delete another member's post, THE System SHALL deny the operation
6. WHEN Staff with MASTER role edits or deletes any post, THE System SHALL allow the operation

### Requirement 10: データ整合性

**User Story:** As a system administrator, I want the system to maintain data integrity, so that posting records are accurate and consistent.

#### Acceptance Criteria

1. WHEN creating a post with the same userId, week, postType, and accountId as an existing post, THE System SHALL update the existing post instead of creating a duplicate
2. WHEN a unique constraint violation occurs during creation, THE System SHALL retry by finding and updating the existing record
3. WHEN a Member sets an account as default, THE System SHALL ensure only one account per user has the default flag
4. WHEN validating URLs, THE System SHALL accept empty strings or valid URL formats
5. WHEN storing notes, THE System SHALL enforce a maximum length of 2000 characters

### Requirement 11: 月次記録状況表示

**User Story:** As a Member, I want to see my current month's posting status, so that I know if I have posted at least once this month for each type.

#### Acceptance Criteria

1. WHEN a Member views their personal tab, THE System SHALL display current month status for STORY and FEED
2. WHEN at least one STORY post exists in the current month, THE System SHALL display "投稿記録あり" (recorded)
3. WHEN no STORY posts exist in the current month, THE System SHALL display "未記録" (unrecorded)
4. WHEN at least one FEED post exists in the current month, THE System SHALL display "投稿記録あり" (recorded)
5. WHEN no FEED posts exist in the current month, THE System SHALL display "未記録" (unrecorded)

### Requirement 12: 年度ベース月選択

**User Story:** As Staff, I want to filter posts by fiscal year months, so that I can review activity within the organization's fiscal year.

#### Acceptance Criteria

1. WHEN Staff views the month filter, THE System SHALL display months from the current fiscal year (April to March)
2. WHEN the current date is in a fiscal year, THE System SHALL also include the previous fiscal year's last 3 months
3. WHEN displaying month options, THE System SHALL sort them in descending order (most recent first)
4. WHEN posts exist outside the fiscal year range, THE System SHALL still include those months in the filter options
