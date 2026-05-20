import prisma from '../lib/prisma';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface ActivityItem {
  date: string;
  activity: string;
}

interface ReportScheduleParticipant {
  status: string;
  user?: { name: string | null } | null;
}

interface ReportScheduleProgress {
  progressBefore: number;
  progressAfter: number;
  projectTask?: { taskName: string } | null;
  goalTask?: { name: string } | null;
}

interface ReportSchedule {
  date: Date;
  startDate?: Date | null;
  startTime: string;
  endTime: string;
  title?: string | null;
  activityDescription?: string | null;
  locationText?: string | null;
  project?: {
    projectName: string;
    mission?: { missionName: string } | null;
  } | null;
  task?: {
    title: string;
    linkKind?: string;
    mission?: { missionName: string } | null;
  } | null;
  location?: { name: string } | null;
  scheduleParticipants?: ReportScheduleParticipant[];
  scheduleProgress?: ReportScheduleProgress[];
}

function parseWeekStart(week: string) {
  const weekMatch = week.match(/^(\d{4})-(\d{2})$/);
  if (!weekMatch) {
    throw new Error('Invalid week format. Expected YYYY-WW');
  }

  const year = parseInt(weekMatch[1], 10);
  const weekNum = parseInt(weekMatch[2], 10);

  const yearStart = new Date(year, 0, 1);
  const firstMonday = new Date(yearStart);
  const dayOfWeek = yearStart.getDay();
  const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7;
  firstMonday.setDate(yearStart.getDate() + daysToMonday);

  const weekStart = new Date(firstMonday);
  weekStart.setDate(firstMonday.getDate() + (weekNum - 1) * 7);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

function endOfRange(start: Date, days: number) {
  const end = new Date(start);
  end.setDate(start.getDate() + days);
  end.setHours(23, 59, 59, 999);
  return end;
}

function formatScheduleActivity(schedule: ReportSchedule) {
  const title = schedule.title || schedule.activityDescription || '予定';
  const missionName = schedule.task?.mission?.missionName || schedule.project?.mission?.missionName;
  const projectName = schedule.project?.projectName;
  const location = schedule.location?.name || schedule.locationText;
  const participants = (schedule.scheduleParticipants || [])
    .filter((p) => p.status === 'APPROVED')
    .map((p) => p.user?.name)
    .filter(Boolean);
  const progressNotes = (schedule.scheduleProgress || [])
    .map((p) => {
      const target = p.projectTask?.taskName || p.goalTask?.name;
      if (!target) return null;
      return `${target} ${p.progressBefore}%→${p.progressAfter}%`;
    })
    .filter(Boolean);

  const parts = [
    `${format(schedule.startDate || schedule.date, 'M/d(E)', { locale: ja })} ${schedule.startTime}-${schedule.endTime}`,
    missionName ? `ミッション: ${missionName}` : null,
    projectName ? `プロジェクト: ${projectName}` : null,
    location ? `場所: ${location}` : null,
    `内容: ${title}`,
    participants.length > 0 ? `共同: ${participants.join('、')}` : null,
    progressNotes.length > 0 ? `進捗: ${progressNotes.join(' / ')}` : null,
  ].filter(Boolean);

  return parts.join(' / ');
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
  const weekStart = parseWeekStart(week);
  const weekEnd = endOfRange(weekStart, 6);

  const activities: ActivityItem[] = [];

  // 1. スケジュールから抽出 - 作成した予定と承認済み共同予定を対象にする
  const schedules = await prisma.schedule.findMany({
    where: {
      deletedAt: null,
      reportable: true,
      isTemplate: false,
      startDate: { lte: weekEnd },
      endDate: { gte: weekStart },
      OR: [
        { userId },
        {
          scheduleParticipants: {
            some: { userId, status: 'APPROVED' },
          },
        },
      ],
    },
    include: {
      project: {
        select: {
          id: true,
          projectName: true,
          mission: { select: { missionName: true } },
        },
      },
      task: {
        select: {
          title: true,
          linkKind: true,
          mission: { select: { missionName: true } },
        },
      },
      location: { select: { name: true } },
      scheduleParticipants: {
        include: { user: { select: { name: true } } },
      },
      scheduleProgress: {
        include: {
          projectTask: { select: { taskName: true } },
          goalTask: { select: { name: true } },
        },
      },
    },
    orderBy: [{ startDate: 'asc' }, { startTime: 'asc' }],
  });

  for (const schedule of schedules) {
    activities.push({
      date: format(schedule.startDate || schedule.date, 'yyyy-MM-dd'),
      activity: formatScheduleActivity(schedule),
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
    const reportDate = format(new Date(event.date), 'yyyy-MM-dd');
    const displayDate = format(new Date(event.date), 'M/d(E)', { locale: ja });
    const eventType = event.eventType === 'TOWN_OFFICIAL' ? '町公式' : event.eventType === 'TEAM' ? 'チーム' : 'その他';
    activities.push({
      date: reportDate,
      activity: `${displayDate} / イベント:${eventType} / ${event.eventName}${event.startTime ? ` / ${event.startTime}${event.endTime ? `-${event.endTime}` : ''}` : ''}`,
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
    const reportDate = format(task.updatedAt, 'yyyy-MM-dd');
    const displayDate = format(task.updatedAt, 'M/d(E)', { locale: ja });
    activities.push({
      date: reportDate,
      activity: `${displayDate} / プロジェクト: ${task.project.projectName} / ${task.taskName} 完了`,
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
    const reportDate = format(task.updatedAt, 'yyyy-MM-dd');
    const displayDate = format(task.updatedAt, 'M/d(E)', { locale: ja });
    let activityText = task.title;
    if (task.project) {
      activityText = `プロジェクト: ${task.project.projectName} / ${activityText}`;
    }
    activities.push({
      date: reportDate,
      activity: `${displayDate} / ${activityText} 完了`,
    });
  }

  // 日付順にソート
  activities.sort((a, b) => {
    return a.date.localeCompare(b.date);
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
  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setDate(weekStart.getDate() + 7);
  nextWeekStart.setHours(0, 0, 0, 0);
  const nextWeekEnd = endOfRange(nextWeekStart, 6);

  const nextWeekSchedules = await prisma.schedule.findMany({
    where: {
      deletedAt: null,
      reportable: true,
      isTemplate: false,
      startDate: { lte: nextWeekEnd },
      endDate: { gte: nextWeekStart },
      OR: [
        { userId },
        {
          scheduleParticipants: {
            some: { userId, status: 'APPROVED' },
          },
        },
      ],
    },
    include: {
      project: {
        select: {
          id: true,
          projectName: true,
          mission: { select: { missionName: true } },
        },
      },
      task: {
        select: {
          title: true,
          linkKind: true,
          mission: { select: { missionName: true } },
        },
      },
      location: { select: { name: true } },
      scheduleParticipants: {
        include: { user: { select: { name: true } } },
      },
      scheduleProgress: {
        include: {
          projectTask: { select: { taskName: true } },
          goalTask: { select: { name: true } },
        },
      },
    },
    take: 5, // 最大5件
    orderBy: [{ startDate: 'asc' }, { startTime: 'asc' }],
  });

  const nextWeekPlan = nextWeekSchedules
    .map(s => formatScheduleActivity(s))
    .join('\n');

  return {
    week,
    thisWeekActivities: uniqueActivities,
    nextWeekPlan: nextWeekPlan || '',
    note: '※ 自動作成された下書きです。必ず内容を確認・編集してください。',
  };
}
