import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { generateMonthlyReport } from '../services/monthlyReportGenerator';

const router = Router();
router.use(authenticate);

const createMonthlyReportSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, '月はYYYY-MM形式で入力してください'),
});

const updateMonthlyReportSchema = z.object({
  coverRecipient: z.string().optional(),
  coverSender: z.string().optional(),
  memberSheets: z.any().optional(),
  submittedAt: z.string().optional(),
  reason: z.string().optional(), // 変更理由（MASTERのみ）
});

/**
 * 【API定義】月次報告一覧取得
 * エンドポイント: GET /api/monthly-reports
 */
router.get('/', async (req: AuthRequest, res) => {
  try {
    const reports = await prisma.monthlyReport.findMany({
      include: {
        creator: { select: { id: true, name: true } },
        supportRecords: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
      orderBy: { month: 'desc' },
    });

    res.json(reports);
  } catch (error) {
    console.error('Get monthly reports error:', error);
    res.status(500).json({ error: '月次報告の取得に失敗しました' });
  }
});

/**
 * 【API定義】月次報告作成
 * エンドポイント: POST /api/monthly-reports
 * 権限: SUPPORT, MASTER のみ
 */
router.post('/', authorize('SUPPORT', 'MASTER'), async (req: AuthRequest, res) => {
  try {
    const data = createMonthlyReportSchema.parse(req.body);

    // 既に存在する月の場合はエラー
    const existing = await prisma.monthlyReport.findUnique({
      where: { month: data.month },
    });

    if (existing) {
      return res.status(400).json({ error: 'この月の月次報告は既に存在します' });
    }

    // 月次報告を自動生成
    const report = await generateMonthlyReport(data.month, req.user!.id);

    res.status(201).json(report);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create monthly report error:', error);
    res.status(500).json({ error: '月次報告の作成に失敗しました' });
  }
});

/**
 * 【API定義】月次報告詳細取得
 * エンドポイント: GET /api/monthly-reports/:id
 */
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const report = await prisma.monthlyReport.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true } },
        supportRecords: {
          include: {
            user: { select: { id: true, name: true } },
          },
          orderBy: { supportDate: 'asc' },
        },
        revisions: {
          include: {
            changer: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!report) {
      return res.status(404).json({ error: '月次報告が見つかりません' });
    }

    res.json(report);
  } catch (error) {
    console.error('Get monthly report error:', error);
    res.status(500).json({ error: '月次報告の取得に失敗しました' });
  }
});

/**
 * 【API定義】月次報告更新
 * エンドポイント: PUT /api/monthly-reports/:id
 * 権限: SUPPORT, MASTER のみ
 * 編集制限: 提出済み（submittedAtが設定されている）場合はMASTERのみ編集可能
 */
router.put('/:id', authorize('SUPPORT', 'MASTER'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = updateMonthlyReportSchema.parse(req.body);

    const existingReport = await prisma.monthlyReport.findUnique({
      where: { id },
    });

    if (!existingReport) {
      return res.status(404).json({ error: '月次報告が見つかりません' });
    }

    // 提出済みの場合はMASTERのみ編集可能
    if (existingReport.submittedAt && req.user!.role !== 'MASTER') {
      return res.status(403).json({ error: '提出済みの月次報告は編集できません（MASTERのみ編集可能）' });
    }

    // 変更前のデータを保存（変更履歴用）
    const oldData = {
      coverRecipient: existingReport.coverRecipient,
      coverSender: existingReport.coverSender,
      memberSheets: existingReport.memberSheets,
      submittedAt: existingReport.submittedAt,
    };

    // 更新データを準備
    const updateData: any = {};
    if (data.coverRecipient !== undefined) updateData.coverRecipient = data.coverRecipient;
    if (data.coverSender !== undefined) updateData.coverSender = data.coverSender;
    if (data.memberSheets !== undefined) updateData.memberSheets = data.memberSheets;
    if (data.submittedAt !== undefined) {
      updateData.submittedAt = data.submittedAt ? new Date(data.submittedAt) : null;
    }

    // 月次報告を更新
    const updatedReport = await prisma.monthlyReport.update({
      where: { id },
      data: updateData,
      include: {
        creator: { select: { id: true, name: true } },
        supportRecords: {
          include: {
            user: { select: { id: true, name: true } },
          },
          orderBy: { supportDate: 'asc' },
        },
        revisions: {
          include: {
            changer: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // 変更履歴を保存（MASTERが提出済みを編集した場合のみ）
    if (existingReport.submittedAt && req.user!.role === 'MASTER') {
      const changes: any = {};
      if (data.coverRecipient !== undefined && data.coverRecipient !== oldData.coverRecipient) {
        changes.coverRecipient = { from: oldData.coverRecipient, to: data.coverRecipient };
      }
      if (data.coverSender !== undefined && data.coverSender !== oldData.coverSender) {
        changes.coverSender = { from: oldData.coverSender, to: data.coverSender };
      }
      if (data.memberSheets !== undefined) {
        changes.memberSheets = { changed: true };
      }
      if (data.submittedAt !== undefined && data.submittedAt !== (oldData.submittedAt?.toISOString() || null)) {
        changes.submittedAt = { from: oldData.submittedAt, to: data.submittedAt };
      }

      if (Object.keys(changes).length > 0) {
        await prisma.monthlyReportRevision.create({
          data: {
            monthlyReportId: id,
            changedBy: req.user!.id,
            changes: changes as any,
            reason: data.reason || null,
          },
        });
      }
    }

    res.json(updatedReport);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update monthly report error:', error);
    res.status(500).json({ error: '月次報告の更新に失敗しました' });
  }
});

export default router;

