import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import {
  getGoalProgressData,
  updateGoalTaskProgress,
  calculateGoalProgress,
} from '../services/progressCalculator';
import {
  recalculateMidGoalWeights,
  recalculateSubGoalWeights,
  recalculateTaskWeights,
} from '../services/weightCalculator';

const router = Router();
router.use(authenticate);

// バリデーションスキーマ
const createGoalSchema = z.object({
  goalName: z.string().min(1),
  goalType: z.enum(['PRIMARY', 'SUB']),
  targetPercentage: z.number().min(0).max(100).optional(),
});

const createMidGoalSchema = z.object({
  name: z.string().min(1),
  weight: z.number().min(0).max(100),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  order: z.number().optional(),
});

const createSubGoalSchema = z.object({
  name: z.string().min(1),
  weight: z.number().min(0).max(100),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  order: z.number().optional(),
});

const createTaskSchema = z.object({
  name: z.string().min(1),
  weight: z.number().min(0).max(100),
  progress: z.number().min(0).max(100).optional(),
  phase: z.enum(['PREPARATION', 'EXECUTION', 'COMPLETED', 'REVIEW']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  order: z.number().optional(),
});

// 目標一覧取得
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { userId } = req.query;

    const where: any = {};
    if (userId) {
      where.userId = userId;
    } else if (req.user!.role === 'MEMBER') {
      where.userId = req.user!.id;
    }

    const goals = await prisma.goal.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarColor: true,
          },
        },
        midGoals: {
          include: {
            subGoals: {
              include: {
                tasks: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const goalsWithProgress = await Promise.all(
      goals.map(async (goal) => {
        const progress = await calculateGoalProgress(goal.id);
        return {
          ...goal,
          progress: Math.round(progress * 100) / 100,
        };
      })
    );

    res.json(goalsWithProgress);
  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({ error: 'Failed to get goals' });
  }
});

// 目標詳細取得（進捗計算済み）
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const goalData = await getGoalProgressData(id);
    res.json(goalData);
  } catch (error) {
    console.error('Get goal error:', error);
    res.status(500).json({ error: 'Failed to get goal' });
  }
});

// 目標作成
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = createGoalSchema.parse(req.body);

    const goal = await prisma.goal.create({
      data: {
        userId: req.user!.id,
        ...data,
      },
    });

    res.status(201).json(goal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create goal error:', error);
    res.status(500).json({ error: 'Failed to create goal' });
  }
});

// 目標更新
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existingGoal = await prisma.goal.findUnique({
      where: { id },
    });

    if (!existingGoal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    if (existingGoal.userId !== req.user!.id && req.user!.role !== 'MASTER') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const goal = await prisma.goal.update({
      where: { id },
      data: req.body,
    });

    res.json(goal);
  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({ error: 'Failed to update goal' });
  }
});

// 目標削除
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existingGoal = await prisma.goal.findUnique({
      where: { id },
    });

    if (!existingGoal) {
      return res.status(404).json({ error: 'Goal not found' });
    }

    if (existingGoal.userId !== req.user!.id && req.user!.role !== 'MASTER') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.goal.delete({
      where: { id },
    });

    res.json({ message: 'Goal deleted successfully' });
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({ error: 'Failed to delete goal' });
  }
});

// 目標承認/差し戻し
router.post('/:id/approve', authorize('MASTER', 'SUPPORT'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { approvalStatus, comment } = req.body;

    const goal = await prisma.goal.update({
      where: { id },
      data: {
        approvalStatus,
        approvalComment: comment,
        approvedBy: req.user!.id,
        approvedAt: approvalStatus === 'APPROVED' ? new Date() : null,
      },
    });

    res.json(goal);
  } catch (error) {
    console.error('Approve goal error:', error);
    res.status(500).json({ error: 'Failed to approve goal' });
  }
});

// 中目標作成
router.post('/:goalId/mid-goals', async (req, res) => {
  try {
    const { goalId } = req.params;
    const data = createMidGoalSchema.parse(req.body);

    const midGoal = await prisma.midGoal.create({
      data: {
        goalId,
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
    });

    res.status(201).json(midGoal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create mid goal error:', error);
    res.status(500).json({ error: 'Failed to create mid goal' });
  }
});

// 小目標作成
router.post('/mid-goals/:midGoalId/sub-goals', async (req, res) => {
  try {
    const { midGoalId } = req.params;
    const data = createSubGoalSchema.parse(req.body);

    const subGoal = await prisma.subGoal.create({
      data: {
        midGoalId,
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
    });

    res.status(201).json(subGoal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create sub goal error:', error);
    res.status(500).json({ error: 'Failed to create sub goal' });
  }
});

// タスク作成
router.post('/sub-goals/:subGoalId/tasks', async (req, res) => {
  try {
    const { subGoalId } = req.params;
    const data = createTaskSchema.parse(req.body);

    const task = await prisma.goalTask.create({
      data: {
        subGoalId,
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
      },
    });

    res.status(201).json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// タスク進捗更新
router.put('/tasks/:id/progress', async (req, res) => {
  try {
    const { id } = req.params;
    const { progress } = req.body;

    const goalProgress = await updateGoalTaskProgress(id, progress);

    res.json({ success: true, goalProgress });
  } catch (error) {
    console.error('Update task progress error:', error);
    res.status(500).json({ error: 'Failed to update task progress' });
  }
});

// 重み再計算
router.post('/:id/recalculate-weights', async (req, res) => {
  try {
    const { id } = req.params;
    const { method } = req.body;

    if (!['EQUAL', 'PERIOD'].includes(method)) {
      return res.status(400).json({ error: 'Invalid method' });
    }

    const weights = await recalculateMidGoalWeights(id, method);

    res.json({ success: true, weights });
  } catch (error) {
    console.error('Recalculate weights error:', error);
    res.status(500).json({ error: 'Failed to recalculate weights' });
  }
});

export default router;
