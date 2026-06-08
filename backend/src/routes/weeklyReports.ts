import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateWeeklyReportPDF } from '../services/pdfGenerator';
import { generateWeeklyReportDraft, normalizeWeeklyReportWeek } from '../services/weeklyReportGenerator';
import { notifyWeeklyReportResult, notifyWeeklyReportSubmitted } from '../services/approvalEmailService';

const router = Router();

router.use(authenticate);

function isStaff(role: string) {
  return role === 'MASTER' || role === 'SUPPORT' || role === 'GOVERNMENT';
}

const createWeeklyReportSchema = z.object({
  week: z.preprocess((value) => normalizeWeeklyReportWeek(value), z.string().regex(/^\d{4}-\d{2}$/)),
  thisWeekActivities: z.array(
    z.object({
      date: z.string(),
      activity: z.string(),
      projectId: z.string().nullable().optional(),
      projectName: z.string().optional(),
      missionName: z.string().optional(),
      sourceType: z.string().optional(),
    })
  ),
  nextWeekPlan: z.string().optional(),
  reflection: z.string().optional(),
  note: z.string().optional(),
  submittedAt: z.string().optional(),
});

const updateWeeklyReportSchema = createWeeklyReportSchema.partial();
const approvalSchema = z.object({
  approvalStatus: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().max(2000).optional().nullable(),
});

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { userId, week } = req.query;

    const where: any = {};

    if (userId) {
      where.userId = userId as string;
    } else if (req.user!.role === 'MEMBER') {
      where.userId = req.user!.id;
    }

    if (week) {
      const normalizedWeek = normalizeWeeklyReportWeek(week);
      if (!normalizedWeek) {
        return res.status(400).json({ error: '週はYYYY-WWまたはYYYY-Www形式で入力してください' });
      }
      where.week = normalizedWeek;
    }

    const reports = await prisma.weeklyReport.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatarColor: true,
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { week: 'desc' },
    });

    res.json(reports);
  } catch (error) {
    console.error('Get weekly reports error:', error);
    res.status(500).json({ error: 'Failed to get weekly reports' });
  }
});

