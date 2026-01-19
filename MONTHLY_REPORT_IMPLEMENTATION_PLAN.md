# 月次報告の実装計画

## 現在の問題点

1. **隊員別シートの生成方法が間違っている**
   - 現在: スケジュール（Schedule）から活動を抽出
   - 正しい: 週次報告（WeeklyReport）から活動を抽出

2. **週次報告の参照方法が不明確**
   - 対象月に含まれる週を計算する必要がある
   - 各週の週次報告を取得する必要がある

## 実装方針

### 1. 週次報告から隊員別シートを生成する

#### 1.1 対象月に含まれる週を計算
```typescript
// 例: 2024-01（2024年1月）の場合
// 2024-01-01 から 2024-01-31 までの週を計算
// 週は月曜日始まり（weekStartsOn: 1）
// 週の形式: YYYY-WW（例: 2024-01, 2024-02, ...）
// 
// 重要: 月末や月初の週は、週全体が対象月に含まれていなくても、
// 週次報告の内容を確認して、対象月に対応した項目だけを抽出する
```

#### 1.2 各メンバーの週次報告を取得
```typescript
// 各メンバーについて
for (const user of users) {
  // 対象月に含まれる週を計算（月末・月初の週も含む）
  const weeksInMonth = getWeeksInMonth(month); // ["2023-52", "2024-01", "2024-02", "2024-03", "2024-04", "2024-05"]
  
  // 各週の週次報告を取得
  const weeklyReports = await prisma.weeklyReport.findMany({
    where: {
      userId: user.id,
      week: { in: weeksInMonth }
    },
    orderBy: { week: 'asc' }
  });
  
  // 週次報告が存在しない場合は空のデータで隊員別シートを作成
  if (weeklyReports.length === 0) {
    memberSheets.push({
      userId: user.id,
      userName: user.name,
      missionType: user.missionType,
      thisMonthActivities: [],  // 空の状態
      nextMonthPlan: '',         // 空の状態
      workQuestions: '',         // 空の状態
      lifeNotes: '',             // 空の状態
    });
    continue;
  }
  
  // 週次報告から活動内容を抽出（対象月に含まれる項目のみ）
  const thisMonthActivities = extractActivitiesFromWeeklyReports(weeklyReports, month);
  const nextMonthPlan = aggregateNextWeekPlans(weeklyReports, month);
  const workQuestions = extractWorkQuestions(weeklyReports);
  const lifeNotes = extractLifeNotes(weeklyReports);
}
```

#### 1.3 週次報告から活動内容を抽出（対象月に含まれる項目のみ）
```typescript
// thisWeekActivities を集約（対象月に含まれる日付のみ）
function extractActivitiesFromWeeklyReports(
  weeklyReports: WeeklyReport[], 
  targetMonth: string
): ActivityItem[] {
  const activities: ActivityItem[] = [];
  const monthStart = startOfMonth(new Date(`${targetMonth}-01`));
  const monthEnd = endOfMonth(monthStart);
  
  for (const report of weeklyReports) {
    if (Array.isArray(report.thisWeekActivities)) {
      for (const activity of report.thisWeekActivities) {
        // 日付を解析して対象月に含まれるか確認
        const activityDate = parseActivityDate(activity.date, report.week);
        if (activityDate && activityDate >= monthStart && activityDate <= monthEnd) {
          activities.push({
            date: format(activityDate, 'd日'),
            activity: activity.activity || ''
          });
        }
      }
    }
  }
  
  return activities;
}

// 活動の日付を解析（週の情報から日付を特定）
function parseActivityDate(dateStr: string, weekStr: string): Date | null {
  // dateStrは "d日" 形式（例: "1日", "15日"）
  // weekStrは "YYYY-WW" 形式（例: "2024-01"）
  // 週の開始日を計算して、日付を特定
  const weekStart = parseWeekString(weekStr);
  const dayMatch = dateStr.match(/(\d+)日/);
  if (dayMatch) {
    const day = parseInt(dayMatch[1], 10);
    const activityDate = new Date(weekStart);
    activityDate.setDate(weekStart.getDate() + (day - weekStart.getDate()));
    return activityDate;
  }
  return null;
}

// nextWeekPlan を集約（対象月の次の月に関する予定のみ）
function aggregateNextWeekPlans(
  weeklyReports: WeeklyReport[], 
  targetMonth: string
): string {
  const plans: string[] = [];
  const nextMonth = addMonths(new Date(`${targetMonth}-01`), 1);
  const nextMonthStart = startOfMonth(nextMonth);
  const nextMonthEnd = endOfMonth(nextMonth);
  
  for (const report of weeklyReports) {
    if (report.nextWeekPlan) {
      // 週の情報から次の週の開始日を計算
      const weekStart = parseWeekString(report.week);
      const nextWeekStart = addWeeks(weekStart, 1);
      
      // 次の週が対象月の次の月に含まれる場合のみ追加
      if (nextWeekStart >= nextMonthStart && nextWeekStart <= nextMonthEnd) {
        plans.push(report.nextWeekPlan);
      }
    }
  }
  
  return plans.join('\n\n');
}

// note から workQuestions と lifeNotes を抽出
// 注意: 現在の週次報告のnoteは単一のフィールドなので、
// 自動的に分離することは難しい
// 暫定的には、noteをそのままworkQuestionsとlifeNotesに設定するか、
// 空にするか、ユーザーに確認する必要がある
```

