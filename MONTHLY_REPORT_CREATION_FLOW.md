# 月次報告の作成方法 - 現状まとめ

## 概要
月次報告は、SUPPORT/MASTERロールのユーザーが月を選択して作成します。作成時に自動的に隊員別シートと支援記録が紐付けられます。

## フロー図

```
[フロントエンド: MonthlyReport.tsx]
  ↓
1. ユーザーが「+ 新規作成」ボタンをクリック
  ↓
2. 月選択モーダルが表示される
  ↓
3. 月を選択して「作成」ボタンをクリック
  ↓
4. POST /api/monthly-reports に { month: "YYYY-MM" } を送信
  ↓
[バックエンド: monthlyReports.ts]
  ↓
5. generateMonthlyReport(month, createdBy) を呼び出し
  ↓
[バックエンド: monthlyReportGenerator.ts]
  ↓
6. テンプレート設定を取得（DocumentTemplateテーブル）
   - 宛先（coverRecipient）
   - 差出人（coverSender）
  ↓
7. メンバー（MEMBERロール）を取得
  ↓
8. 各メンバーについて：
   - extractMonthlyActivities() でその月の活動を抽出
   - 隊員別シートを作成（初期値は空）
  ↓
9. その月の支援記録を取得（まだ月次報告に紐付けられていないもの）
  ↓
10. 月次報告を作成（MonthlyReportテーブル）
    - month
    - createdBy
    - coverRecipient
    - coverSender
    - memberSheets (JSON形式)
  ↓
11. 支援記録を月次報告に紐付け（SupportRecord.monthlyReportId を更新）
  ↓
12. 紐付け後のデータを再取得して返す
  ↓
[フロントエンド: MonthlyReport.tsx]
  ↓
13. 作成された月次報告のIDを取得
  ↓
14. MonthlyReportDetailModal を開く（viewMode="edit"）
```

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
      description: string
    }>,
    nextMonthPlan: string,  // リッチテキスト
    workQuestions: string, // リッチテキスト
    lifeNotes: string      // リッチテキスト
  },
  ...
]
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

## 編集・プレビュー機能

### MonthlyReportDetailModal
- **編集モード**: 表紙（宛先、差出人）と隊員別シートを編集可能
- **プレビューモード**: A4サイズのプレビューを表示
- **支援記録**: 表示のみ（編集不可）

### 編集可能な項目
1. **表紙**
   - 宛先（coverRecipient）: 通常のInput
   - 差出人（coverSender）: SimpleRichTextEditor

2. **隊員別シート**（各メンバーごと）
   - 今月の活動（thisMonthActivities）: SimpleRichTextEditor
   - 翌月以降の活動予定（nextMonthPlan）: SimpleRichTextEditor
   - 勤務に関する質問など（workQuestions）: SimpleRichTextEditor
   - 生活面の留意事項その他（lifeNotes）: SimpleRichTextEditor

3. **支援記録**
   - 表示のみ（編集不可）

## 現在の問題点

### 1. 月次報告のドキュメント生成・編集の問題
- **現状**: 編集とプレビューのタブ切り替えは実装済み
- **問題**: ユーザーが「なかなか実装できていない」と報告
- **確認が必要**: 
  - ドキュメントエディタでの編集が正しく動作しているか
  - プレビューが正しく表示されているか
  - 保存時にデータが正しく更新されているか

### 2. 支援内容が消えてしまう問題
- **現状**: 
  - 月次報告作成時に支援記録を取得して紐付け
  - 更新時には支援記録を取得して返す
  - プレビュー用データに支援記録を含める
- **問題**: 支援記録が消えてしまう
- **可能性のある原因**:
  - 更新時に支援記録が正しく取得されていない
  - プレビュー用データに支援記録が含まれていない
  - フロントエンドで支援記録が正しく表示されていない

## 改善案

### オプション1: 月次報告の作成フローを簡素化
- 月次報告を作成する際に、最小限のデータ（月、作成者）のみで作成
- 詳細は後から編集可能にする
- 支援記録の紐付けは別途処理

### オプション2: 月次報告の生成処理を改善
- エラーハンドリングを強化
- ログを追加して問題箇所を特定
- 支援記録の紐付け処理を確実にする

### オプション3: フロントエンドの編集機能を改善
- 編集とプレビューの切り替えを明確にする
- 保存時の確認を追加
- エラーメッセージを改善

## 確認が必要なポイント

1. **月次報告作成時のエラー**
   - どの段階でエラーが発生しているか
   - エラーメッセージの内容
   - コンソールログの確認

2. **支援記録の表示**
   - 月次報告作成時に支援記録が正しく取得されているか
   - 更新時に支援記録が保持されているか
   - プレビューで支援記録が表示されているか

3. **編集機能**
   - ドキュメントエディタが正しく動作しているか
   - 保存時にデータが正しく更新されているか
   - プレビューが正しく表示されているか

