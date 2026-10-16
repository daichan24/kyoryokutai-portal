/** 毎月くり返し登録で一度に作れる最大件数（誤入力で大量登録されるのを防ぐ） */
export const MAX_RECURRING_MONTHS = 24;

/**
 * 毎月くり返し登録の各支出日（YYYY-MM-DD）を返す。
 * 開始日の「日」を毎月使い、その月に無い日（31日など）は月末に寄せる。
 * repeatUntilMonth（YYYY-MM）の月まで（その月を含む）。
 */
export function buildMonthlySpentDates(startDate: string, repeatUntilMonth: string): string[] {
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em] = repeatUntilMonth.split('-').map(Number);
  const monthCount = (ey - sy) * 12 + (em - sm) + 1;
  if (monthCount < 1) {
    throw new Error('REPEAT_UNTIL_BEFORE_START');
  }
  if (monthCount > MAX_RECURRING_MONTHS) {
    throw new Error('REPEAT_TOO_MANY');
  }

  const dates: string[] = [];
  for (let i = 0; i < monthCount; i++) {
    const monthIndex = sm - 1 + i;
    const year = sy + Math.floor(monthIndex / 12);
    const month = (monthIndex % 12) + 1;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const day = Math.min(sd, lastDay);
    dates.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
  }
  return dates;
}

type EntryStatus = 'PLANNED' | 'PENDING' | 'APPROVED' | 'REJECTED';

/**
 * 経費の修正で承認状態をどうするか。
 * 日付・内容・金額・プロジェクト・予定を変えずに「項目」「相手方」だけを直した場合は、
 * 承認済み・承認待ちの状態をそのまま残す（報告書を作るための補記で再承認を求めない）。
 */
export function resolveStatusAfterEdit(params: {
  currentStatus: EntryStatus;
  requestedStatus?: 'PLANNED' | 'PENDING';
  coreFieldsChanged: boolean;
}): { status: EntryStatus; keepApproval: boolean } {
  const { currentStatus, requestedStatus, coreFieldsChanged } = params;
  const keepable = currentStatus === 'APPROVED' || currentStatus === 'PENDING';
  if (!coreFieldsChanged && keepable && requestedStatus !== 'PLANNED') {
    return { status: currentStatus, keepApproval: true };
  }
  if (requestedStatus === 'PLANNED') return { status: 'PLANNED', keepApproval: false };
  if (requestedStatus === 'PENDING') return { status: 'PENDING', keepApproval: false };
  return { status: currentStatus === 'PLANNED' ? 'PLANNED' : 'PENDING', keepApproval: false };
}

/** 日本時間で見た「今日」が属する年度（4/1〜翌3/31）。1〜3月は前年度 */
export function currentFiscalYear(now: Date = new Date()): number {
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.getUTCMonth() >= 3 ? jst.getUTCFullYear() : jst.getUTCFullYear() - 1;
}

/**
 * 報告書の対象期間。from/to があればそれを、fiscalYear があればその年度を、
 * どちらも無ければ今日が属する年度を使う。
 */
export function resolveReportRange(options?: { from?: string; to?: string; fiscalYear?: number }, now: Date = new Date()): {
  from: Date;
  to: Date;
  label: string;
} {
  if (options?.from && options?.to) {
    return {
      from: new Date(`${options.from}T00:00:00.000Z`),
      to: new Date(`${options.to}T23:59:59.999Z`),
      label: `${options.from}〜${options.to}`,
    };
  }
  const fy = options?.fiscalYear ?? currentFiscalYear(now);
  return {
    from: new Date(Date.UTC(fy, 3, 1, 0, 0, 0)),
    to: new Date(Date.UTC(fy + 1, 2, 31, 23, 59, 59, 999)),
    label: `${fy}年度（${fy}年4月1日〜${fy + 1}年3月31日）`,
  };
}
