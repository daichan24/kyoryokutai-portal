import prisma from '../lib/prisma';
import { format, startOfWeek, endOfWeek, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';

interface ActivityItem {
  date: string;
  activity: string;
}

/**
 * 週次報告を自動作成（カレンダーからタスク・イベント・プロジェクトを自動抽出）
 */
export async function generateWeeklyReportDraft(userId: string, week: string): Promise<{
  week: string;
  thisWeekActivities: ActivityItem[];
  nextWeekPlan: string;
  note: string;
}> {
  // 週の開始日と終了日を計算
  const weekMatch = week.match(/^(\d{4})-(\d{2})$/);
  if (!weekMatch) {
    throw new Error('Invalid week format. Expected YYYY-WW');
  }

  const year = parseInt(weekMatch[1]);
  const weekNum = parseInt(weekMatch[2]);

  // 年の最初の月曜日を基準に週を計算
  const yearStart = new Date(year, 0, 1);
  const firstMonday = new Date(yearStart);
  const dayOfWeek = yearStart.getDay();
  const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7;
  firstMonday.setDate(yearStart.getDate() + daysToMonday);

  // 指定された週の開始日
  const weekStart = new Date(firstMonday);
  weekStart.setDate(firstMonday.getDate() + (weekNum - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const activities: ActivityItem[] = [];

  // 1. スケジュール（タスク）から抽出 - 自分のカレンダーのすべてのスケジュール
  const schedules = await prisma.schedule.findMany({
    where: {
      userId,
      date: {
        gte: weekStart,
        lte: weekEnd,
      },
    },
    include: {
      project: {
        select: {
          projectName: true,
        },
      },
    },
    orderBy: {
      date: 'asc',
    },
  });

  for (const schedule of schedules) {
    const dateStr = format(schedule.date, 'M/d(E)', { locale: ja });
    let activityText = schedule.activityDescription;
    if (schedule.project) {
      activityText = `[${schedule.project.projectName}] ${activityText}`;
    }
    activities.push({
      date: dateStr,
      activity: activityText,
    });
  }

  // 2. イベントから抽出 - 自分のカレンダーに入っているすべてのイベント（共同イベント含む）
  const events = await prisma.event.findMany({
    where: {
      date: {
        gte: weekStart,
        lte: weekEnd,
      },
      participations: {
        some: {
          userId,
        },
      },
    },
    include: {
      participations: {
        where: {
          userId,
        },
      },
    },
    orderBy: {
      date: 'asc',
    },
  });

  for (const event of events) {
    const dateStr = format(new Date(event.date), 'M/d(E)', { locale: ja });
    const eventType = event.eventType === 'TOWN_OFFICIAL' ? '町公式' : event.eventType === 'TEAM' ? 'チーム' : 'その他';
    activities.push({
      date: dateStr,
      activity: `[イベント:${eventType}] ${event.eventName}${event.startTime ? ` (${event.startTime}${event.endTime ? `-${event.endTime}` : ''})` : ''}`,
    });
  }

  // 3. プロジェクトタスクから抽出（完了したもの：progress=100）
  const projectTasks = await prisma.projectTask.findMany({
    where: {
      assignedTo: userId,
      progress: 100,
      updatedAt: {
        gte: weekStart,
        lte: weekEnd,
      },
    },
    include: {
      project: {
        select: {
          projectName: true,
        },
      },
    },
    orderBy: {
      updatedAt: 'asc',
    },
  });

  for (const task of projectTasks) {
    const dateStr = format(task.updatedAt, 'M/d(E)', { locale: ja });
    activities.push({
      date: dateStr,
      activity: `[${task.project.projectName}] ${task.taskName} 完了`,
    });
  }

  // 4. タスク（小目標）から抽出（完了したもの）
  const tasks = await prisma.task.findMany({
    where: {
      mission: {
        userId,
      },
      status: 'COMPLETED',
      updatedAt: {
        gte: weekStart,
        lte: weekEnd,
      },
    },
    include: {
      project: {
        select: {
          projectName: true,
        },
      },
    },
    orderBy: {
      updatedAt: 'asc',
    },
  });

  for (const task of tasks) {
    const dateStr = format(task.updatedAt, 'M/d(E)', { locale: ja });
    let activityText = task.title;
    if (task.project) {
      activityText = `[${task.project.projectName}] ${activityText}`;
    }
    activities.push({
      date: dateStr,
      activity: `${activityText} 完了`,
    });
  }

  // 日付順にソート
  activities.sort((a, b) => {
    const dateA = new Date(a.date);
    const dateB = new Date(b.date);
    return dateA.getTime() - dateB.getTime();
  });

  // 重複を除去（同じ日付・同じ内容）
  const uniqueActivities: ActivityItem[] = [];
  const seen = new Set<string>();
  for (const activity of activities) {
    const key = `${activity.date}-${activity.activity}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueActivities.push(activity);
    }
  }

  // 来週の予定（簡易版）
  const nextWeekStart = new Date(weekEnd);
  nextWeekStart.setDate(weekEnd.getDate() + 1);
  const nextWeekEnd = new Date(nextWeekStart);
  nextWeekEnd.setDate(nextWeekStart.getDate() + 6);

  const nextWeekSchedules = await prisma.schedule.findMany({
    where: {
      userId,
      date: {
        gte: nextWeekStart,
        lte: nextWeekEnd,
      },
    },
    include: {
      project: {
        select: {
          projectName: true,
        },
      },
    },
    take: 5, // 最大5件
    orderBy: {
      date: 'asc',
    },
  });

  const nextWeekPlan = nextWeekSchedules
    .map(s => {
      const dateStr = format(s.date, 'M/d(E)', { locale: ja });
      let text = s.activityDescription;
      if (s.project) {
        text = `[${s.project.projectName}] ${text}`;
      }
      return `${dateStr}: ${text}`;
    })
    .join('\n');

  return {
    week,
    thisWeekActivities: uniqueActivities,
    nextWeekPlan: nextWeekPlan || '',
    note: '※ 自動作成された下書きです。必ず内容を確認・編集してください。',
  };
}

