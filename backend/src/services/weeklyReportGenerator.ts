import prisma from '../lib/prisma';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface ActivityItem {
  date: string;
  activity: string;
  projectId?: string | null;
  projectName?: string;
  sourceType?: 'schedule' | 'event' | 'projectTask' | 'task';
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
    id?: string;
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

function activityProjectLabel(projectName?: string | null) {
  return projectName?.trim() || '未紐づけ';
}

export function normalizeWeeklyReportWeek(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const weekMatch = value.trim().match(/^(\d{4})-W?(\d{2})$/);
  if (!weekMatch) {
    return null;
  }

  const year = parseInt(weekMatch[1], 10);
  const weekNum = parseInt(weekMatch[2], 10);
  if (weekNum < 1 || weekNum > 53) return null;

  return `${year}-${String(weekNum).padStart(2, '0')}`;
}

function parseWeekStart(week: string) {
  const normalized = normalizeWeeklyReportWeek(week);
  if (!normalized) {
    throw new Error('Invalid week format. Expected YYYY-WW or YYYY-Www');
  }

  const [yearText, weekText] = normalized.split('-');
  const year = parseInt(yearText, 10);
  const weekNum = parseInt(weekText, 10);

  const jan4 = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const firstIsoMonday = new Date(jan4);
  firstIsoMonday.setDate(jan4.getDate() - jan4Day + 1);

  const weekStart = new Date(firstIsoMonday);
  weekStart.setDate(firstIsoMonday.getDate() + (weekNum - 1) * 7);
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
  reflection: string;
  note: string;
}> {
  const normalizedWeek = normalizeWeeklyReportWeek(week);
  if (!normalizedWeek) {
    throw new Error('Invalid week format. Expected YYYY-WW or YYYY-Www');
  }

  const weekStart = parseWeekStart(normalizedWeek);
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
    const projectName = schedule.project?.projectName || schedule.task?.mission?.missionName || schedule.project?.mission?.missionName;
    activities.push({
      date: format(schedule.startDate || schedule.date, 'yyyy-MM-dd'),
      activity: formatScheduleActivity(schedule),
      projectId: schedule.project?.id || null,
      projectName: activityProjectLabel(projectName),
      sourceType: 'schedule',
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
    const eventType = event.eventType === 'TOWN_OFFICIAL' ? '町公式' : event.eventType === 'TEAM' ? 'チーム' : 'その他';
    activities.push({
      date: reportDate,
      activity: `イベント:${eventType} / ${event.eventName}`,
      projectId: null,
      projectName: 'イベント',
      sourceType: 'event',
    });
  }

  // 3. プロジェクトタスクから抽出（期日が対象週のもの）
  const projectTasks = await prisma.projectTask.findMany({
    where: {
      OR: [
        { assignedTo: userId },
        { project: { userId } },
        { project: { members: { some: { userId } } } },
      ],
      deadline: {
        gte: weekStart,
        lte: weekEnd,
      },
    },
    include: {
      project: {
        select: {
          id: true,
          projectName: true,
        },
      },
    },
    orderBy: {
      updatedAt: 'asc',
    },
  });

  for (const task of projectTasks) {
    if (!task.deadline) continue;
    const reportSourceDate = task.deadline;
    const reportDate = format(reportSourceDate, 'yyyy-MM-dd');
    const displayDate = format(reportSourceDate, 'M/d(E)', { locale: ja });
    activities.push({
      date: reportDate,
      activity: `${displayDate} / プロジェクト: ${task.project.projectName} / ${task.taskName}`,
      projectId: task.project.id,
      projectName: activityProjectLabel(task.project.projectName),
      sourceType: 'projectTask',
    });
  }

  // 4. タスク（小目標）から抽出（開始日として扱う日付が対象週のもの）
  const tasks = await prisma.task.findMany({
    where: {
      mission: {
        userId,
      },
      dueDate: {
        gte: weekStart,
        lte: weekEnd,
      },
    },
    include: {
      project: {
        select: {
          id: true,
          projectName: true,
        },
      },
      mission: {
        select: {
          missionName: true,
        },
      },
    },
    orderBy: {
      updatedAt: 'asc',
    },
  });

  for (const task of tasks) {
    if (!task.dueDate) continue;
    const reportSourceDate = task.dueDate;
    const reportDate = format(reportSourceDate, 'yyyy-MM-dd');
    const displayDate = format(reportSourceDate, 'M/d(E)', { locale: ja });
    let activityText = task.title;
    if (task.project) {
      activityText = `プロジェクト: ${task.project.projectName} / ${activityText}`;
    }
    activities.push({
      date: reportDate,
      activity: `${displayDate} / ${activityText}`,
      projectId: task.project?.id || null,
      projectName: activityProjectLabel(task.project?.projectName || task.mission?.missionName),
      sourceType: 'task',
    });
  }

  // プロジェクトごとに並べ、その中で日付順にソート
  activities.sort((a, b) => {
    const projectCompare = activityProjectLabel(a.projectName).localeCompare(activityProjectLabel(b.projectName), 'ja');
    if (projectCompare !== 0) return projectCompare;
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
    week: normalizedWeek,
    thisWeekActivities: uniqueActivities,
    nextWeekPlan: nextWeekPlan || '',
    reflection: '',
    note: '',
  };
}
