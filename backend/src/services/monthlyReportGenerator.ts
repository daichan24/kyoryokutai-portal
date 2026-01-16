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
  const users = await prisma.user.findMany({
    where: { role: 'MEMBER' },
  });

  const memberSheets = [];

  for (const user of users) {
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
  }

  // 月次報告を作成
  const report = await prisma.monthlyReport.create({
    data: {
      month,
      createdBy,
      memberSheets: memberSheets as any,
    },
  });

  // 注意: 支援記録は作成時に必ず月次報告に紐付けられるため、
  // 月次報告作成時に既存の支援記録を紐付ける処理は不要
  // 支援記録は支援記録作成APIで自動的に月次報告に紐付けられる

  return report;
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
      project: {
        projectName: {
          not: '役場業務',
        },
      },
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
      const durationA = calculateDuration(a.startTime, a.endTime);
      const durationB = calculateDuration(b.startTime, b.endTime);
      return durationB - durationA;
    });

    const topActivities = sorted.slice(0, 2);

    for (const activity of topActivities) {
      important.push({
        date: format(new Date(dateKey), 'd日'),
        description: activity.activityDescription,
      });
    }
  }

  return important;
}

/**
 * 時間の長さを分で計算
 */
function calculateDuration(startTime: string, endTime: string): number {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);

  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  return endMinutes - startMinutes;
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
