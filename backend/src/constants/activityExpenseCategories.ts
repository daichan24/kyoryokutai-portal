import { ActivityExpenseCategory } from '@prisma/client';

/**
 * 町の活動経費報告書フォーマットの「項目」列。並び順はフォーマット上の行順と一致させる
 * （PDF出力・対象経費一覧の表示順もこれに従う）。abbreviation は報告書の「支出No」欄
 * （例: 旅－1）に使う1文字略称。
 */
export const ACTIVITY_EXPENSE_CATEGORIES: Array<{
  value: ActivityExpenseCategory;
  label: string;
  abbreviation: string;
}> = [
  { value: 'TRAVEL', label: '旅費', abbreviation: '旅' },
  { value: 'SUPPLIES', label: '消耗品費', abbreviation: '消' },
  { value: 'PRINTING', label: '印刷製本費', abbreviation: '印' },
  { value: 'COMMUNICATION', label: '通信運搬費', abbreviation: '通' },
  { value: 'ADVERTISING', label: '広告料', abbreviation: '広' },
  { value: 'FEES', label: '手数料', abbreviation: '手' },
  { value: 'INSURANCE', label: '保険料', abbreviation: '保' },
  { value: 'RENTAL', label: '使用料、借上料', abbreviation: '使' },
  { value: 'EQUIPMENT', label: '備品購入費', abbreviation: '備' },
  { value: 'CONTRIBUTION', label: '負担金', abbreviation: '負' },
];

export const ACTIVITY_EXPENSE_CATEGORY_VALUES = ACTIVITY_EXPENSE_CATEGORIES.map((c) => c.value) as [
  ActivityExpenseCategory,
  ...ActivityExpenseCategory[],
];

export const ACTIVITY_EXPENSE_CATEGORY_LABELS: Record<ActivityExpenseCategory, string> = Object.fromEntries(
  ACTIVITY_EXPENSE_CATEGORIES.map((c) => [c.value, c.label]),
) as Record<ActivityExpenseCategory, string>;
