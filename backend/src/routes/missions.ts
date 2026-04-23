import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import {
  getMissionProgressData,
  updateGoalTaskProgress,
  calculateMissionProgress,
} from '../services/progressCalculator';
import {
  recalculateMidGoalWeights,
} from '../services/weightCalculator';

const router = Router();
router.use(authenticate);

// バリデーションスキーマ
const createMissionSchema = z.object({
  missionName: z.string().min(1),
  missionType: z.enum(['PRIMARY', 'SUB']),
  targetPercentage: z.number().min(0).max(100).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  achievementBorder: z.string().optional(),
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

// ミッション一覧取得
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { userId } = req.query;

    const where: any = {};
    if (userId) {
      where.userId = userId;
    } else if (req.user!.role === 'MEMBER') {
      where.userId = req.user!.id;
    }

    const missions = await prisma.mission.findMany({
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
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    });

    const missionsWithProgress = await Promise.all(
      missions.map(async (mission) => {
        const progress = await calculateMissionProgress(mission.id);
        return {
          ...mission,
          progress: Math.round(progress * 100) / 100,
        };
      })
    );

    res.json(missionsWithProgress);
  } catch (error) {
    console.error('Get missions error:', error);
    res.status(500).json({ error: 'Failed to get missions' });
  }
});

// ミッション詳細取得（進捗計算済み）
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const missionData = await getMissionProgressData(id);
    res.json(missionData);
  } catch (error) {
    console.error('Get mission error:', error);
    res.status(500).json({ error: 'Failed to get mission' });
  }
});

// ミッション作成
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = createMissionSchema.parse(req.body);

    // orderが指定されていない場合は最後に追加
    const lastMission = await prisma.mission.findFirst({
      where: { userId: req.user!.id },
      orderBy: { order: 'desc' },
    });
    const order = lastMission ? lastMission.order + 1 : 0;

    const mission = await prisma.mission.create({
      data: {
        userId: req.user!.id,
        missionName: data.missionName,
        missionType: data.missionType,
        targetPercentage: data.targetPercentage || 100,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        achievementBorder: data.achievementBorder || null,
        order,
      },
    });

    res.status(201).json(mission);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create mission error:', error);
    res.status(500).json({ error: 'Failed to create mission' });
  }
});

// ミッション更新
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existingMission = await prisma.mission.findUnique({
      where: { id },
    });

    if (!existingMission) {
      return res.status(404).json({ error: 'Mission not found' });
    }

    if (existingMission.userId !== req.user!.id && req.user!.role !== 'MASTER') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updateData: any = {};
    if (req.body.missionName !== undefined) updateData.missionName = req.body.missionName;
    if (req.body.missionType !== undefined) updateData.missionType = req.body.missionType;
    if (req.body.targetPercentage !== undefined) updateData.targetPercentage = req.body.targetPercentage;
    if (req.body.startDate !== undefined) updateData.startDate = req.body.startDate ? new Date(req.body.startDate) : null;
    if (req.body.endDate !== undefined) updateData.endDate = req.body.endDate ? new Date(req.body.endDate) : null;
    if (req.body.achievementBorder !== undefined) updateData.achievementBorder = req.body.achievementBorder || null;

    const mission = await prisma.mission.update({
      where: { id },
      data: updateData,
    });

    res.json(mission);
  } catch (error) {
    console.error('Update mission error:', error);
    res.status(500).json({ error: 'Failed to update mission' });
  }
});

// ミッション削除
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existingMission = await prisma.mission.findUnique({
      where: { id },
    });

    if (!existingMission) {
      return res.status(404).json({ error: 'Mission not found' });
    }

    if (existingMission.userId !== req.user!.id && req.user!.role !== 'MASTER') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.mission.delete({
      where: { id },
    });

    res.json({ message: 'Mission deleted successfully' });
  } catch (error) {
    console.error('Delete mission error:', error);
    res.status(500).json({ error: 'Failed to delete mission' });
  }
});

// ミッション承認/差し戻し
router.post('/:id/approve', authorize('MASTER', 'SUPPORT'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { approvalStatus, comment } = req.body;

    const mission = await prisma.mission.update({
      where: { id },
      data: {
        approvalStatus,
        approvalComment: comment,
        approvedBy: req.user!.id,
        approvedAt: approvalStatus === 'APPROVED' ? new Date() : null,
      },
    });

    res.json(mission);
  } catch (error) {
    console.error('Approve mission error:', error);
    res.status(500).json({ error: 'Failed to approve mission' });
  }
});

