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

export default router;