router.get('/:userId/:week', async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const week = normalizeWeeklyReportWeek(req.params.week);
    if (!week) {
      return res.status(400).json({ error: '週はYYYY-WWまたはYYYY-Www形式で入力してください' });
    }

    if (userId !== req.user!.id && !isStaff(req.user!.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const report = await prisma.weeklyReport.findUnique({
      where: {
        userId_week: {
          userId,
          week,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatarColor: true,
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!report) {
      return res.status(404).json({ error: 'Weekly report not found' });
    }

    res.json(report);
  } catch (error) {
    console.error('Get weekly report error:', error);
    res.status(500).json({ error: 'Failed to get weekly report' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = createWeeklyReportSchema.parse(req.body);

    const report = await prisma.weeklyReport.create({
      data: {
        userId: req.user!.id,
        week: data.week,
        thisWeekActivities: data.thisWeekActivities,
        nextWeekPlan: data.nextWeekPlan,
        reflection: data.reflection,
        note: data.note,
        submittedAt: data.submittedAt ? new Date(data.submittedAt) : null,
        approvalStatus: data.submittedAt ? 'PENDING' : 'DRAFT',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatarColor: true,
          },
        },
      },
    });

    if (report.submittedAt) {
      notifyWeeklyReportSubmitted(report.id).catch((error) => {
        console.error('Queue weekly report submitted email failed:', error);
      });
    }

    res.status(201).json(report);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create weekly report error:', error);
    res.status(500).json({ error: 'Failed to create weekly report' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = updateWeeklyReportSchema.parse(req.body);

    const existingReport = await prisma.weeklyReport.findUnique({
      where: { id },
    });

    if (!existingReport) {
      return res.status(404).json({ error: 'Weekly report not found' });
    }

    // MEMBERのみ編集可能
    if (req.user!.role !== 'MEMBER' || existingReport.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updateData: any = { ...data };
    if (data.submittedAt) {
      updateData.submittedAt = new Date(data.submittedAt);
      updateData.approvalStatus = 'PENDING';
      updateData.approvalComment = null;
      updateData.approvedBy = null;
      updateData.approvedAt = null;
    }

    const report = await prisma.weeklyReport.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatarColor: true,
          },
        },
      },
    });

    if (data.submittedAt) {
      notifyWeeklyReportSubmitted(report.id).catch((error) => {
        console.error('Queue weekly report submitted email failed:', error);
      });
    }

    res.json(report);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update weekly report error:', error);
    res.status(500).json({ error: 'Failed to update weekly report' });
  }
});

router.post('/:id/approve', async (req: AuthRequest, res) => {
  try {
    if (!isStaff(req.user!.role)) {
      return res.status(403).json({ error: '承認は行政・サポート・マスターのみです' });
    }
    const { id } = req.params;
    const data = approvalSchema.parse(req.body);

    const existingReport = await prisma.weeklyReport.findUnique({
      where: { id },
      select: { id: true, submittedAt: true },
    });

    if (!existingReport) {
      return res.status(404).json({ error: 'Weekly report not found' });
    }
    if (!existingReport.submittedAt) {
      return res.status(400).json({ error: '未提出の週次報告は承認できません' });
    }

    const report = await prisma.weeklyReport.update({
      where: { id },
      data: {
        approvalStatus: data.approvalStatus,
        approvalComment: data.comment?.trim() || null,
        approvedBy: req.user!.id,
        approvedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatarColor: true,
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    notifyWeeklyReportResult(report.id).catch((error) => {
      console.error('Queue weekly report result email failed:', error);
    });

    res.json(report);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Approve weekly report error:', error);
    res.status(500).json({ error: '週次報告の承認処理に失敗しました' });
  }
});

// 週次報告の自動作成プレビュー（保存しない）
router.post('/draft-preview', async (req: AuthRequest, res) => {
  try {
    const week = normalizeWeeklyReportWeek(req.body?.week);
    if (!week) {
      return res.status(400).json({ error: '週はYYYY-WWまたはYYYY-Www形式で入力してください' });
    }

    const draft = await generateWeeklyReportDraft(req.user!.id, week);
    res.json(draft);
  } catch (error) {
    console.error('Generate weekly report draft preview error:', error);
    res.status(500).json({ error: '週次報告の自動取得に失敗しました' });
  }
});

// 週次報告の自動作成（下書き）
router.post('/draft', async (req: AuthRequest, res) => {
  try {
    const week = normalizeWeeklyReportWeek(req.body?.week);
    if (!week) {
      return res.status(400).json({ error: '週はYYYY-WWまたはYYYY-Www形式で入力してください' });
    }

    // 既に存在する場合はエラー
    const existing = await prisma.weeklyReport.findUnique({
      where: {
        userId_week: {
          userId: req.user!.id,
          week,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'この週の報告は既に存在します' });
    }

    // 下書きを自動作成
    const draft = await generateWeeklyReportDraft(req.user!.id, week);

    // 下書きとして保存（submittedAtはnullのまま）
    const report = await prisma.weeklyReport.create({
      data: {
        userId: req.user!.id,
        week: draft.week,
        thisWeekActivities: draft.thisWeekActivities as any,
        nextWeekPlan: draft.nextWeekPlan,
        reflection: draft.reflection,
        note: draft.note,
        submittedAt: null, // 下書きなのでnull
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            avatarColor: true,
          },
        },
      },
    });

    res.status(201).json(report);
  } catch (error) {
    console.error('Generate weekly report draft error:', error);
    res.status(500).json({ error: '週次報告の自動作成に失敗しました' });
  }
});

// PDF出力
router.get('/:userId/:week/pdf', async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const week = normalizeWeeklyReportWeek(req.params.week);
    if (!week) {
      return res.status(400).json({ error: '週はYYYY-WWまたはYYYY-Www形式で入力してください' });
    }

    if (userId !== req.user!.id && !isStaff(req.user!.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const pdfBuffer = await generateWeeklyReportPDF(userId, week);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="weekly-report-${week}.pdf"`);
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Generate weekly report PDF error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate PDF';
    res.status(500).json({ error: `PDF出力に失敗しました: ${errorMessage}` });
  }
});

export default router;
