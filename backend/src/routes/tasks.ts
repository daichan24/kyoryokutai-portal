import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const taskSchema = z.object({
  title: z.string().min(1, 'タイトルは必須です'),
  description: z.string().optional(),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']).optional(),
  projectId: z.string().optional().nullable(),
  order: z.number().int().optional(),
  dueDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  linkKind: z.enum(['PROJECT', 'UNSET', 'KYORYOKUTAI_WORK', 'YAKUBA_WORK', 'TRIAGE_PENDING']).optional(),
  // スケジュール連携フィールド
  locationText: z.string().optional(),
  freeNote: z.string().optional(),
  customColor: z.string().max(20).optional().nullable(),
  supportEventId: z.string().uuid().optional().nullable(),
  participantsUserIds: z.array(z.string()).optional(),
});

function resolveTaskLinkKind(
  projectId: string | null | undefined,
  linkKind?: 'PROJECT' | 'UNSET' | 'KYORYOKUTAI_WORK' | 'YAKUBA_WORK' | 'TRIAGE_PENDING',
): 'PROJECT' | 'UNSET' | 'KYORYOKUTAI_WORK' | 'YAKUBA_WORK' | 'TRIAGE_PENDING' {
  if (projectId) return 'PROJECT';
  if (linkKind === 'KYORYOKUTAI_WORK') return 'KYORYOKUTAI_WORK';
  if (linkKind === 'YAKUBA_WORK') return 'YAKUBA_WORK';
  if (linkKind === 'TRIAGE_PENDING') return 'TRIAGE_PENDING';
  return 'UNSET';
}

function resolveTaskLinkKindOnUpdate(
  projectId: string | null,
  linkKind: 'PROJECT' | 'UNSET' | 'KYORYOKUTAI_WORK' | 'YAKUBA_WORK' | 'TRIAGE_PENDING' | undefined,
  previous: 'PROJECT' | 'UNSET' | 'KYORYOKUTAI_WORK' | 'YAKUBA_WORK' | 'TRIAGE_PENDING',
): 'PROJECT' | 'UNSET' | 'KYORYOKUTAI_WORK' | 'YAKUBA_WORK' | 'TRIAGE_PENDING' {
  if (projectId) return 'PROJECT';
  if (linkKind !== undefined) {
    if (linkKind === 'KYORYOKUTAI_WORK') return 'KYORYOKUTAI_WORK';
    if (linkKind === 'YAKUBA_WORK') return 'YAKUBA_WORK';
    if (linkKind === 'TRIAGE_PENDING') return 'TRIAGE_PENDING';
    return 'UNSET';
  }
  return previous;
}

/**
 * GET /api/missions/:missionId/tasks
 * ミッションのタスク一覧を取得
 * オプション: projectId でフィルタリング可能
 */
router.get('/missions/:missionId/tasks', async (req: AuthRequest, res) => {
  try {
    const { missionId } = req.params;
    const { projectId } = req.query;

    // ミッションの存在確認と権限チェック
    const mission = await prisma.mission.findUnique({
      where: { id: missionId },
      select: { id: true, userId: true },
    });

    if (!mission) {
      return res.status(404).json({ error: 'ミッションが見つかりません' });
    }

    // 権限チェック
    // MEMBERは自分のミッションのみ、他は全ミッション閲覧可
    if (req.user!.role === 'MEMBER' && mission.userId !== req.user!.id) {
      return res.status(403).json({ error: '権限がありません' });
    }

    // タスクを取得（projectId でフィルタリング可能）
    const where: any = { missionId };
    if (projectId) {
      where.projectId = projectId;
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            projectName: true,
            user: { select: { id: true, name: true, avatarColor: true } },
          },
        },
        mission: {
          select: { id: true, missionName: true, userId: true },
        },
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    // userId をミッションから付与して返す
    const tasksWithUserId = tasks.map((t) => ({
      ...t,
      userId: t.mission.userId,
    }));

    res.json(tasksWithUserId);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'タスクの取得に失敗しました' });
  }
});

/**
 * POST /api/missions/:missionId/tasks
 * タスクを作成
 * 権限: MASTER/SUPPORT: 全ミッション、MEMBER: 自分のミッションのみ
 */
