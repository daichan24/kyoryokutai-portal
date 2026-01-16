import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateInspectionPDF } from '../services/pdfGenerator';

const router = Router();
router.use(authenticate);

// バリデーションスキーマ
const createInspectionSchema = z.object({
  date: z.string(),
  destination: z.string().min(1),
  purpose: z.string().min(1),
  participants: z.array(z.string()).default([]),
  inspectionPurpose: z.string().min(1),
  inspectionContent: z.string().min(1),
  reflection: z.string().min(1),
  futureAction: z.string().min(1),
  projectId: z.string().optional(),
});

// 視察一覧取得
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { userId, projectId } = req.query;

    const where: any = {};

    if (userId) {
      where.userId = userId;
    } else if (req.user!.role === 'MEMBER') {
      where.userId = req.user!.id;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    const inspections = await prisma.inspection.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarColor: true,
          },
        },
        project: {
          select: {
            id: true,
            projectName: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    res.json(inspections);
  } catch (error) {
    console.error('Get inspections error:', error);
    res.status(500).json({ error: 'Failed to get inspections' });
  }
});

// 視察詳細取得
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const inspection = await prisma.inspection.findUnique({
      where: { id },
      include: {
        user: true,
        project: true,
      },
    });

    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    res.json(inspection);
  } catch (error) {
    console.error('Get inspection error:', error);
    res.status(500).json({ error: 'Failed to get inspection' });
  }
});

// 視察作成
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = createInspectionSchema.parse(req.body);

    const inspection = await prisma.inspection.create({
      data: {
        userId: req.user!.id,
        date: new Date(data.date),
        destination: data.destination,
        purpose: data.purpose,
        participants: data.participants,
        inspectionPurpose: data.inspectionPurpose,
        inspectionContent: data.inspectionContent,
        reflection: data.reflection,
        futureAction: data.futureAction,
        projectId: data.projectId,
      },
      include: {
        user: true,
        project: true,
      },
    });

    res.status(201).json(inspection);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create inspection error:', error);
    res.status(500).json({ error: 'Failed to create inspection' });
  }
});

// 視察更新
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existingInspection = await prisma.inspection.findUnique({
      where: { id },
    });

    if (!existingInspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    if (existingInspection.userId !== req.user!.id && req.user!.role !== 'MASTER') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // 部分更新に対応
    const updateSchema = createInspectionSchema.partial();
    const data = updateSchema.parse(req.body);

    const updateData: any = {};
    if (data.date !== undefined) updateData.date = new Date(data.date);
    if (data.destination !== undefined) updateData.destination = data.destination;
    if (data.purpose !== undefined) updateData.purpose = data.purpose;
    if (data.participants !== undefined) updateData.participants = data.participants;
    if (data.inspectionPurpose !== undefined) updateData.inspectionPurpose = data.inspectionPurpose;
    if (data.inspectionContent !== undefined) updateData.inspectionContent = data.inspectionContent;
    if (data.reflection !== undefined) updateData.reflection = data.reflection;
    if (data.futureAction !== undefined) updateData.futureAction = data.futureAction;
    if (data.projectId !== undefined) updateData.projectId = data.projectId;

    const inspection = await prisma.inspection.update({
      where: { id },
      data: updateData,
      include: {
        user: true,
        project: true,
      },
    });

    res.json(inspection);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update inspection error:', error);
    res.status(500).json({ error: 'Failed to update inspection' });
  }
});

// 視察削除
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existingInspection = await prisma.inspection.findUnique({
      where: { id },
    });

    if (!existingInspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    if (existingInspection.userId !== req.user!.id && req.user!.role !== 'MASTER') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.inspection.delete({
      where: { id },
    });

    res.json({ message: 'Inspection deleted successfully' });
  } catch (error) {
    console.error('Delete inspection error:', error);
    res.status(500).json({ error: 'Failed to delete inspection' });
  }
});

// 視察復命書PDF出力
router.get('/:id/pdf', async (req, res) => {
  try {
    const { id } = req.params;

    const pdf = await generateInspectionPDF(id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="inspection_${id}.pdf"`);
    res.send(pdf);
  } catch (error) {
    console.error('Generate inspection PDF error:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

export default router;
