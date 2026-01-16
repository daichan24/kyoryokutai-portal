import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const supportRecordSchema = z.object({
  userId: z.string().min(1),
  supportDate: z.string(),
  supportContent: z.string().min(1),
  supportBy: z.string().min(1),
  monthlyReportId: z.string().optional(),
});

// 支援記録一覧取得（SUPPORTのみ）
router.get('/', authorize('SUPPORT', 'MASTER'), async (req: AuthRequest, res) => {
  try {
    const records = await prisma.supportRecord.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarColor: true,
          },
        },
        monthlyReport: {
          select: {
            id: true,
            month: true,
          },
        },
      },
      orderBy: { supportDate: 'desc' },
    });

    res.json(records);
  } catch (error) {
    console.error('Get support records error:', error);
    res.status(500).json({ error: '支援記録の取得に失敗しました' });
  }
});

// 支援記録作成（SUPPORTのみ）
router.post('/', authorize('SUPPORT', 'MASTER'), async (req: AuthRequest, res) => {
  try {
    const data = supportRecordSchema.parse(req.body);

    const record = await prisma.supportRecord.create({
      data: {
        userId: data.userId,
        supportDate: new Date(data.supportDate),
        supportContent: data.supportContent,
        supportBy: data.supportBy,
        monthlyReportId: data.monthlyReportId || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarColor: true,
          },
        },
        monthlyReport: {
          select: {
            id: true,
            month: true,
          },
        },
      },
    });

    res.status(201).json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create support record error:', error);
    res.status(500).json({ error: '支援記録の作成に失敗しました' });
  }
});

// 支援記録更新（SUPPORTのみ）
router.put('/:id', authorize('SUPPORT', 'MASTER'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = supportRecordSchema.parse(req.body);

    const record = await prisma.supportRecord.update({
      where: { id },
      data: {
        userId: data.userId,
        supportDate: new Date(data.supportDate),
        supportContent: data.supportContent,
        supportBy: data.supportBy,
        monthlyReportId: data.monthlyReportId || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarColor: true,
          },
        },
        monthlyReport: {
          select: {
            id: true,
            month: true,
          },
        },
      },
    });

    res.json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update support record error:', error);
    res.status(500).json({ error: '支援記録の更新に失敗しました' });
  }
});

// 支援記録削除（SUPPORTのみ）
router.delete('/:id', authorize('SUPPORT', 'MASTER'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    await prisma.supportRecord.delete({
      where: { id },
    });

    res.json({ message: '支援記録を削除しました' });
  } catch (error) {
    console.error('Delete support record error:', error);
    res.status(500).json({ error: '支援記録の削除に失敗しました' });
  }
});

export default router;

