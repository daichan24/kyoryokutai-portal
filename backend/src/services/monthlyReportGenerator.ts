import prisma from '../lib/prisma';
import { format, addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachWeekOfInterval, addWeeks, parse } from 'date-fns';

interface ActivityItem {
  date: string;
  activity: string;
}

interface WeeklyReport {
  id: string;
  userId: string;
  week: string;
  thisWeekActivities: any;
  nextWeekPlan: string | null;
  note: string | null;
}

/**
 * 月次報告を自動生成
 * その月の支援記録を自動的に含める
 */
export async function generateMonthlyReport(month: string, createdBy: string) {
  try {
    // テンプレート設定を取得（テーブルが存在しない場合はスキップ）
    let template = null;
    try {
      template = await prisma.documentTemplate.findFirst({
        orderBy: { updatedAt: 'desc' },
      });
    } catch (error: any) {
      // テーブルが存在しない場合はデフォルト値を使用
      if (error?.message?.includes('does not exist') || error?.code === 'P2021') {
        console.warn('DocumentTemplate table does not exist, using default values');
      } else {
        throw error;
      }
    }

    let coverRecipient = '長沼町長　齋　藤　良　彦　様';
    let coverSender = '一般社団法人まおいのはこ<br>代表理事　坂本　一志';

    if (template) {
      if (template.monthlyReportRecipient) coverRecipient = template.monthlyReportRecipient;
      if (template.monthlyReportSender) coverSender = template.monthlyReportSender;
    }

    // 現在のメンバー分（テスト用のメンバー属性のさとうだいち以外）を作成
    // displayOrderでソート
    const users = await prisma.user.findMany({
      where: { 
        role: 'MEMBER',
        name: { not: 'さとうだいち' }, // さとうだいちを除外
      },
      orderBy: [
        { displayOrder: 'asc' },
        { name: 'asc' },
      ],
    });

    const memberSheets = [];

    for (const user of users) {
      // テスト用のメンバー属性のさとうだいちを除外
      if (user.name === 'さとうだいち' && user.role === 'MEMBER') {
        continue;
      }

      try {
        // 対象月に含まれる週を計算
        const weeksInMonth = getWeeksInMonth(month);
        
        // 各週の週次報告を取得
        const weeklyReports = await prisma.weeklyReport.findMany({
          where: {
            userId: user.id,
            week: { in: weeksInMonth }
          },
          orderBy: { week: 'asc' }
        });

        // 週次報告から活動内容を抽出
        const thisMonthActivities = extractActivitiesFromWeeklyReports(weeklyReports, month);
        const nextMonthPlan = aggregateNextWeekPlans(weeklyReports, month);
        const workQuestions = extractWorkQuestions(weeklyReports);
        const lifeNotes = extractLifeNotes(weeklyReports);

        memberSheets.push({
          userId: user.id,
          userName: user.name,
          missionType: user.missionType,
          thisMonthActivities,
          nextMonthPlan,
          workQuestions,
          lifeNotes,
        });
      } catch (error) {
        console.error(`Error extracting activities for user ${user.id}:`, error);
        // エラーが発生しても空のデータで隊員別シートを作成
        memberSheets.push({
          userId: user.id,
          userName: user.name,
          missionType: user.missionType,
          thisMonthActivities: [],
          nextMonthPlan: '',
          workQuestions: '',
          lifeNotes: '',
        });
      }
    }

    // その月の支援記録を取得して、月次報告に紐付け
    const startDate = startOfMonth(new Date(`${month}-01`));
    const endDate = endOfMonth(startDate);

    // その月の支援記録を取得（まだ月次報告に紐付けられていないもの）
    const allSupportRecords = await prisma.supportRecord.findMany({
      where: {
        supportDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        supportDate: 'asc',
      },
    });

    // 月次報告に紐付けられていないもの（nullまたは空文字列）をフィルタリング
    const supportRecords = allSupportRecords.filter(record => 
      !record.monthlyReportId || record.monthlyReportId === ''
    );

    // 月次報告を作成
    const report = await prisma.monthlyReport.create({
      data: {
        month,
        createdBy,
        coverRecipient,
        coverSender,
        memberSheets: memberSheets as any,
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
          },
        },
        supportRecords: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: {
            supportDate: 'asc',
          },
        },
      },
    });

    // 支援記録を月次報告に紐付け
    if (supportRecords.length > 0) {
      await prisma.supportRecord.updateMany({
        where: {
          id: { in: supportRecords.map(r => r.id) },
        },
        data: {
          monthlyReportId: report.id,
        },
      });

      // 紐付け後の支援記録を再取得
      const updatedReport = await prisma.monthlyReport.findUnique({
        where: { id: report.id },
        include: {
          creator: {
            select: {
              id: true,
              name: true,
            },
          },
          supportRecords: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: {
              supportDate: 'asc',
            },
          },
        },
      });

      return updatedReport || report;
    }

    return report;
  } catch (error) {
    console.error('Error in generateMonthlyReport:', error);
    throw new Error(`月次報告の生成中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
  }
}

/**
 * 対象月に含まれる週を計算
 * 月初・月末の週も含む
 */
function getWeeksInMonth(month: string): string[] {
  // month: "YYYY-MM"形式
  const monthDate = new Date(`${month}-01`);
  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);
  
  // 月の最初の週の開始日（月曜日）
  const firstWeekStart = startOfWeek(start, { weekStartsOn: 1 });
  // 月の最後の週の終了日（日曜日）
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

/**
 * 週番号を取得（ISO週番号）
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * 週文字列を日付に変換
 */
function parseWeekString(weekStr: string): Date {
  try {
    // YYYY-WW形式（例: 2024-01）をパース
    const match = weekStr.match(/^(\d{4})-(\d{2})$/);
    if (match) {
      const year = parseInt(match[1], 10);
      const weekNum = parseInt(match[2], 10);
      
      // 年の最初の月曜日を基準に週を計算
      const yearStart = new Date(year, 0, 1);
      const dayOfWeek = yearStart.getDay();
      const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7;
      const firstMonday = new Date(yearStart);
      firstMonday.setDate(yearStart.getDate() + daysToMonday);
      
      // 指定された週の開始日
      const weekStart = new Date(firstMonday);
      weekStart.setDate(firstMonday.getDate() + (weekNum - 1) * 7);
      
      return weekStart;
    }
    
    // フォールバック: 既存のパース方法を試す
    return parse(weekStr, "yyyy-'W'II", new Date());
  } catch (error) {
    console.error('Failed to parse week string:', weekStr, error);
    // エラー時は現在の日付を返す
    return new Date();
  }
}

/**
 * 活動の日付を解析
 */
function parseActivityDate(dateStr: string, weekStr: string): Date | null {
  try {
    if (!dateStr) return null;
    
    // yyyy-MM-dd形式を試す（データベースに保存されている形式）
    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10);
      const day = parseInt(isoMatch[3], 10);
      return new Date(year, month - 1, day);
    }
    
    // M月d日形式を試す（表示用の形式）
    const monthDayMatch = dateStr.match(/(\d+)月(\d+)日/);
    if (monthDayMatch) {
      const weekStart = parseWeekString(weekStr);
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const month = parseInt(monthDayMatch[1], 10);
      const day = parseInt(monthDayMatch[2], 10);
      const year = weekStart.getFullYear();
      const activityDate = new Date(year, month - 1, day);
      
      // 週の範囲内か確認
      if (activityDate >= weekStart && activityDate <= weekEnd) {
        return activityDate;
      }
      // 前年または翌年の可能性を確認
      const prevYearDate = new Date(year - 1, month - 1, day);
      if (prevYearDate >= weekStart && prevYearDate <= weekEnd) {
        return prevYearDate;
      }
      const nextYearDate = new Date(year + 1, month - 1, day);
      if (nextYearDate >= weekStart && nextYearDate <= weekEnd) {
        return nextYearDate;
      }
    }
    
    // d日形式を試す
    const dayMatch = dateStr.match(/(\d+)日/);
    if (dayMatch) {
      const weekStart = parseWeekString(weekStr);
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      const day = parseInt(dayMatch[1], 10);
      const year = weekStart.getFullYear();
      const month = weekStart.getMonth();
      
      // 週の範囲内で該当する日付を探す
      for (let i = 0; i < 7; i++) {
        const candidateDate = new Date(weekStart);
        candidateDate.setDate(weekStart.getDate() + i);
        if (candidateDate.getDate() === day) {
          return candidateDate;
        }
      }
      
      // 前月または翌月の可能性を確認
      const prevMonthDate = new Date(year, month - 1, day);
      if (prevMonthDate >= weekStart && prevMonthDate <= weekEnd) {
        return prevMonthDate;
      }
      const nextMonthDate = new Date(year, month + 1, day);
      if (nextMonthDate >= weekStart && nextMonthDate <= weekEnd) {
        return nextMonthDate;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Failed to parse activity date:', dateStr, weekStr, error);
    return null;
  }
}

/**
 * 週次報告から活動内容を抽出（対象月に含まれる日付のみ）
 */
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
        const activityDate = parseActivityDate(activity.date || '', report.week);
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

/**
 * 週次報告から翌月の予定を集約
 */
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

/**
 * 週次報告から勤務に関する質問などを抽出
 */
function extractWorkQuestions(weeklyReports: WeeklyReport[]): string {
  // 暫定的には、noteをそのまま設定するか、空にする
  // 将来的には、noteから勤務に関する質問を抽出する必要があるかもしれない
  const notes: string[] = [];
  for (const report of weeklyReports) {
    if (report.note) {
      notes.push(report.note);
    }
  }
  return notes.join('\n\n');
}

/**
 * 週次報告から生活面の留意事項その他を抽出
 */
function extractLifeNotes(weeklyReports: WeeklyReport[]): string {
  // 暫定的には、noteをそのまま設定するか、空にする
  // 将来的には、noteから生活面の留意事項を抽出する必要があるかもしれない
  const notes: string[] = [];
  for (const report of weeklyReports) {
    if (report.note) {
      notes.push(report.note);
    }
  }
  return notes.join('\n\n');
}


/**
 * 月次報告を取得（詳細データ付き）
 */
export async function getMonthlyReportWithDetails(reportId: string) {
  const report = await prisma.monthlyReport.findUnique({
    where: { id: reportId },
    include: {
      creator: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      supportRecords: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          supportDate: 'asc',
        },
      },
    },
  });

  return report;
}

/**
 * まおいのはこ支援記録を追加
 */
export async function addSupportRecord(
  monthlyReportId: string,
  data: {
    userId: string;
    supportDate: Date;
    supportContent: string;
    supportBy: string;
  }
) {
  return await prisma.supportRecord.create({
    data: {
      monthlyReportId,
      ...data,
    },
  });
}
