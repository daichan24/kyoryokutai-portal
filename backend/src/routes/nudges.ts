import { Router } from 'express';
import { z } from 'zod';
import { format } from 'date-fns';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const nudgeDocumentSchema = z.object({
  fiscalYear: z.number().int().min(2020).max(2100),
  title: z.string().min(1),
  content: z.string().min(1),
});

/**
 * GET /api/nudges
 * 全年度の協力隊細則を取得
 */
router.get('/', async (req: AuthRequest, res) => {
  try {
    const documents = await prisma.nudgeDocument.findMany({
      orderBy: { fiscalYear: 'desc' },
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

    res.json(
      documents.map((doc) => ({
        id: doc.id,
        fiscalYear: doc.fiscalYear,
        title: doc.title,
        content: doc.content,
        publishedAt: doc.publishedAt.toISOString(),
        updatedAt: doc.updatedAt.toISOString(),
        updatedBy: {
          id: doc.updater.id,
          name: doc.updater.name,
          avatarColor: doc.updater.avatarColor,
        },
      }))
    );
  } catch (error) {
    console.error('Get nudge documents error:', error);
    res.status(500).json({ error: 'Failed to get nudge documents' });
  }
});

/**
 * GET /api/nudges/:fiscalYear
 * 特定年度の協力隊細則を取得
 */
router.get('/:fiscalYear', async (req: AuthRequest, res) => {
  try {
    const fiscalYear = parseInt(req.params.fiscalYear);
    
    const document = await prisma.nudgeDocument.findUnique({
      where: { fiscalYear },
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
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({
      id: document.id,
      fiscalYear: document.fiscalYear,
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
 * POST /api/nudges
 * 新年度の協力隊細則を作成（MASTER/SUPPORT/GOVERNMENTのみ）
 */
router.post('/', async (req: AuthRequest, res) => {
  try {
    // 権限チェック
    if (!['MASTER', 'SUPPORT', 'GOVERNMENT'].includes(req.user!.role)) {
      return res.status(403).json({ error: '権限がありません' });
    }

    const data = nudgeDocumentSchema.parse(req.body);
    const userId = req.user!.id;

    // 既存チェック
    const existing = await prisma.nudgeDocument.findUnique({
      where: { fiscalYear: data.fiscalYear },
    });

    if (existing) {
      return res.status(400).json({ error: 'この年度の細則は既に存在します' });
    }

    // 新規作成
    const document = await prisma.nudgeDocument.create({
      data: {
        fiscalYear: data.fiscalYear,
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

    res.status(201).json({
      id: document.id,
      fiscalYear: document.fiscalYear,
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
    console.error('Create nudge document error:', error);
    res.status(500).json({ error: 'Failed to create nudge document' });
  }
});

/**
 * PUT /api/nudges/:fiscalYear
 * 協力隊細則を更新（MASTER/SUPPORT/GOVERNMENTのみ）
 */
router.put('/:fiscalYear', async (req: AuthRequest, res) => {
  try {
    // 権限チェック
    if (!['MASTER', 'SUPPORT', 'GOVERNMENT'].includes(req.user!.role)) {
      return res.status(403).json({ error: '権限がありません' });
    }

    const fiscalYear = parseInt(req.params.fiscalYear);
    const { title, content } = req.body;
    const userId = req.user!.id;

    // 既存の文書を取得
    const existing = await prisma.nudgeDocument.findUnique({
      where: { fiscalYear },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // 更新履歴を保存
    await prisma.nudgeRevision.create({
      data: {
        documentId: existing.id,
        content: existing.content,
        updatedBy: existing.updatedBy,
      },
    });

    // 文書を更新
    const document = await prisma.nudgeDocument.update({
      where: { fiscalYear },
      data: {
        title,
        content,
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

    res.json({
      id: document.id,
      fiscalYear: document.fiscalYear,
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
    console.error('Update nudge document error:', error);
    res.status(500).json({ error: 'Failed to update nudge document' });
  }
});

/**
 * DELETE /api/nudges/:fiscalYear
 * 協力隊細則を削除（MASTERのみ）
 */
router.delete('/:fiscalYear', async (req: AuthRequest, res) => {
  try {
    // 権限チェック
    if (req.user!.role !== 'MASTER') {
      return res.status(403).json({ error: '権限がありません' });
    }

    const fiscalYear = parseInt(req.params.fiscalYear);

    await prisma.nudgeDocument.delete({
      where: { fiscalYear },
    });

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Delete nudge document error:', error);
    res.status(500).json({ error: 'Failed to delete nudge document' });
  }
});

/**
 * GET /api/nudges/:fiscalYear/revisions
 * 更新履歴を取得
 */
router.get('/:fiscalYear/revisions', async (req: AuthRequest, res) => {
  try {
    const fiscalYear = parseInt(req.params.fiscalYear);
    
    const document = await prisma.nudgeDocument.findUnique({
      where: { fiscalYear },
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

/**
 * GET /api/nudges/:fiscalYear/pdf
 * 協力隊細則PDF出力
 */
router.get('/:fiscalYear/pdf', async (req: AuthRequest, res) => {
  try {
    const fiscalYear = parseInt(req.params.fiscalYear);
    const { generateNudgePDF } = await import('../services/pdfGenerator');
    const pdf = await generateNudgePDF(fiscalYear);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="協力隊細則_${fiscalYear}年度_${format(new Date(), 'yyyyMMdd')}.pdf"`);
    res.send(pdf);
  } catch (error) {
    console.error('Generate nudge PDF error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate PDF';
    res.status(500).json({ error: `PDF出力に失敗しました: ${errorMessage}` });
  }
});

export default router;
