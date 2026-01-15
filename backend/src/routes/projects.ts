import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const projectSchema = z.object({
  projectName: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  phase: z.enum(['PREPARATION', 'EXECUTION', 'COMPLETED', 'REVIEW']).optional(),
  missionId: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

// プロジェクト一覧取得
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { userId, phase, approvalStatus } = req.query;
    const where: any = {};

    if (userId) {
      where.userId = userId;
    } else if (req.user!.role === 'MEMBER') {
      where.userId = req.user!.id;
    }

    if (phase) where.phase = phase;
    if (approvalStatus) where.approvalStatus = approvalStatus;

    const projects = await prisma.project.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, avatarColor: true } },
        mission: { select: { id: true, missionName: true } },
        members: { include: { user: { select: { id: true, name: true } } } },
        tasks: { orderBy: { order: 'asc' } },
        relatedTasks: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }, // このプロジェクトに関連するタスク（小目標、任意）
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to get projects' });
  }
});

// プロジェクト詳細取得
router.get('/:id', async (req, res) => {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.params.id },
      include: {
        user: true,
        mission: true,
        members: { include: { user: true } },
        tasks: { include: { assignee: { select: { id: true, name: true } } } },
        relatedTasks: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] }, // このプロジェクトに関連するタスク（小目標、任意）
        schedules: { take: 10, orderBy: { date: 'desc' } },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // プロジェクトに関連するタスクの進捗率を計算
    const tasks = project.relatedTasks || [];
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'COMPLETED').length;
    const taskProgress = totalTasks > 0 
      ? Math.round((completedTasks / totalTasks) * 100) 
      : 0;

    res.json({
      ...project,
      taskProgress, // 関連タスクの進捗率（0-100）
    });
  } catch (error) {
    console.error('Get project error:', error);
    res.status(500).json({ error: 'Failed to get project' });
  }
});

// プロジェクト作成
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = projectSchema.parse(req.body);

    const project = await prisma.project.create({
      data: {
        userId: req.user!.id,
        projectName: data.projectName,
        description: data.description,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        phase: data.phase || 'PREPARATION',
        missionId: data.missionId,
        tags: data.tags,
      },
      include: { user: true, mission: true },
    });

    res.status(201).json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// プロジェクト更新
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!existing || (existing.userId !== req.user!.id && req.user!.role !== 'MASTER')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const data = projectSchema.parse(req.body);
    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        projectName: data.projectName,
        description: data.description,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        phase: data.phase,
        missionId: data.missionId,
        tags: data.tags,
      },
      include: { user: true, mission: true },
    });

    res.json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// プロジェクト削除
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.project.findUnique({ where: { id: req.params.id } });
    if (!existing || (existing.userId !== req.user!.id && req.user!.role !== 'MASTER')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// プロジェクト承認/差し戻し
router.post('/:id/approve', authorize('MASTER', 'SUPPORT'), async (req: AuthRequest, res) => {
  try {
    const { approvalStatus, comment } = req.body;

    const project = await prisma.project.update({
      where: { id: req.params.id },
      data: {
        approvalStatus,
        approvalComment: comment,
        approvedBy: req.user!.id,
        approvedAt: approvalStatus === 'APPROVED' ? new Date() : null,
      },
      include: { user: true },
    });

    res.json(project);
  } catch (error) {
    console.error('Approve project error:', error);
    res.status(500).json({ error: 'Failed to approve project' });
  }
});

// タスク関連のルートを統合（旧：サブ目標）
import tasksRoutes from './tasks';
router.use('/', tasksRoutes);

export default router;
