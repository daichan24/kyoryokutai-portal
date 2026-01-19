# 月次報告の要求仕様

## 概要
月次報告は、SUPPORT/MASTERロールのユーザーが月を選択して作成します。作成時に自動的に表紙・隊員別シート・支援記録の3つで構成される文書を生成します。

## 作成フロー

### 1. 新規作成
- ユーザーが「+ 新規作成」ボタンをクリック
- 月選択モーダルで月を選択（YYYY-MM形式）
- `POST /api/monthly-reports` に `{ month: "YYYY-MM" }` を送信
- バックエンドで自動生成処理を実行
- 作成後、詳細モーダルを自動で開く（編集モード）

### 2. 自動生成処理

#### 2.1 表紙の生成
- テンプレート設定（DocumentTemplate）から取得：
  - 宛先（coverRecipient）
  - 差出人（coverSender）
  - タイトル
  - テキスト1
  - テキスト2
  - 担当者情報
- 報告日は現在の日付を自動設定
- 対象月は選択された月を自動設定

#### 2.2 隊員別シートの生成
**重要**: 各メンバーの「週次報告」を参照する

1. メンバー（MEMBERロール）を取得
2. 各メンバーについて：
   - 対象月に含まれる週を特定（YYYY-WW形式）
   - 各週の週次報告を取得（WeeklyReportテーブル）
   - 週次報告から以下を抽出（**対象月に含まれる項目のみ**）：
     - **今月の主な活動内容（thisMonthActivities）**: 
       - 各週の`thisWeekActivities`を集約
       - **重要**: 各活動の日付を確認して、対象月に含まれるものだけを抽出
       - 形式: `[{ date: "d日", activity: "活動内容" }, ...]`
     - **翌月以降の活動予定（nextMonthPlan）**: 
       - 各週の`nextWeekPlan`を集約してテキスト化
       - **重要**: 対象月の次の月に関する予定のみを抽出
     - **勤務に関する質問など（workQuestions）**: 
       - 各週の`note`から関連する内容を抽出（または空）
       - 暫定的には、`note`をそのまま設定するか、空にする
     - **生活面の留意事項その他（lifeNotes）**: 
       - 各週の`note`から関連する内容を抽出（または空）
       - 暫定的には、`note`をそのまま設定するか、空にする
   - 隊員別シートを作成（1人1ページ、多い場合は複数ページ）

**週次報告の取得方法**:
- 対象月（例: 2024-01）に含まれる週を計算（月初・月末の週も含む）
- 各週の週次報告を取得（`userId`と`week`で検索）
- **重要**: 週次報告から活動内容を抽出する際は、各活動の日付を確認して、対象月に含まれるものだけを抽出する
  - 月末や月初の週は、週全体が対象月に含まれていなくても、週次報告の内容のうち、対象月に該当する部分だけを抽出
- **週次報告が存在しない場合**:
  - 隊員別シートは型に沿って作成する
  - 詳細項目（thisMonthActivities, nextMonthPlan, workQuestions, lifeNotes）は空の状態で作成
  - 後で編集する際に追加できるように、編集可能な枠を用意する

#### 2.3 支援記録の生成
- 対象月の支援記録を取得（SupportRecordテーブル）
- 条件：
  - `supportDate`が対象月の範囲内
  - まだ月次報告に紐付けられていないもの（`monthlyReportId`がnull）
- 支援記録を月次報告に紐付け（`monthlyReportId`を更新）
- 型に沿って内容をまとめる

### 3. 編集・プレビュー機能

#### 3.1 編集モード
- 表紙（宛先、差出人）を編集可能
- 隊員別シート（各メンバーごと）を編集可能：
  - 今月の主な活動内容: SimpleRichTextEditor
  - 翌月以降の活動予定: SimpleRichTextEditor
  - 勤務に関する質問など: SimpleRichTextEditor
  - 生活面の留意事項その他: SimpleRichTextEditor
- 支援記録: 表示のみ（編集不可）

#### 3.2 プレビューモード
- A4サイズ（210mm × 297mm）で表示
- 表紙・隊員別シート・支援記録の3つで構成
- 明朝体で表示
- ダークモード対応

#### 3.3 保存・出力
- 編集内容を保存（`PUT /api/monthly-reports/:id`）
- PDF出力（`GET /api/monthly-reports/:id/pdf`）
- 提出（`submittedAt`を設定）

## データ構造

### MonthlyReport テーブル
```prisma
model MonthlyReport {
  id              String   @id @default(uuid())
  month           String   @unique  // "YYYY-MM"形式
  createdBy       String
  coverRecipient  String
  coverSender     String
  memberSheets    Json     // 隊員別シートの配列
  submittedAt     DateTime?
  supportRecords  SupportRecord[]
  revisions       MonthlyReportRevision[]
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

### memberSheets の構造（JSON）
```typescript
[
  {
    userId: string,
    userName: string,
    missionType: 'FREE' | 'MISSION' | null,
    thisMonthActivities: Array<{
      date: string,        // "d日"形式
      activity: string    // 活動内容
    }>,
    nextMonthPlan: string,  // リッチテキスト（週次報告のnextWeekPlanを集約）
    workQuestions: string, // リッチテキスト（週次報告のnoteから抽出）
    lifeNotes: string      // リッチテキスト（週次報告のnoteから抽出）
  },
  ...
]
```

### WeeklyReport テーブル
```prisma
model WeeklyReport {
  id                String   @id @default(uuid())
  userId            String
  week              String   // "YYYY-WW"形式
  thisWeekActivities Json    // [{ date: string, activity: string }, ...]
  nextWeekPlan      String?  // リッチテキスト
  note              String?  // リッチテキスト
  submittedAt       DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  @@unique([userId, week])
}
```

### SupportRecord テーブル
```prisma
model SupportRecord {
  id              String   @id @default(uuid())
  monthlyReportId String?  // 月次報告に紐付け
  userId          String
  supportDate     DateTime
  supportContent  String   // リッチテキスト
  supportBy       String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

## 実装が必要な変更点

### 1. 隊員別シートの生成ロジックを変更
**現在**: スケジュール（Schedule）から活動を抽出
**変更後**: 週次報告（WeeklyReport）から活動を抽出

**実装内容**:
- `extractMonthlyActivities()`を`extractMonthlyActivitiesFromWeeklyReports()`に変更
- 対象月に含まれる週を計算
- 各週の週次報告を取得
- 週次報告から活動内容を抽出して集約

### 2. 週次報告の取得ロジック
- 対象月（例: 2024-01）に含まれる週を計算
- 各メンバーについて、各週の週次報告を取得
- 週次報告が存在しない場合は空のデータで作成

### 3. 支援記録の取得ロジック
- 現在の実装は正しい（SupportRecordテーブルから取得）
- 対象月の範囲内で、まだ紐付けられていないものを取得
- 月次報告作成時に自動紐付け

## 確認が必要なポイント

1. **週次報告の週の形式**
   - 現在: `YYYY-WW`形式（例: `2024-01`）
   - 対象月に含まれる週を正しく計算できるか

2. **隊員別シートの内容**
   - 週次報告の`thisWeekActivities`をどのように集約するか
   - 週次報告の`nextWeekPlan`をどのように集約するか
   - 週次報告の`note`から`workQuestions`と`lifeNotes`をどのように抽出するか

3. **支援記録の表示**
   - 支援記録が正しく表示されているか
   - 月次報告更新時に支援記録が保持されているか

