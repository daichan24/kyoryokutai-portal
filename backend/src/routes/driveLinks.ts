import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const createDriveLinkSchema = z.object({
  title: z.string().min(1).max(200),
  url: z.string().url(),
  description: z.string().optional(),
  order: z.number().optional(),
});

const updateDriveLinkSchema = createDriveLinkSchema.partial();

// ドライブリンク一覧取得
router.get('/', async (req: AuthRequest, res) => {
  try {
    const driveLinks = await prisma.driveLink.findMany({
      orderBy: { order: 'asc' },
    });

    res.json(driveLinks);
  } catch (error) {
    console.error('Get drive links error:', error);
    res.status(500).json({ error: 'Failed to get drive links' });
  }
});

// ドライブリンク作成
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = createDriveLinkSchema.parse(req.body);

    // orderが指定されていない場合、最大値+1を設定
    if (data.order === undefined) {
      const maxOrder = await prisma.driveLink.findFirst({
        orderBy: { order: 'desc' },
        select: { order: true },
      });
      data.order = (maxOrder?.order ?? -1) + 1;
    }

    const driveLink = await prisma.driveLink.create({
      data,
    });

    res.status(201).json(driveLink);
  } catch (error) {
    console.error('Create drive link error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create drive link' });
  }
});

// ドライブリンク更新
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = updateDriveLinkSchema.parse(req.body);

    const driveLink = await prisma.driveLink.update({
      where: { id },
      data,
    });

    res.json(driveLink);
  } catch (error) {
    console.error('Update drive link error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update drive link' });
  }
});

// ドライブリンク削除
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    await prisma.driveLink.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete drive link error:', error);
    res.status(500).json({ error: 'Failed to delete drive link' });
  }
});

export default router;