### 2. 対象月に含まれる週を計算する関数

```typescript
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachWeekOfInterval } from 'date-fns';

function getWeeksInMonth(month: string): string[] {
  // month: "YYYY-MM"形式
  const monthDate = new Date(`${month}-01`);
  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);
  
  // 月の最初の週の開始日（月曜日）
  // 重要: 月初の週は、月の最初の日が含まれる週の開始日を取得
  const firstWeekStart = startOfWeek(start, { weekStartsOn: 1 });
  // 月の最後の週の終了日（日曜日）
  // 重要: 月末の週は、月の最後の日が含まれる週の終了日を取得
  const lastWeekEnd = endOfWeek(end, { weekStartsOn: 1 });
  
  // 月に含まれる週を取得（月初・月末の週も含む）
  const weeks = eachWeekOfInterval(
    { start: firstWeekStart, end: lastWeekEnd },
    { weekStartsOn: 1 }
  );
  
  // 週の形式に変換（YYYY-WW）
  return weeks.map(weekStart => {
    const year = weekStart.getFullYear();
    const weekNum = getWeekNumber(weekStart);
    return `${year}-${weekNum.toString().padStart(2, '0')}`;
  });
}

function getWeekNumber(date: Date): number {
  // ISO週番号を計算
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}
```

**重要**: この関数で取得した週のうち、月初・月末の週は週全体が対象月に含まれていない可能性がある。
そのため、週次報告から活動内容を抽出する際は、各活動の日付を確認して、対象月に含まれるものだけを抽出する必要がある。

### 3. 実装手順

1. **バックエンド: `monthlyReportGenerator.ts`を修正**
   - `extractMonthlyActivities()`を削除または非推奨化
   - `extractMonthlyActivitiesFromWeeklyReports()`を新規作成
   - `getWeeksInMonth()`を新規作成
   - `generateMonthlyReport()`を修正して週次報告から取得するように変更

2. **週次報告の取得ロジックを実装**
   - 対象月に含まれる週を計算（月初・月末の週も含む）
   - 各メンバーについて、各週の週次報告を取得
   - 週次報告が存在しない場合は、型に沿って空のデータで隊員別シートを作成
   - 週次報告から活動内容を抽出する際は、各活動の日付を確認して対象月に含まれるものだけを抽出

3. **隊員別シートの生成ロジックを実装**
   - 週次報告から`thisWeekActivities`を集約
   - 週次報告から`nextWeekPlan`を集約
   - 週次報告の`note`を`workQuestions`と`lifeNotes`に設定（暫定）

4. **テスト**
   - 対象月に含まれる週が正しく計算されるか
   - 週次報告が正しく取得されるか
   - 隊員別シートが正しく生成されるか

## 注意点

1. **週次報告のnoteの扱い**
   - 現在の週次報告の`note`は単一のフィールド
   - `workQuestions`と`lifeNotes`を自動的に分離することは難しい
   - 暫定的には、`note`をそのまま`workQuestions`と`lifeNotes`に設定するか、空にする
   - 将来的には、週次報告の`note`を`workQuestions`と`lifeNotes`に分離する必要があるかもしれない

2. **週次報告が存在しない場合**
   - 週次報告が存在しない場合は、型に沿って隊員別シートを作成
   - 詳細項目（thisMonthActivities, nextMonthPlan, workQuestions, lifeNotes）は空の状態で作成
   - 後で編集する際に追加できるように、編集可能な枠を用意する
   - プレビューでは空の項目も「（未記入）」などで表示される

3. **週の形式の統一**
   - 週次報告の`week`フィールドは`YYYY-WW`形式（例: `2024-01`）
   - 月次報告の生成時に、この形式で週を計算する必要がある

4. **月初・月末の週の処理**
   - 月初・月末の週は、週全体が対象月に含まれていない可能性がある
   - 週次報告の`thisWeekActivities`の各活動の日付を確認して、対象月に含まれるものだけを抽出する
   - 日付の形式は "d日"（例: "1日", "15日"）で、週の情報から実際の日付を計算する必要がある

5. **週次報告が存在しない場合の処理**
   - 隊員別シートは型に沿って作成する（空のデータでも作成）
   - 詳細項目（thisMonthActivities, nextMonthPlan, workQuestions, lifeNotes）は空の状態
   - 編集時に追加できるように、編集可能な枠を用意する
   - プレビューでは空の項目も「（未記入）」などで表示される

