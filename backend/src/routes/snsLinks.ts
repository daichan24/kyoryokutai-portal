import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const snsLinkSchema = z.object({
  platform: z.string().min(1),
  url: z.string().url().optional().or(z.literal('')),
});

const snsLinksSchema = z.array(snsLinkSchema);

/**
 * GET /api/me/sns-links
 * 自分のSNSリンクを取得
 */
router.get('/', async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        snsLinks: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user.snsLinks || []);
  } catch (error) {
    console.error('Get SNS links error:', error);
    res.status(500).json({ error: 'Failed to get SNS links' });
  }
});

/**
 * PUT /api/me/sns-links
 * 自分のSNSリンクを更新
 */
router.put('/', async (req: AuthRequest, res) => {
  try {
    const data = snsLinksSchema.parse(req.body);

    // URLバリデーション（空文字列は許可、入力されている場合のみURL形式チェック）
    const validatedLinks = data.map((link) => {
      if (link.url && link.url.trim() !== '') {
        try {
          new URL(link.url);
        } catch {
          throw new Error(`Invalid URL format for ${link.platform}: ${link.url}`);
        }
      }
      return {
        platform: link.platform,
        url: link.url || null,
      };
    });

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        snsLinks: validatedLinks,
      },
      select: {
        snsLinks: true,
      },
    });

    res.json(user.snsLinks);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid format', details: error.errors });
    }
    console.error('Update SNS links error:', error);
    res.status(500).json({ error: 'Failed to update SNS links' });
  }
});

export default router;

