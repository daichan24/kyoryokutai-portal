import prisma from '../lib/prisma';
import { format, addMonths, startOfMonth, endOfMonth } from 'date-fns';

interface ActivityItem {
  date: string;
  description: string;
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

    // 現在のメンバー分（テスト用のメンバー属性の佐藤大地以外）を作成
    const users = await prisma.user.findMany({
      where: { 
        role: 'MEMBER',
        // 佐藤大地（テスト用のメンバー属性）を除外する場合は、nameでフィルタリング
        // ただし、nameでのフィルタリングは柔軟性に欠けるため、roleのみでフィルタリング
      },
    });

    const memberSheets = [];

    for (const user of users) {
      try {
        const activities = await extractMonthlyActivities(user.id, month);

        memberSheets.push({
          userId: user.id,
          userName: user.name,
          missionType: user.missionType,
          thisMonthActivities: activities,
          nextMonthPlan: '',
          workQuestions: '',
          lifeNotes: '',
        });
      } catch (error) {
        console.error(`Error extracting activities for user ${user.id}:`, error);
        // エラーが発生しても空の活動リストで続行
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
 * 月の主な活動を抽出
 */
async function extractMonthlyActivities(
  userId: string,
  month: string
): Promise<ActivityItem[]> {
  const startDate = startOfMonth(new Date(`${month}-01`));
  const endDate = endOfMonth(startDate);

  const schedules = await prisma.schedule.findMany({
    where: {
      userId,
      date: {
        gte: startDate,
        lte: endDate,
      },
      OR: [
        {
          project: null,
        },
        {
          project: {
            projectName: {
              not: '役場業務',
            },
          },
        },
      ],
    },
    include: {
      project: true,
    },
    orderBy: {
      date: 'asc',
    },
  });

  const grouped = new Map<string, typeof schedules>();

  for (const schedule of schedules) {
    const dateKey = format(schedule.date, 'yyyy-MM-dd');
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(schedule);
  }

  const important: ActivityItem[] = [];

  for (const [dateKey, daySchedules] of grouped.entries()) {
    const sorted = daySchedules.sort((a, b) => {
      const durationA = calculateDuration(a.startTime || '', a.endTime || '');
      const durationB = calculateDuration(b.startTime || '', b.endTime || '');
      return durationB - durationA;
    });

    const topActivities = sorted.slice(0, 2);

    for (const activity of topActivities) {
      if (activity.activityDescription) {
        important.push({
          date: format(new Date(dateKey), 'd日'),
          description: activity.activityDescription,
        });
      }
    }
  }

  return important;
}

/**
 * 時間の長さを分で計算
 */
function calculateDuration(startTime: string | null, endTime: string | null): number {
  if (!startTime || !endTime) {
    return 0;
  }

  try {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);

    if (isNaN(startHour) || isNaN(startMinute) || isNaN(endHour) || isNaN(endMinute)) {
      return 0;
    }

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;

    return endMinutes - startMinutes;
  } catch (error) {
    console.error('Error calculating duration:', error);
    return 0;
  }
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
