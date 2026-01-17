import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const updateProfileSchema = z.object({
  avatarColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  avatarLetter: z.string().max(1).optional().nullable(),
  darkMode: z.boolean().optional(),
});

/**
 * PUT /api/me/profile
 * プロフィールの表示設定（アイコン色・1文字・ダークモード）を更新
 */
router.put('/', async (req: AuthRequest, res) => {
  try {
    const raw = updateProfileSchema.safeParse(req.body);
    if (!raw.success) {
      return res.status(400).json({ error: 'Invalid input', details: raw.error.errors });
    }
    const data = raw.data;

    const updateData: { avatarColor?: string; avatarLetter?: string | null; darkMode?: boolean } = {};
    if (data.avatarColor !== undefined) updateData.avatarColor = data.avatarColor;
    if (data.avatarLetter !== undefined) updateData.avatarLetter = data.avatarLetter === '' ? null : data.avatarLetter;
    if (data.darkMode !== undefined) updateData.darkMode = data.darkMode;

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: updateData,
      select: {
        avatarColor: true,
        avatarLetter: true,
        darkMode: true,
      },
    });

    res.json(user);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;

