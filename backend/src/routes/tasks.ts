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
  projectId: z.string().optional().nullable(), // プロジェクトへの紐付けは任意
  order: z.number().int().optional(),
});

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
          },
        },
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    res.json(tasks);
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

    const task = await prisma.task.create({
      data: {
        missionId,
        projectId: data.projectId || null,
        title: data.title,
        description: data.description || null,
        status: data.status || 'NOT_STARTED',
        order,
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

    const updated = await prisma.task.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description !== undefined ? (data.description || null) : undefined,
        status: data.status,
        projectId: data.projectId !== undefined ? (data.projectId || null) : undefined,
        order: data.order,
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