router.post('/missions/:missionId/tasks', async (req: AuthRequest, res) => {
  try {
    const { missionId } = req.params;
    const data = taskSchema.parse(req.body);

    // ミッションの存在確認と権限チェック
    const mission = await prisma.mission.findUnique({
      where: { id: missionId },
      select: { id: true, userId: true },
    });

    if (!mission) {
      return res.status(404).json({ error: 'ミッションが見つかりません' });
    }

    // 権限チェック
    if (req.user!.role === 'GOVERNMENT') {
      return res.status(403).json({ error: '権限がありません' });
    }
    if (req.user!.role === 'MEMBER' && mission.userId !== req.user!.id) {
      return res.status(403).json({ error: '権限がありません' });
    }

    // projectId が指定されている場合、そのプロジェクトが同じミッションに属しているか確認
    if (data.projectId) {
      const project = await prisma.project.findUnique({
        where: { id: data.projectId },
        select: { id: true, missionId: true },
      });

      if (!project) {
        return res.status(404).json({ error: 'プロジェクトが見つかりません' });
      }

      if (project.missionId !== missionId) {
        return res.status(400).json({ error: 'プロジェクトがこのミッションに属していません' });
      }
    }

    // orderが指定されていない場合は最後に追加
    let order = data.order;
    if (order === undefined) {
      const lastTask = await prisma.task.findFirst({
        where: { missionId },
        orderBy: { order: 'desc' },
      });
      order = lastTask ? lastTask.order + 1 : 0;
    }

    const linkKind = resolveTaskLinkKind(data.projectId || null, data.linkKind);

    const task = await prisma.task.create({
      data: {
        missionId,
        projectId: data.projectId || null,
        title: data.title,
        description: data.description || null,
        status: data.status || 'NOT_STARTED',
        order,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        linkKind,
      },
      include: {
        project: {
          select: {
            id: true,
            projectName: true,
          },
        },
      },
    });

    // dueDateが指定されている場合、スケジュールを自動生成
    if (data.dueDate) {
      try {
        const startDate = new Date(data.dueDate);
        const endDate = data.endDate ? new Date(data.endDate) : startDate;
        const schedule = await prisma.schedule.create({
          data: {
            userId: mission.userId,
            date: startDate,
            startDate: startDate,
            endDate: endDate,
            startTime: data.startTime || '09:00',
            endTime: data.endTime || '17:00',
            title: data.title,
            activityDescription: data.description || data.title,
            locationText: data.locationText || null,
            freeNote: data.freeNote || null,
            customColor: data.customColor || null,
            supportEventId: data.supportEventId || null,
            isPending: false,
            taskId: task.id,
            projectId: data.projectId || null,
          },
        });
        // 参加者を追加
        if (data.participantsUserIds && data.participantsUserIds.length > 0) {
          await prisma.scheduleParticipant.createMany({
            data: data.participantsUserIds.map((uid: string) => ({
              scheduleId: schedule.id,
              userId: uid,
              status: 'PENDING',
            })),
          });
        }
      } catch (scheduleError) {
        console.error('Failed to create schedule for task:', scheduleError);
      }
    }

    res.status(201).json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create task error:', error);
    res.status(500).json({ error: 'タスクの作成に失敗しました' });
  }
});

/**
 * PUT /api/missions/:missionId/tasks/:id
 * タスクを更新
 */
router.put('/missions/:missionId/tasks/:id', async (req: AuthRequest, res) => {
  try {
    const { missionId, id } = req.params;
    const data = taskSchema.partial().parse(req.body);

    // タスクの存在確認
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        mission: {
          select: {
            id: true,
            userId: true,
          },
        },
        project: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'タスクが見つかりません' });
    }

    if (task.missionId !== missionId) {
      return res.status(400).json({ error: 'ミッションIDが一致しません' });
    }

    // 権限チェック
    if (req.user!.role === 'GOVERNMENT') {
      return res.status(403).json({ error: '権限がありません' });
    }
    if (req.user!.role === 'MEMBER' && task.mission.userId !== req.user!.id) {
      return res.status(403).json({ error: '権限がありません' });
    }

    // projectId が変更される場合、そのプロジェクトが同じミッションに属しているか確認
    if (data.projectId !== undefined && data.projectId !== null) {
      const project = await prisma.project.findUnique({
        where: { id: data.projectId },
        select: { id: true, missionId: true },
      });

      if (!project) {
        return res.status(404).json({ error: 'プロジェクトが見つかりません' });
      }

      if (project.missionId !== missionId) {
        return res.status(400).json({ error: 'プロジェクトがこのミッションに属していません' });
      }
    }

    const mergedProjectId =
      data.projectId !== undefined ? data.projectId || null : task.projectId;

    const updateData: any = {
      title: data.title,
      description: data.description !== undefined ? (data.description || null) : undefined,
      status: data.status,
      projectId: data.projectId !== undefined ? (data.projectId || null) : undefined,
      order: data.order,
    };

    if (data.projectId !== undefined || data.linkKind !== undefined) {
      updateData.linkKind = resolveTaskLinkKindOnUpdate(
        mergedProjectId,
        data.linkKind,
        task.linkKind,
      );
    }

    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }

    const updated = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        project: {
          select: {
            id: true,
            projectName: true,
          },
        },
        mission: {
          select: {
            userId: true,
          },
        },
      },
    });

    // dueDateが新しく設定された場合、既存のスケジュールがない場合はスケジュールを自動生成
    if (data.dueDate && updateData.dueDate) {
      const existingSchedule = await prisma.schedule.findFirst({
        where: { taskId: id },
      });

      if (!existingSchedule) {
        try {
          const startDate = new Date(data.dueDate);
          const endDate = data.endDate ? new Date(data.endDate) : startDate;
          const schedule = await prisma.schedule.create({
            data: {
              userId: updated.mission.userId,
              date: startDate,
              startDate: startDate,
              endDate: endDate,
              startTime: data.startTime || '09:00',
              endTime: data.endTime || '17:00',
              title: updated.title,
              activityDescription: data.description || updated.description || updated.title,
              locationText: data.locationText || null,
              freeNote: data.freeNote || null,
              customColor: data.customColor || null,
              supportEventId: data.supportEventId || null,
              isPending: false,
              taskId: updated.id,
              projectId: updated.projectId || null,
            },
          });
          if (data.participantsUserIds && data.participantsUserIds.length > 0) {
            await prisma.scheduleParticipant.createMany({
              data: data.participantsUserIds.map((uid: string) => ({
                scheduleId: schedule.id,
                userId: uid,
                status: 'PENDING',
              })),
            });
          }
        } catch (scheduleError) {
          console.error('Failed to create schedule for task:', scheduleError);
        }
      } else {
        // 既存スケジュールを更新
        try {
          const updateData: any = {
            title: updated.title,
            activityDescription: data.description || updated.description || updated.title,
          };
          if (data.dueDate) {
            const startDate = new Date(data.dueDate);
            const endDate = data.endDate ? new Date(data.endDate) : startDate;
            updateData.date = startDate;
            updateData.startDate = startDate;
            updateData.endDate = endDate;
          }
          if (data.startTime) updateData.startTime = data.startTime;
          if (data.endTime) updateData.endTime = data.endTime;
          if (data.locationText !== undefined) updateData.locationText = data.locationText || null;
          if (data.freeNote !== undefined) updateData.freeNote = data.freeNote || null;
          if (data.customColor !== undefined) updateData.customColor = data.customColor || null;
          if (data.supportEventId !== undefined) updateData.supportEventId = data.supportEventId || null;
          await prisma.schedule.update({ where: { id: existingSchedule.id }, data: updateData });
        } catch (scheduleError) {
          console.error('Failed to update schedule for task:', scheduleError);
        }
      }
    }

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update task error:', error);
    res.status(500).json({ error: 'タスクの更新に失敗しました' });
  }
});

