import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import {
  notifyScheduleInvite,
  notifyScheduleInviteApproved,
  notifyScheduleInviteRejected,
} from '../services/notificationService';
import { calculateMissionProgress, calculateProjectProgress } from '../services/progressCalculator';
import { getActivityExpenseSummaryLite } from '../services/activityExpenseService';

const router = Router();

/** YYYY-MM から UTC 基準の暦日境界（DB @db.Date との比較ずれ対策） */
function calendarMonthBounds(ym: string) {
  const [ys, ms] = ym.split('-');
  const y = parseInt(ys, 10);
  const m = parseInt(ms, 10);
  const pad = (n: number) => String(n).padStart(2, '0');
  const startStr = `${y}-${pad(m)}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const endStr = `${y}-${pad(m)}-${pad(lastDay)}`;
  const monthStartDay = new Date(`${startStr}T12:00:00.000Z`);
  const monthEndDay = new Date(`${endStr}T12:00:00.000Z`);
  const monthStartReport = new Date(`${startStr}T00:00:00.000Z`);
  const monthEndReport = new Date(`${endStr}T23:59:59.999Z`);
  return { startStr, endStr, monthStartDay, monthEndDay, monthStartReport, monthEndReport };
}

function overlapsCalendarMonth(
  start: Date | null,
  end: Date | null,
  startStr: string,
  endStr: string,
): boolean {
  if (start == null && end == null) return true;
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const s = start != null ? ymd(new Date(start)) : '0000-01-01';
  const e = end != null ? ymd(new Date(end)) : '9999-12-31';
  return s <= endStr && e >= startStr;
}

router.use(authenticate);

// マスター・役場・サポート向け：面談で月次スケジュールを振り返る用
router.get('/for-interview-month', authorize('MASTER', 'SUPPORT', 'GOVERNMENT'), async (req: AuthRequest, res) => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : '';
    const month = typeof req.query.month === 'string' ? req.query.month : '';
    if (!userId || !/^\d{4}-\d{2}$/.test(month)) {
      return res.status(400).json({ error: 'userId と month（YYYY-MM形式）が必要です' });
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true, avatarColor: true },
    });
    if (!target || target.role !== 'MEMBER') {
      return res.status(404).json({ error: '隊員が見つかりません' });
    }

    const [ys, ms] = month.split('-');
    const y = parseInt(ys, 10);
    const m = parseInt(ms, 10);
    if (m < 1 || m > 12) {
      return res.status(400).json({ error: '無効な月です' });
    }

    const { startStr, endStr, monthStartDay, monthEndDay, monthStartReport, monthEndReport } =
      calendarMonthBounds(month);

    const monthOverlap = {
      startDate: { lte: monthEndDay },
      endDate: { gte: monthStartDay },
    };

    const schedules = await prisma.schedule.findMany({
      where: {
        isTemplate: false,
        OR: [
          { userId, ...monthOverlap },
          {
            scheduleParticipants: {
              some: { userId, status: 'APPROVED' },
            },
            ...monthOverlap,
          },
        ],
      },
      include: {
        project: { select: { id: true, projectName: true, themeColor: true } },
        location: { select: { id: true, name: true } },
        scheduleParticipants: {
          include: {
            user: { select: { id: true, name: true, avatarColor: true, role: true } },
          },
        },
      },
      orderBy: [{ startDate: 'asc' }, { startTime: 'asc' }],
    });

    const weeklyReports = await prisma.weeklyReport.findMany({
      where: {
        userId,
        submittedAt: { gte: monthStartReport, lte: monthEndReport },
      },
      select: {
        id: true,
        week: true,
        nextWeekPlan: true,
        note: true,
        thisWeekActivities: true,
        submittedAt: true,
      },
      orderBy: { submittedAt: 'asc' },
    });

    const legacyIds = new Set<string>();
    for (const s of schedules) {
      for (const pid of s.participants || []) {
        if (pid) legacyIds.add(pid);
      }
    }
    const knownFromRelation = new Set<string>();
    for (const s of schedules) {
      for (const p of s.scheduleParticipants) {
        knownFromRelation.add(p.userId);
      }
    }
    const missingLegacy = [...legacyIds].filter((id) => !knownFromRelation.has(id));
    const legacyUsers =
      missingLegacy.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: missingLegacy } },
            select: { id: true, name: true, avatarColor: true, role: true },
          })
        : [];
    const legacyMap = Object.fromEntries(legacyUsers.map((u) => [u.id, u]));

    const allMissions = await prisma.mission.findMany({
      where: { userId },
      include: {
        midGoals: {
          include: {
            subGoals: {
              include: { tasks: true },
            },
          },
        },
        tasks: {
          select: { id: true, title: true, status: true, dueDate: true, projectId: true },
        },
      },
    });

    const missionsKpi = await Promise.all(
      allMissions
        .filter((mi) => overlapsCalendarMonth(mi.startDate, mi.endDate, startStr, endStr))
        .map(async (mi) => {
          const progress = await calculateMissionProgress(mi.id);
          let goalTaskTotal = 0;
          let goalTaskCompleted = 0;
          for (const mg of mi.midGoals) {
            for (const sg of mg.subGoals) {
              for (const t of sg.tasks) {
                goalTaskTotal += 1;
                if (t.progress >= 100) goalTaskCompleted += 1;
              }
            }
          }
          const st = mi.tasks;
          return {
            id: mi.id,
            missionName: mi.missionName,
            missionType: mi.missionType,
            startDate: mi.startDate,
            endDate: mi.endDate,
            progress: Math.round(progress * 100) / 100,
            goalTasks: { total: goalTaskTotal, completed: goalTaskCompleted },
            standaloneTasks: {
              total: st.length,
              completed: st.filter((t) => t.status === 'COMPLETED').length,
            },
          };
        }),
    );

    const allProjects = await prisma.project.findMany({
      where: {
        OR: [{ userId }, { members: { some: { userId } } }],
      },
      include: {
        tasks: true,
        relatedTasks: { select: { id: true, title: true, status: true } },
        mission: { select: { id: true, missionName: true } },
      },
    });

    const projectsKpi = await Promise.all(
      allProjects
        .filter((p) => overlapsCalendarMonth(p.startDate, p.endDate, startStr, endStr))
        .map(async (p) => {
          const progress = await calculateProjectProgress(p.id);
          const pts = p.tasks;
          const rt = p.relatedTasks;
          return {
            id: p.id,
            projectName: p.projectName,
            phase: p.phase,
            themeColor: p.themeColor,
            startDate: p.startDate,
            endDate: p.endDate,
            mission: p.mission,
            progress: Math.round(progress * 100) / 100,
            projectTasks: {
              total: pts.length,
              completed: pts.filter((x) => x.progress >= 100).length,
            },
            relatedTasks: {
              total: rt.length,
              completed: rt.filter((x) => x.status === 'COMPLETED').length,
            },
          };
        }),
    );

    const consultations = await prisma.consultation.findMany({
      where: { memberId: userId },
      include: {
        targetUser: { select: { id: true, name: true, role: true, avatarColor: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 80,
    });

    const activityExpenseSummary = await getActivityExpenseSummaryLite(userId);

    res.json({
      member: { id: target.id, name: target.name, avatarColor: target.avatarColor },
      month,
      range: { from: monthStartReport.toISOString(), to: monthEndReport.toISOString() },
      missionsKpi,
      projectsKpi,
      consultations,
      activityExpenseSummary,
      schedules: schedules.map((s) => ({
        id: s.id,
        startDate: s.startDate,
        endDate: s.endDate,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        shortTitle: (s as { title?: string | null }).title ?? null,
        activityDescription: s.activityDescription,
        freeNote: s.freeNote,
        locationText: s.locationText,
        location: s.location,
        project: s.project,
        scheduleParticipants: s.scheduleParticipants,
        legacyParticipantUsers: (s.participants || [])
          .filter((id) => id && legacyMap[id])
          .map((id) => legacyMap[id]),
      })),
      weeklyReports,
    });
  } catch (error) {
    console.error('for-interview-month error:', error);
    res.status(500).json({ error: 'スケジュールの取得に失敗しました' });
  }
});

const createScheduleSchema = z.object({
  date: z.string(),
  endDate: z.string().optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  locationText: z.string().min(1, '場所を入力してください'),
  title: z.string().max(200).min(1, 'タイトルを入力してください'),
  activityDescription: z.string().optional(),
  freeNote: z.string().optional(),
  isPending: z.boolean().optional(),
  participantsUserIds: z.array(z.string()).optional(),
  projectId: z.string().optional().nullable(),
  taskId: z.string().optional().nullable(),
  supportEventId: z.string().uuid().optional().nullable(),
  customColor: z.string().max(20).optional().nullable(),
  compensatoryLeaveRequired: z.boolean().optional(),
  compensatoryLeaveType: z.enum(['FULL_DAY', 'TIME_ADJUST']).optional().nullable(),
  isHolidayWork: z.boolean().optional(),
  isDayOff: z.boolean().optional(),
  dayOffType: z.enum(['PAID', 'UNPAID', 'COMPENSATORY', 'TIME_ADJUST']).optional().nullable(),
});

const updateScheduleSchema = createScheduleSchema.partial();

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { userId, date, startDate, endDate, view, allMembers } = req.query;
    const currentUserId = req.user!.id;

    // 取得条件: 作成者であるか、承認済みの参加者である
    let where: any;

    // allMembersがtrueの場合、全メンバーのスケジュールを取得
    if (allMembers === 'true') {
      // 全メンバーのスケジュールを取得
      // まず全メンバー（表示順0番目を除く）を取得
      const members = await prisma.user.findMany({
        where: {
          role: 'MEMBER',
          displayOrder: {
            not: 0, // 表示順0番目のユーザー（テストユーザー）を除外
          },
        },
        select: { id: true },
      });
      
      const memberIds = members.map(m => m.id);
      
      // 全メンバーのスケジュールを取得
      where = {
        userId: {
          in: memberIds,
        },
      };
    } else {
      // 通常の取得条件: 作成者であるか、承認済みの参加者である
      where = {
        OR: [
          { userId: currentUserId }, // 自分が作成したスケジュール
          {
            scheduleParticipants: {
              some: {
                userId: currentUserId,
                status: 'APPROVED', // 承認済みの参加者
              },
            },
          },
        ],
      };

      // 既存のフィルター条件を適用
      if (userId) {
        // userId指定時は、そのユーザーが作成したもののみ
        where.userId = userId as string;
        delete where.OR; // OR条件を削除
      }
    }

    if (date) {
      const targetDate = new Date(date as string);
      // startDate〜endDateの範囲に指定日が含まれるスケジュールを取得
      where.startDate = { lte: targetDate };
      where.endDate = { gte: targetDate };
    } else if (startDate && endDate) {
      // 指定期間と重なるスケジュールを取得（startDate〜endDateが期間と重なる）
      where.startDate = { lte: new Date(endDate as string) };
      where.endDate = { gte: new Date(startDate as string) };
    } else if (view === 'week' || view === 'month') {
      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);

      if (view === 'week') {
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);
        const end = new Date(start);
        end.setDate(end.getDate() + 6);
        where.startDate = { lte: end };
        where.endDate = { gte: start };
      } else if (view === 'month') {
        start.setDate(1);
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);
        where.startDate = { lte: end };
        where.endDate = { gte: start };
      }
    }

    // 作成者かどうかを判定（where条件から）
    // allMembersがtrueの場合は全メンバーのスケジュールを取得するため、isCreatorはfalse
    const isCreator = allMembers !== 'true' && (where.userId === currentUserId || (where.OR && where.OR[0]?.userId === currentUserId));

    const schedules = await prisma.schedule.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatarColor: true,
          },
        },
        project: {
          select: {
            id: true,
            projectName: true,
            themeColor: true,
          },
        },
        supportEvent: {
          select: {
            id: true,
            eventName: true,
            startDate: true,
            endDate: true,
            supportSlotsNeeded: true,
          },
        },
        scheduleParticipants: {
          // 作成者の場合は全参加者を返す、参加者の場合は自分のみ
          // allMembersがtrueの場合は全参加者を返す
          where: (isCreator || allMembers === 'true') ? undefined : {
            userId: currentUserId,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                role: true,
                avatarColor: true,
              },
            },
          },
        },
        task: {
          select: {
            id: true,
            missionId: true,
            projectId: true,
            title: true,
            linkKind: true,
          },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    res.json(schedules);
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({ error: 'Failed to get schedules' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = createScheduleSchema.parse(req.body);
    const creatorId = req.user!.id;

    // 参加者リストから自分自身を除外
    const participantIds = (data.participantsUserIds || []).filter(
      (id) => id !== creatorId
    );

    // スケジュール作成
    // 日付のバリデーション
    // YYYY-MM-DD 形式の文字列を Date オブジェクトに変換
    // Prisma の @db.Date 型は日付のみを保存するため、時刻は00:00:00で統一
    const [year, month, day] = data.date.split('-').map(Number);
    const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    
    if (isNaN(startDate.getTime())) {
      return res.status(400).json({ error: 'Invalid start date format' });
    }
    
    let endDate: Date;
    if (data.endDate) {
      const [endYear, endMonth, endDay] = data.endDate.split('-').map(Number);
      endDate = new Date(endYear, endMonth - 1, endDay, 0, 0, 0, 0);
    } else {
      endDate = startDate; // 終了日が指定されていない場合は開始日と同じ
    }
    
    if (isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid end date format' });
    }
    
    console.log('Creating schedule with:', {
      inputDate: data.date,
      inputEndDate: data.endDate,
      startDate: startDate.toISOString(),
      startDateLocal: startDate.toString(),
      endDate: endDate.toISOString(),
      endDateLocal: endDate.toString(),
      startTime: data.startTime,
      endTime: data.endTime,
      title: data.title,
      activityDescription: data.activityDescription,
      participantIds: participantIds.length,
    });
    
    const schedule = await prisma.schedule.create({
      data: {
        userId: creatorId,
        date: startDate,
        startDate: startDate,
        endDate: endDate,
        startTime: data.startTime,
        endTime: data.endTime,
        locationText: data.locationText || null,
        title: data.title,
        activityDescription: data.activityDescription || '',
        freeNote: data.freeNote || null,
        isPending: data.isPending || false,
        projectId: data.projectId || null,
        taskId: data.taskId || null,
        supportEventId: data.supportEventId || null,
        customColor: (data as any).customColor || null,
        compensatoryLeaveRequired: (data as any).compensatoryLeaveRequired ?? false,
        compensatoryLeaveType: (data as any).compensatoryLeaveType ?? null,
        isHolidayWork: (data as any).isHolidayWork ?? false,
        isDayOff: (data as any).isDayOff ?? false,
        dayOffType: (data as any).dayOffType ?? null,
        scheduleParticipants: participantIds.length > 0 ? {
          create: participantIds.map((userId) => ({
            userId,
            status: 'PENDING',
          })),
        } : undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatarColor: true,
          },
        },
        supportEvent: {
          select: {
            id: true,
            eventName: true,
            startDate: true,
            endDate: true,
            supportSlotsNeeded: true,
          },
        },
        scheduleParticipants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarColor: true,
              },
            },
          },
        },
      },
    });

    // 参加者へ通知を送信（エラーが発生してもスケジュール作成は成功とする）
    if (participantIds.length > 0) {
      try {
        const creator = await prisma.user.findUnique({
          where: { id: creatorId },
          select: { name: true },
        });

        const startAt = new Date(`${data.date}T${data.startTime}`);
        const endAt = new Date(`${data.date}T${data.endTime}`);

        for (const participantId of participantIds) {
          try {
            await notifyScheduleInvite(
              participantId,
              creator?.name || 'ユーザー',
              data.activityDescription || data.title, // 活動内容がない場合はタイトルを使用
              schedule.id,
              startAt,
              endAt
            );
          } catch (notifyError) {
            console.error(`Failed to notify participant ${participantId}:`, notifyError);
            // 通知エラーは無視して続行
          }
        }
      } catch (notifyError) {
        console.error('Failed to send notifications:', notifyError);
        // 通知エラーは無視して続行
      }
    }

    res.status(201).json(schedule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Zod validation error:', error.errors);
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create schedule error:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      
      // Prismaエラーの場合は詳細を返す
      if (error.message.includes('prisma') || error.message.includes('Prisma')) {
        return res.status(500).json({ 
          error: 'Failed to create schedule',
          details: error.message,
          type: 'PrismaError'
        });
      }
      
      return res.status(500).json({ 
        error: 'Failed to create schedule',
        details: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
    res.status(500).json({ error: 'Failed to create schedule', details: String(error) });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    console.log('=== Schedule PUT Request ===');
    console.log('Schedule ID:', id);
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Request body keys:', Object.keys(req.body));
    
    const data = updateScheduleSchema.parse(req.body);

    const existingSchedule = await prisma.schedule.findUnique({
      where: { id },
    });

    if (!existingSchedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // 編集権限: 作成者のみ（participantは不可）
    if (existingSchedule.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Only the creator can edit this schedule' });
    }

    // 安全に updateData を構築（スプレッドではなく明示的にフィールドを設定）
    const updateData: any = {};

    // 日付フィールドの処理
    // YYYY-MM-DD 形式の文字列を Date オブジェクトに変換
    // Prisma の @db.Date 型は日付のみを保存するため、時刻は00:00:00で統一
    if (data.date) {
      // YYYY-MM-DD 形式の文字列から Date オブジェクトを作成
      // new Date("2026-04-19") は UTC として解釈されるため、
      // 明示的にローカルタイムゾーン（サーバーのタイムゾーン）で作成する
      const [year, month, day] = data.date.split('-').map(Number);
      const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
      
      if (isNaN(startDate.getTime())) {
        return res.status(400).json({ error: '無効な開始日です' });
      }
      
      const dataWithEndDate = data as any;
      let endDate: Date;
      if (dataWithEndDate.endDate) {
        const [endYear, endMonth, endDay] = dataWithEndDate.endDate.split('-').map(Number);
        endDate = new Date(endYear, endMonth - 1, endDay, 0, 0, 0, 0);
      } else {
        endDate = startDate;
      }
      
      if (isNaN(endDate.getTime())) {
        return res.status(400).json({ error: '無効な終了日です' });
      }
      
      // 終了日が開始日より前の場合はエラー
      if (endDate < startDate) {
        return res.status(400).json({ error: '終了日は開始日以降の日付を指定してください' });
      }
      
      console.log('Schedule update - date conversion:', {
        inputDate: data.date,
        inputEndDate: dataWithEndDate.endDate,
        startDate: startDate.toISOString(),
        startDateLocal: startDate.toString(),
        endDate: endDate.toISOString(),
        endDateLocal: endDate.toString(),
        startTime: data.startTime,
        endTime: data.endTime,
      });
      
      updateData.date = startDate; // 後方互換性のため
      updateData.startDate = startDate;
      updateData.endDate = endDate;
    } else {
      const dataWithEndDate = data as any;
      if (dataWithEndDate.endDate) {
        // 既存のstartDateを取得（優先順位: startDate > date）
        const existingStartDate = existingSchedule.startDate || existingSchedule.date;
        if (!existingStartDate) {
          return res.status(400).json({ error: '開始日が設定されていません' });
        }
        const [endYear, endMonth, endDay] = dataWithEndDate.endDate.split('-').map(Number);
        const endDate = new Date(endYear, endMonth - 1, endDay, 0, 0, 0, 0);
        if (isNaN(endDate.getTime())) {
          return res.status(400).json({ error: '無効な終了日です' });
        }
        // 終了日が開始日より前の場合はエラー
        if (endDate < existingStartDate) {
          return res.status(400).json({ error: '終了日は開始日以降の日付を指定してください' });
        }
        updateData.endDate = endDate;
        updateData.startDate = existingStartDate;
        updateData.date = existingStartDate; // 後方互換性のため
      }
    }

    // テキストフィールド
    if (data.title !== undefined) updateData.title = data.title;
    if (data.startTime !== undefined) updateData.startTime = data.startTime;
    if (data.endTime !== undefined) updateData.endTime = data.endTime;
    if (data.locationText !== undefined) updateData.locationText = data.locationText || null;
    if (data.activityDescription !== undefined) updateData.activityDescription = data.activityDescription;
    if (data.freeNote !== undefined) updateData.freeNote = data.freeNote || null;
    if (data.isPending !== undefined) updateData.isPending = data.isPending;

    // 関連フィールド（nullも許可）
    if (data.projectId !== undefined) updateData.projectId = data.projectId || null;
    if (data.taskId !== undefined) updateData.taskId = data.taskId || null;
    if (data.supportEventId !== undefined) updateData.supportEventId = data.supportEventId || null;
    if ((data as any).customColor !== undefined) updateData.customColor = (data as any).customColor || null;
    if ((data as any).compensatoryLeaveRequired !== undefined) updateData.compensatoryLeaveRequired = (data as any).compensatoryLeaveRequired;
    if ((data as any).compensatoryLeaveType !== undefined) updateData.compensatoryLeaveType = (data as any).compensatoryLeaveType ?? null;
    if ((data as any).isHolidayWork !== undefined) updateData.isHolidayWork = (data as any).isHolidayWork;
    if ((data as any).isDayOff !== undefined) updateData.isDayOff = (data as any).isDayOff;
    if ((data as any).dayOffType !== undefined) updateData.dayOffType = (data as any).dayOffType ?? null;

    const schedule = await prisma.schedule.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatarColor: true,
          },
        },
        supportEvent: {
          select: {
            id: true,
            eventName: true,
            startDate: true,
            endDate: true,
            supportSlotsNeeded: true,
          },
        },
        scheduleParticipants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                role: true,
                avatarColor: true,
              },
            },
          },
        },
      },
    });

    // 参加者の更新（participantsUserIdsが指定された場合）
    const participantsUserIds = (data as any).participantsUserIds as string[] | undefined;
    if (participantsUserIds !== undefined) {
      const creatorId = req.user!.id;
      const newParticipantIds = participantsUserIds.filter((uid) => uid !== creatorId);
      // 既存の参加者を削除して再作成
      await prisma.scheduleParticipant.deleteMany({ where: { scheduleId: id } });
      if (newParticipantIds.length > 0) {
        await prisma.scheduleParticipant.createMany({
          data: newParticipantIds.map((userId) => ({
            scheduleId: id,
            userId,
            status: 'PENDING',
          })),
          skipDuplicates: true,
        });
      }
    }

    res.json(schedule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Schedule update validation error:', error.errors);
      return res.status(400).json({ 
        error: 'バリデーションエラー', 
        details: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      });
    }
    console.error('Update schedule error:', error);
    
    // Prismaエラーの詳細を返す
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as any;
      return res.status(500).json({ 
        error: 'データベースエラー',
        message: prismaError.message || 'データベース操作に失敗しました',
        code: prismaError.code
      });
    }
    
    res.status(500).json({ 
      error: 'スケジュールの更新に失敗しました', 
      message: error instanceof Error ? error.message : String(error) 
    });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existingSchedule = await prisma.schedule.findUnique({
      where: { id },
    });

    if (!existingSchedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // 削除権限: 作成者のみ（participantは不可）
    if (existingSchedule.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Only the creator can delete this schedule' });
    }

    await prisma.schedule.delete({
      where: { id },
    });

    res.json({ message: 'Schedule deleted successfully' });
  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

// 繰り返しスケジュール一括作成
router.post('/recurring', async (req: AuthRequest, res) => {
  try {
    const schema = z.object({
      title: z.string().min(1),
      startTime: z.string().regex(/^\d{2}:\d{2}$/),
      endTime: z.string().regex(/^\d{2}:\d{2}$/),
      activityDescription: z.string().optional(),
      locationText: z.string().optional(),
      projectId: z.string().optional().nullable(),
      customColor: z.string().optional().nullable(),
      // 繰り返し設定
      recurrenceType: z.enum(['weekly', 'daily']),
      weekdays: z.array(z.number().min(0).max(6)).optional(), // 0=日, 1=月, ..., 6=土
      startDate: z.string(), // 開始日 YYYY-MM-DD
      recurrenceEndDate: z.string(), // 繰り返し終了日 YYYY-MM-DD
    });

    const data = schema.parse(req.body);
    const creatorId = req.user!.id;

    const start = new Date(data.startDate);
    const end = new Date(data.recurrenceEndDate);

    if (end < start) {
      return res.status(400).json({ error: '終了日は開始日以降にしてください' });
    }

    // 対象日付を生成
    const targetDates: Date[] = [];
    const current = new Date(start);
    current.setHours(12, 0, 0, 0);
    const endNorm = new Date(end);
    endNorm.setHours(12, 0, 0, 0);

    while (current <= endNorm) {
      if (data.recurrenceType === 'daily') {
        targetDates.push(new Date(current));
      } else if (data.recurrenceType === 'weekly') {
        const dow = current.getDay(); // 0=日
        if (!data.weekdays || data.weekdays.includes(dow)) {
          targetDates.push(new Date(current));
        }
      }
      current.setDate(current.getDate() + 1);
    }

    if (targetDates.length === 0) {
      return res.status(400).json({ error: '指定した条件に一致する日付がありません' });
    }

    if (targetDates.length > 365) {
      return res.status(400).json({ error: '一度に作成できるスケジュールは365件までです' });
    }

    // 一括作成
    const created = await prisma.$transaction(
      targetDates.map((d) =>
        prisma.schedule.create({
          data: {
            userId: creatorId,
            date: d,
            startDate: d,
            endDate: d,
            startTime: data.startTime,
            endTime: data.endTime,
            title: data.title,
            activityDescription: data.activityDescription || data.title,
            locationText: data.locationText || null,
            projectId: data.projectId || null,
            customColor: data.customColor || null,
            isPending: false,
            createdBy: 'RECURRENCE',
          },
        })
      )
    );

    res.status(201).json({ count: created.length, schedules: created });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create recurring schedules error:', error);
    res.status(500).json({ error: 'Failed to create recurring schedules' });
  }
});

// スケジュール招待への承認/却下
router.post('/:id/respond', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { decision } = req.body;
    const currentUserId = req.user!.id;

    if (!decision || !['APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ error: 'Invalid decision. Must be APPROVED or REJECTED' });
    }

    // 参加者レコードを取得
    const participant = await prisma.scheduleParticipant.findUnique({
      where: {
        scheduleId_userId: {
          scheduleId: id,
          userId: currentUserId,
        },
      },
      include: {
        schedule: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!participant) {
      return res.status(404).json({ error: 'Schedule invitation not found' });
    }

    // ステータス更新
    const updatedParticipant = await prisma.scheduleParticipant.update({
      where: {
        scheduleId_userId: {
          scheduleId: id,
          userId: currentUserId,
        },
      },
      data: {
        status: decision,
        respondedAt: new Date(),
      },
    });

    // 作成者へ通知
    if (decision === 'APPROVED') {
      await notifyScheduleInviteApproved(
        participant.schedule.userId,
        participant.user.name,
        participant.schedule.activityDescription,
        id
      );
    } else {
      await notifyScheduleInviteRejected(
        participant.schedule.userId,
        participant.user.name,
        participant.schedule.activityDescription,
        id
      );
    }

    res.json(updatedParticipant);
  } catch (error) {
    console.error('Respond to schedule invite error:', error);
    res.status(500).json({ error: 'Failed to respond to schedule invite' });
  }
});

export default router;
