import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateWeeklyReportPDF } from '../services/pdfGenerator';

const router = Router();

router.use(authenticate);

const createWeeklyReportSchema = z.object({
  week: z.string().regex(/^\d{4}-\d{2}$/),
  thisWeekActivities: z.array(
    z.object({
      date: z.string(),
      activity: z.string(),
    })
  ),
  nextWeekPlan: z.string().optional(),
  note: z.string().optional(),
  submittedAt: z.string().optional(),
});

const updateWeeklyReportSchema = createWeeklyReportSchema.partial();

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { userId, week } = req.query;

    const where: any = {};

    if (userId) {
      where.userId = userId as string;
    } else if (req.user!.role === 'MEMBER') {
      where.userId = req.user!.id;
    }

    if (week) {
      where.week = week as string;
    }

    const reports = await prisma.weeklyReport.findMany({
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
      },
      orderBy: { week: 'desc' },
    });

    res.json(reports);
  } catch (error) {
    console.error('Get weekly reports error:', error);
    res.status(500).json({ error: 'Failed to get weekly reports' });
  }
});

router.get('/:userId/:week', async (req: AuthRequest, res) => {
  try {
    const { userId, week } = req.params;

    if (userId !== req.user!.id && req.user!.role !== 'MASTER' && req.user!.role !== 'SUPPORT') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const report = await prisma.weeklyReport.findUnique({
      where: {
        userId_week: {
          userId,
          week,
        },
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
      },
    });

    if (!report) {
      return res.status(404).json({ error: 'Weekly report not found' });
    }

    res.json(report);
  } catch (error) {
    console.error('Get weekly report error:', error);
    res.status(500).json({ error: 'Failed to get weekly report' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = createWeeklyReportSchema.parse(req.body);

    const report = await prisma.weeklyReport.create({
      data: {
        userId: req.user!.id,
        week: data.week,
        thisWeekActivities: data.thisWeekActivities,
        nextWeekPlan: data.nextWeekPlan,
        note: data.note,
        submittedAt: data.submittedAt ? new Date(data.submittedAt) : null,
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
      },
    });

    res.status(201).json(report);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create weekly report error:', error);
    res.status(500).json({ error: 'Failed to create weekly report' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = updateWeeklyReportSchema.parse(req.body);

    const existingReport = await prisma.weeklyReport.findUnique({
      where: { id },
    });

    if (!existingReport) {
      return res.status(404).json({ error: 'Weekly report not found' });
    }

    if (existingReport.userId !== req.user!.id && req.user!.role !== 'MASTER') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updateData: any = { ...data };
    if (data.submittedAt) {
      updateData.submittedAt = new Date(data.submittedAt);
    }

    const report = await prisma.weeklyReport.update({
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
      },
    });

    res.json(report);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update weekly report error:', error);
    res.status(500).json({ error: 'Failed to update weekly report' });
  }
});

// PDF出力
router.get('/:userId/:week/pdf', async (req: AuthRequest, res) => {
  try {
    const { userId, week } = req.params;

    if (userId !== req.user!.id && req.user!.role !== 'MASTER' && req.user!.role !== 'SUPPORT') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const pdfBuffer = await generateWeeklyReportPDF(userId, week);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="weekly-report-${week}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate weekly report PDF error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

export default router;
