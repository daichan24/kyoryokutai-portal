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
  order: z.number().int().optional(),
});

/**
 * GET /api/projects/:projectId/tasks
 * プロジェクトのタスク一覧を取得
 */
router.get('/projects/:projectId/tasks', async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;

    // プロジェクトの存在確認と権限チェック
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        user: { select: { id: true } },
        mission: { select: { id: true, userId: true } },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'プロジェクトが見つかりません' });
    }

    // 権限チェック
    // MEMBERは自分のプロジェクトのみ、他は全プロジェクト閲覧可
    if (req.user!.role === 'MEMBER' && project.userId !== req.user!.id) {
      return res.status(403).json({ error: '権限がありません' });
    }

    const tasks = await prisma.task.findMany({
      where: { projectId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ error: 'タスクの取得に失敗しました' });
  }
});

/**
 * POST /api/projects/:projectId/tasks
 * タスクを作成
 * 権限: MASTER/SUPPORT: 全プロジェクト、MEMBER: 自分のプロジェクトのみ
 */
router.post('/projects/:projectId/tasks', async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const data = taskSchema.parse(req.body);

    // プロジェクトの存在確認と権限チェック
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        user: { select: { id: true } },
        mission: { select: { id: true, userId: true } },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'プロジェクトが見つかりません' });
    }

    // 権限チェック
    if (req.user!.role === 'GOVERNMENT') {
      return res.status(403).json({ error: '権限がありません' });
    }
    if (req.user!.role === 'MEMBER' && project.userId !== req.user!.id) {
      return res.status(403).json({ error: '権限がありません' });
    }

    // orderが指定されていない場合は最後に追加
    let order = data.order;
    if (order === undefined) {
      const lastTask = await prisma.task.findFirst({
        where: { projectId },
        orderBy: { order: 'desc' },
      });
      order = lastTask ? lastTask.order + 1 : 0;
    }

    const task = await prisma.task.create({
      data: {
        projectId,
        title: data.title,
        description: data.description || null,
        status: data.status || 'NOT_STARTED',
        order,
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
 * PUT /api/projects/:projectId/tasks/:id
 * タスクを更新
 */
router.put('/projects/:projectId/tasks/:id', async (req: AuthRequest, res) => {
  try {
    const { projectId, id } = req.params;
    const data = taskSchema.partial().parse(req.body);

    // タスクの存在確認
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            user: { select: { id: true } },
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'タスクが見つかりません' });
    }

    if (task.projectId !== projectId) {
      return res.status(400).json({ error: 'プロジェクトIDが一致しません' });
    }

    // 権限チェック
    if (req.user!.role === 'GOVERNMENT') {
      return res.status(403).json({ error: '権限がありません' });
    }
    if (req.user!.role === 'MEMBER' && task.project.userId !== req.user!.id) {
      return res.status(403).json({ error: '権限がありません' });
    }

    const updated = await prisma.task.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description !== undefined ? (data.description || null) : undefined,
        status: data.status,
        order: data.order,
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
 * DELETE /api/projects/:projectId/tasks/:id
 * タスクを削除
 */
router.delete('/projects/:projectId/tasks/:id', async (req: AuthRequest, res) => {
  try {
    const { projectId, id } = req.params;

    // タスクの存在確認
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        project: {
          include: {
            user: { select: { id: true } },
          },
        },
      },
    });

    if (!task) {
      return res.status(404).json({ error: 'タスクが見つかりません' });
    }

    if (task.projectId !== projectId) {
      return res.status(400).json({ error: 'プロジェクトIDが一致しません' });
    }

    // 権限チェック
    if (req.user!.role === 'GOVERNMENT') {
      return res.status(403).json({ error: '権限がありません' });
    }
    if (req.user!.role === 'MEMBER' && task.project.userId !== req.user!.id) {
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
