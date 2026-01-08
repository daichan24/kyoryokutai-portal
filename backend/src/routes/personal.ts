import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// 個人プロジェクトスキーマ
const personalProjectSchema = z.object({
  projectName: z.string().min(1),
  description: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  phase: z.enum(['PREPARATION', 'EXECUTION', 'COMPLETED', 'REVIEW']).optional(),
});

// 個人プロジェクト一覧取得
router.get('/projects', async (req: AuthRequest, res) => {
  try {
    const projects = await prisma.personalProject.findMany({
      where: { userId: req.user!.id },
      include: {
        tasks: {
          orderBy: { order: 'asc' },
        },
        schedules: {
          orderBy: { date: 'desc' },
          take: 5,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(projects);
  } catch (error) {
    console.error('Get personal projects error:', error);
    res.status(500).json({ error: 'Failed to get personal projects' });
  }
});

// 個人プロジェクト作成
router.post('/projects', async (req: AuthRequest, res) => {
  try {
    const data = personalProjectSchema.parse(req.body);

    const project = await prisma.personalProject.create({
      data: {
        userId: req.user!.id,
        projectName: data.projectName,
        description: data.description,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        phase: data.phase || 'PREPARATION',
      },
      include: {
        tasks: true,
        schedules: true,
      },
    });

    res.status(201).json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create personal project error:', error);
    res.status(500).json({ error: 'Failed to create personal project' });
  }
});

// 個人プロジェクト更新
router.put('/projects/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = personalProjectSchema.parse(req.body);

    const existing = await prisma.personalProject.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Personal project not found' });
    }

    const project = await prisma.personalProject.update({
      where: { id },
      data: {
        projectName: data.projectName,
        description: data.description,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        phase: data.phase,
      },
      include: {
        tasks: true,
        schedules: true,
      },
    });

    res.json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update personal project error:', error);
    res.status(500).json({ error: 'Failed to update personal project' });
  }
});

// 個人プロジェクト削除
router.delete('/projects/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.personalProject.findUnique({
      where: { id },
    });

    if (!existing || existing.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Personal project not found' });
    }

    await prisma.personalProject.delete({
      where: { id },
    });

    res.json({ message: 'Personal project deleted successfully' });
  } catch (error) {
    console.error('Delete personal project error:', error);
    res.status(500).json({ error: 'Failed to delete personal project' });
  }
});

// 個人モード有効化
router.post('/enable', async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { personalModeEnabled: true },
    });

    res.json(user);
  } catch (error) {
    console.error('Enable personal mode error:', error);
    res.status(500).json({ error: 'Failed to enable personal mode' });
  }
});

export default router;
