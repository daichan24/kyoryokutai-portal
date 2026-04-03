import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const attendanceSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(['PRESENT', 'REMOTE', 'ABSENT', 'HALF_DAY']),
  note: z.string().max(500).optional().nullable(),
});

const bulkAttendanceSchema = z.object({
  updates: z.array(z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    status: z.enum(['PRESENT', 'REMOTE', 'ABSENT', 'HALF_DAY']),
    note: z.string().max(500).optional().nullable(),
  })),
  deletes: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

// 出勤記録一覧取得（全員分 - カレンダー表示用）
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { from, to, userId } = req.query;
    const where: any = {};

    if (userId) {
      where.userId = userId as string;
    }

    if (from || to) {
      where.date = {};
      if (from) where.date.gte = new Date(`${from}T00:00:00.000Z`);
      if (to) where.date.lte = new Date(`${to}T23:59:59.999Z`);
    }

    const records = await prisma.governmentAttendance.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, avatarColor: true, avatarLetter: true, role: true },
        },
      },
      orderBy: [{ date: 'asc' }, { userId: 'asc' }],
    });

    res.json(records);
  } catch (error) {
    console.error('Get government attendance error:', error);
    res.status(500).json({ error: '出勤記録の取得に失敗しました' });
  }
});

// 自分の出勤記録を登録・更新（GOVERNMENT/MASTER/SUPPORTのみ）
router.post('/', async (req: AuthRequest, res) => {
  try {
    const role = req.user!.role;
    if (role !== 'GOVERNMENT' && role !== 'MASTER' && role !== 'SUPPORT') {
      return res.status(403).json({ error: '権限がありません' });
    }

    const data = attendanceSchema.parse(req.body);
    const date = new Date(`${data.date}T00:00:00.000Z`);

    const record = await prisma.governmentAttendance.upsert({
      where: { userId_date: { userId: req.user!.id, date } },
      update: {
        status: data.status,
        note: data.note ?? null,
      },
      create: {
        userId: req.user!.id,
        date,
        status: data.status,
        note: data.note ?? null,
      },
      include: {
        user: { select: { id: true, name: true, avatarColor: true, avatarLetter: true, role: true } },
      },
    });

    res.json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create/update government attendance error:', error);
    res.status(500).json({ error: '出勤記録の保存に失敗しました' });
  }
});

// 自分の出勤記録を一括保存・更新・削除（GOVERNMENT/MASTER/SUPPORTのみ）
router.post('/bulk', async (req: AuthRequest, res) => {
  try {
    const role = req.user!.role;
    if (role !== 'GOVERNMENT' && role !== 'MASTER' && role !== 'SUPPORT') {
      return res.status(403).json({ error: '権限がありません' });
    }

    const data = bulkAttendanceSchema.parse(req.body);
    const userId = req.user!.id;

    await prisma.$transaction(async (tx) => {
      // 削除処理
      if (data.deletes.length > 0) {
        const deleteDates = data.deletes.map(d => new Date(`${d}T00:00:00.000Z`));
        await tx.governmentAttendance.deleteMany({
          where: {
            userId,
            date: { in: deleteDates },
          },
        });
      }

      // 更新・追加処理
      for (const update of data.updates) {
        const date = new Date(`${update.date}T00:00:00.000Z`);
        await tx.governmentAttendance.upsert({
          where: { userId_date: { userId, date } },
          update: {
            status: update.status,
            note: update.note ?? null,
          },
          create: {
            userId,
            date,
            status: update.status,
            note: update.note ?? null,
          },
        });
      }
    });

    res.json({ message: '一括保存しました' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Bulk government attendance error:', error);
    res.status(500).json({ error: '出勤記録の一括保存に失敗しました' });
  }
});

// 出勤記録削除
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const record = await prisma.governmentAttendance.findUnique({
      where: { id: req.params.id },
    });

    if (!record) {
      return res.status(404).json({ error: '出勤記録が見つかりません' });
    }

    if (record.userId !== req.user!.id && req.user!.role !== 'MASTER') {
      return res.status(403).json({ error: '権限がありません' });
    }

    await prisma.governmentAttendance.delete({ where: { id: req.params.id } });
    res.json({ message: '削除しました' });
  } catch (error) {
    console.error('Delete government attendance error:', error);
    res.status(500).json({ error: '出勤記録の削除に失敗しました' });
  }
});

export default router;