/**
 * DELETE /api/missions/:missionId/tasks/:id
 * タスクを削除
 */
router.delete('/missions/:missionId/tasks/:id', async (req: AuthRequest, res) => {
  try {
    const { missionId, id } = req.params;

    // タスクの存在確認
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        mission: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'タスクが見つかりません' });
    }

    if (task.missionId !== missionId) {
      return res.status(400).json({ error: 'ミッションIDが一致しません' });
    }

    // 権限チェック
    if (req.user!.role === 'GOVERNMENT') {
      return res.status(403).json({ error: '権限がありません' });
    }
    if (req.user!.role === 'MEMBER' && task.mission.userId !== req.user!.id) {
      return res.status(403).json({ error: '権限がありません' });
    }

    await prisma.task.delete({
      where: { id },
    });

    res.json({ message: 'タスクを削除しました' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'タスクの削除に失敗しました' });
  }
});

export default router;

/**
 * POST /api/missions/:missionId/tasks/:id/reorder
 * タスクの順番を入れ替え
 */
router.post('/missions/:missionId/tasks/:id/reorder', async (req: AuthRequest, res) => {
  try {
    const { missionId, id } = req.params;
    const { direction } = req.body; // 'up' or 'down'

    // タスクの存在確認
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        mission: {
          select: {
            id: true,
            userId: true,
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'タスクが見つかりません' });
    }

    if (task.missionId !== missionId) {
      return res.status(400).json({ error: 'ミッションIDが一致しません' });
    }

    // 権限チェック
    if (req.user!.role === 'GOVERNMENT') {
      return res.status(403).json({ error: '権限がありません' });
    }
    if (req.user!.role === 'MEMBER' && task.mission.userId !== req.user!.id) {
      return res.status(403).json({ error: '権限がありません' });
    }

    // 同じミッションのタスクを取得
    const allTasks = await prisma.task.findMany({
      where: { missionId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, order: true },
    });

    const currentIndex = allTasks.findIndex(t => t.id === id);
    if (currentIndex === -1) {
      return res.status(404).json({ error: 'タスクが見つかりません' });
    }

    let targetIndex: number;
    if (direction === 'up') {
      if (currentIndex === 0) {
        return res.status(400).json({ error: 'これ以上上に移動できません' });
      }
      targetIndex = currentIndex - 1;
    } else if (direction === 'down') {
      if (currentIndex === allTasks.length - 1) {
        return res.status(400).json({ error: 'これ以上下に移動できません' });
      }
      targetIndex = currentIndex + 1;
    } else {
      return res.status(400).json({ error: '無効な方向です' });
    }

    // 順番を入れ替え
    const currentTask = allTasks[currentIndex];
    const targetTask = allTasks[targetIndex];

    await prisma.$transaction([
      prisma.task.update({
        where: { id: currentTask.id },
        data: { order: targetTask.order },
      }),
      prisma.task.update({
        where: { id: targetTask.id },
        data: { order: currentTask.order },
      }),
    ]);

    res.json({ message: '順番を入れ替えました' });
  } catch (error) {
    console.error('Reorder task error:', error);
    res.status(500).json({ error: '順番の入れ替えに失敗しました' });
  }
});
