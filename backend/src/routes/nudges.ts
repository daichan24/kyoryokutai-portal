import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const nudgeDocumentSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
});

/**
 * GET /api/nudges
 * 協力隊催促文書を取得（1件のみ運用）
 */
router.get('/', async (req: AuthRequest, res) => {
  try {
    const document = await prisma.nudgeDocument.findFirst({
      orderBy: { updatedAt: 'desc' },
      include: {
        updater: {
          select: {
            id: true,
            name: true,
            avatarColor: true,
          },
        },
      },
    });

    if (!document) {
      return res.json(null);
    }

    res.json({
      id: document.id,
      title: document.title,
      content: document.content,
      publishedAt: document.publishedAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
      updatedBy: {
        id: document.updater.id,
        name: document.updater.name,
        avatarColor: document.updater.avatarColor,
      },
    });
  } catch (error) {
    console.error('Get nudge document error:', error);
    res.status(500).json({ error: 'Failed to get nudge document' });
  }
});

/**
 * PUT /api/nudges
 * 協力隊催促文書を更新（MASTER/SUPPORT/GOVERNMENTのみ）
 */
router.put('/', async (req: AuthRequest, res) => {
  try {
    // 権限チェック
    if (!['MASTER', 'SUPPORT', 'GOVERNMENT'].includes(req.user!.role)) {
      return res.status(403).json({ error: '権限がありません' });
    }

    const data = nudgeDocumentSchema.parse(req.body);
    const userId = req.user!.id;

    // 既存の文書を取得
    const existing = await prisma.nudgeDocument.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    let document;
    if (existing) {
      // 更新履歴を保存
      await prisma.nudgeRevision.create({
        data: {
          documentId: existing.id,
          content: existing.content,
          updatedBy: existing.updatedBy,
        },
      });

      // 文書を更新
      document = await prisma.nudgeDocument.update({
        where: { id: existing.id },
        data: {
          title: data.title,
          content: data.content,
          publishedAt: existing.publishedAt, // 発行日は変更しない
          updatedBy: userId,
        },
        include: {
          updater: {
            select: {
              id: true,
              name: true,
              avatarColor: true,
            },
          },
        },
      });
    } else {
      // 新規作成
      document = await prisma.nudgeDocument.create({
        data: {
          title: data.title,
          content: data.content,
          publishedAt: new Date(),
          updatedBy: userId,
        },
        include: {
          updater: {
            select: {
              id: true,
              name: true,
              avatarColor: true,
            },
          },
        },
      });
    }

    res.json({
      id: document.id,
      title: document.title,
      content: document.content,
      publishedAt: document.publishedAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
      updatedBy: {
        id: document.updater.id,
        name: document.updater.name,
        avatarColor: document.updater.avatarColor,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update nudge document error:', error);
    res.status(500).json({ error: 'Failed to update nudge document' });
  }
});

/**
 * GET /api/nudges/revisions
 * 更新履歴を取得
 */
router.get('/revisions', async (req: AuthRequest, res) => {
  try {
    const document = await prisma.nudgeDocument.findFirst({
      orderBy: { updatedAt: 'desc' },
    });

    if (!document) {
      return res.json([]);
    }

    const revisions = await prisma.nudgeRevision.findMany({
      where: { documentId: document.id },
      include: {
        updater: {
          select: {
            id: true,
            name: true,
            avatarColor: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(
      revisions.map((rev) => ({
        id: rev.id,
        content: rev.content,
        updatedBy: {
          id: rev.updater.id,
          name: rev.updater.name,
          avatarColor: rev.updater.avatarColor,
        },
        createdAt: rev.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error('Get nudge revisions error:', error);
    res.status(500).json({ error: 'Failed to get nudge revisions' });
  }
});

export default router;