// 中目標作成
router.post('/:missionId/mid-goals', async (req, res) => {
  try {
    const { missionId } = req.params;
    const data = createMidGoalSchema.parse(req.body);

    const midGoal = await prisma.midGoal.create({
      data: {
        missionId,
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

// タスク作成（GoalTask - ミッション階層内のタスク）
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

    const missionProgress = await updateGoalTaskProgress(id, progress);

    res.json({ success: true, missionProgress });
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


// ミッションの順番入れ替え
router.post('/:id/reorder', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { direction } = req.body; // 'up' or 'down'

    const mission = await prisma.mission.findUnique({
      where: { id },
      select: { id: true, userId: true, order: true, missionName: true },
    });

    if (!mission) {
      return res.status(404).json({ error: 'ミッションが見つかりません' });
    }

    // デフォルトミッション（協力隊業務・役場業務）は順番変更不可
    if (mission.missionName === '協力隊業務' || mission.missionName === '役場業務') {
      return res.status(400).json({ error: 'デフォルトミッションの順番は変更できません' });
    }

    // 権限チェック
    if (mission.userId !== req.user!.id && req.user!.role !== 'MASTER') {
      return res.status(403).json({ error: '権限がありません' });
    }

    // 同じユーザーのミッションを取得（デフォルトミッションを除く）
    const allMissions = await prisma.mission.findMany({
      where: { 
        userId: mission.userId,
        missionName: {
          notIn: ['協力隊業務', '役場業務'],
        },
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, order: true },
    });

    const currentIndex = allMissions.findIndex(m => m.id === id);
    if (currentIndex === -1) {
      return res.status(404).json({ error: 'ミッションが見つかりません' });
    }

    let targetIndex: number;
    if (direction === 'up') {
      if (currentIndex === 0) {
        return res.status(400).json({ error: 'これ以上上に移動できません' });
      }
      targetIndex = currentIndex - 1;
    } else if (direction === 'down') {
      if (currentIndex === allMissions.length - 1) {
        return res.status(400).json({ error: 'これ以上下に移動できません' });
      }
      targetIndex = currentIndex + 1;
    } else {
      return res.status(400).json({ error: '無効な方向です' });
    }

    // 順番を入れ替え
    const currentMission = allMissions[currentIndex];
    const targetMission = allMissions[targetIndex];

    await prisma.$transaction([
      prisma.mission.update({
        where: { id: currentMission.id },
        data: { order: targetMission.order },
      }),
      prisma.mission.update({
        where: { id: targetMission.id },
        data: { order: currentMission.order },
      }),
    ]);

    res.json({ message: '順番を入れ替えました' });
  } catch (error) {
    console.error('Reorder mission error:', error);
    res.status(500).json({ error: '順番の入れ替えに失敗しました' });
  }
});

// ミッションの順番入れ替え（ドラッグ&ドロップ用）
router.post('/:id/reorder-to', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { newIndex, oldIndex } = req.body;

    console.log('Mission reorder request:', { id, newIndex, oldIndex });

    const mission = await prisma.mission.findUnique({
      where: { id },
      select: { id: true, userId: true, order: true, missionName: true },
    });

    if (!mission) {
      return res.status(404).json({ error: 'ミッションが見つかりません' });
    }

    // デフォルトミッション（協力隊業務・役場業務）は順番変更不可
    if (mission.missionName === '協力隊業務' || mission.missionName === '役場業務') {
      return res.status(400).json({ error: 'デフォルトミッションの順番は変更できません' });
    }

    // 権限チェック
    if (mission.userId !== req.user!.id && req.user!.role !== 'MASTER') {
      return res.status(403).json({ error: '権限がありません' });
    }

    // 同じユーザーのミッションを取得（デフォルトミッションを除く）
    const allMissions = await prisma.mission.findMany({
      where: { 
        userId: mission.userId,
        missionName: {
          notIn: ['協力隊業務', '役場業務'],
        },
      },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, order: true },
    });

    console.log('All missions count:', allMissions.length);

    // 配列を作成して並び替え
    const missionIds = allMissions.map(m => m.id);
    const [movedId] = missionIds.splice(oldIndex, 1);
    missionIds.splice(newIndex, 0, movedId);

    // 新しい順番で更新
    const updates = missionIds.map((missionId, index) => ({
      id: missionId,
      order: index,
    }));

    console.log('Mission updates:', updates);

    // トランザクションで更新
    await prisma.$transaction(
      updates.map(update =>
        prisma.mission.update({
          where: { id: update.id },
          data: { order: update.order },
        })
      )
    );

    res.json({ message: '順番を入れ替えました' });
  } catch (error) {
    console.error('Reorder mission error:', error);
    res.status(500).json({ error: '順番の入れ替えに失敗しました' });
  }
});
