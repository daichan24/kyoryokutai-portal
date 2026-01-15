import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const subGoalSchema = z.object({
  title: z.string().min(1, 'タイトルは必須です'),
  description: z.string().optional(),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']).optional(),
  order: z.number().int().optional(),
});

/**
 * GET /api/projects/:projectId/sub-goals
 * プロジェクトのサブ目標一覧を取得
 */
router.get('/:projectId/sub-goals', async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;

    // プロジェクトの存在確認と権限チェック
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    });

    if (!project) {
      return res.status(404).json({ error: 'プロジェクトが見つかりません' });
    }

    // MEMBERは自分のプロジェクトのみ、他は全プロジェクト閲覧可
    if (req.user!.role === 'MEMBER' && project.userId !== req.user!.id) {
      return res.status(403).json({ error: '権限がありません' });
    }

    const subGoals = await prisma.projectSubGoal.findMany({
      where: { projectId },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    res.json(subGoals);
  } catch (error) {
    console.error('Get sub-goals error:', error);
    res.status(500).json({ error: 'サブ目標の取得に失敗しました' });
  }
});

/**
 * POST /api/projects/:projectId/sub-goals
 * サブ目標を作成
 * 権限: MASTER/SUPPORT: 全プロジェクト、MEMBER: 自分のプロジェクトのみ
 */
router.post('/:projectId/sub-goals', async (req: AuthRequest, res) => {
  try {
    const { projectId } = req.params;
    const data = subGoalSchema.parse(req.body);

    // プロジェクトの存在確認と権限チェック
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
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
      const lastSubGoal = await prisma.projectSubGoal.findFirst({
        where: { projectId },
        orderBy: { order: 'desc' },
      });
      order = lastSubGoal ? lastSubGoal.order + 1 : 0;
    }

    const subGoal = await prisma.projectSubGoal.create({
      data: {
        projectId,
        title: data.title,
        description: data.description || null,
        status: data.status || 'NOT_STARTED',
        order,
      },
    });

    res.status(201).json(subGoal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create sub-goal error:', error);
    res.status(500).json({ error: 'サブ目標の作成に失敗しました' });
  }
});

/**
 * PUT /api/projects/:projectId/sub-goals/:id
 * サブ目標を更新
 */
router.put('/:projectId/sub-goals/:id', async (req: AuthRequest, res) => {
  try {
    const { projectId, id } = req.params;
    const data = subGoalSchema.partial().parse(req.body);

    // サブ目標の存在確認
    const subGoal = await prisma.projectSubGoal.findUnique({
      where: { id },
      include: {
        project: {
          select: { userId: true },
        },
      },
    });

    if (!subGoal) {
      return res.status(404).json({ error: 'サブ目標が見つかりません' });
    }

    if (subGoal.projectId !== projectId) {
      return res.status(400).json({ error: 'プロジェクトIDが一致しません' });
    }

    // 権限チェック
    if (req.user!.role === 'GOVERNMENT') {
      return res.status(403).json({ error: '権限がありません' });
    }
    if (req.user!.role === 'MEMBER' && subGoal.project.userId !== req.user!.id) {
      return res.status(403).json({ error: '権限がありません' });
    }

    const updated = await prisma.projectSubGoal.update({
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
    console.error('Update sub-goal error:', error);
    res.status(500).json({ error: 'サブ目標の更新に失敗しました' });
  }
});

/**
 * DELETE /api/projects/:projectId/sub-goals/:id
 * サブ目標を削除
 */
router.delete('/:projectId/sub-goals/:id', async (req: AuthRequest, res) => {
  try {
    const { projectId, id } = req.params;

    // サブ目標の存在確認
    const subGoal = await prisma.projectSubGoal.findUnique({
      where: { id },
      include: {
        project: {
          select: { userId: true },
        },
      },
    });

    if (!subGoal) {
      return res.status(404).json({ error: 'サブ目標が見つかりません' });
    }

    if (subGoal.projectId !== projectId) {
      return res.status(400).json({ error: 'プロジェクトIDが一致しません' });
    }

    // 権限チェック
    if (req.user!.role === 'GOVERNMENT') {
      return res.status(403).json({ error: '権限がありません' });
    }
    if (req.user!.role === 'MEMBER' && subGoal.project.userId !== req.user!.id) {
      return res.status(403).json({ error: '権限がありません' });
    }

    await prisma.projectSubGoal.delete({
      where: { id },
    });

    res.json({ message: 'サブ目標を削除しました' });
  } catch (error) {
    console.error('Delete sub-goal error:', error);
    res.status(500).json({ error: 'サブ目標の削除に失敗しました' });
  }
});

export default router;

