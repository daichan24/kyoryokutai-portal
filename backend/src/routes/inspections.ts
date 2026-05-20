import { Router } from 'express';
import { z } from 'zod';
import { format } from 'date-fns';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateInspectionPDF } from '../services/pdfGenerator';
import { notifyInspectionResult, notifyInspectionSubmitted } from '../services/approvalEmailService';

const router = Router();
router.use(authenticate);

// バリデーションスキーマ
const createInspectionSchema = z.object({
  userId: z.string().uuid().optional(),
  date: z.string(),
  destination: z.string().min(1),
  purpose: z.string().min(1),
  participants: z.array(z.string()).default([]),
  inspectionPurpose: z.string().default(''),
  inspectionContent: z.string().default(''),
  reflection: z.string().default(''),
  futureAction: z.string().default(''),
  projectId: z.string().optional(),
  scheduleId: z.string().uuid().optional().nullable(),
});

const approvalSchema = z.object({
  approvalStatus: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().max(5000).optional().nullable(),
});

function isStaff(role: string) {
  return role === 'MASTER' || role === 'SUPPORT' || role === 'GOVERNMENT';
}

// 視察一覧取得
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { userId, projectId } = req.query;

    const where: any = {};

    if (req.user!.role === 'MEMBER') {
      if (typeof userId === 'string' && userId !== req.user!.id) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      where.userId = req.user!.id;
    } else if (userId) {
      where.userId = userId;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    const inspections = await prisma.inspection.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarColor: true,
          },
        },
        project: {
          select: {
            id: true,
            projectName: true,
          },
        },
        schedule: { select: { id: true, title: true, startDate: true, endDate: true, startTime: true, endTime: true, locationText: true } },
        approver: { select: { id: true, name: true } },
      },
      orderBy: { date: 'desc' },
    });

    res.json(inspections);
  } catch (error) {
    console.error('Get inspections error:', error);
    res.status(500).json({ error: 'Failed to get inspections' });
  }
});

// 視察詳細取得
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const inspection = await prisma.inspection.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            department: true,
            missionType: true,
          },
        },
        project: true,
        schedule: { select: { id: true, title: true, startDate: true, endDate: true, startTime: true, endTime: true, locationText: true } },
        approver: { select: { id: true, name: true } },
      },
    });

    if (!inspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }
    if (req.user!.role === 'MEMBER' && inspection.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(inspection);
  } catch (error) {
    console.error('Get inspection error:', error);
    res.status(500).json({ error: 'Failed to get inspection' });
  }
});

// 視察作成
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = createInspectionSchema.parse(req.body);
    const canCreateForOthers = req.user!.role === 'MASTER' || req.user!.role === 'SUPPORT' || req.user!.role === 'GOVERNMENT';
    const targetUserId = canCreateForOthers && data.userId ? data.userId : req.user!.id;

    if (data.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: data.projectId, userId: targetUserId },
        select: { id: true },
      });
      if (!project) {
        return res.status(400).json({ error: 'プロジェクトが見つからないか、この隊員のプロジェクトではありません' });
      }
    }

    if (data.scheduleId) {
      const schedule = await prisma.schedule.findFirst({
        where: {
          id: data.scheduleId,
          OR: [
            { userId: targetUserId },
            { scheduleParticipants: { some: { userId: targetUserId, status: 'APPROVED' } } },
          ],
        },
        select: { id: true, projectId: true },
      });
      if (!schedule) {
        return res.status(400).json({ error: '紐づける予定が見つからないか、対象隊員の予定ではありません' });
      }
      if (data.projectId && schedule.projectId && data.projectId !== schedule.projectId) {
        return res.status(400).json({ error: '予定と復命書のプロジェクトが一致していません' });
      }
    }

    const inspection = await prisma.inspection.create({
      data: {
        userId: targetUserId,
        date: new Date(data.date),
        destination: data.destination,
        purpose: data.purpose,
        participants: data.participants,
        inspectionPurpose: data.inspectionPurpose,
        inspectionContent: data.inspectionContent,
        reflection: data.reflection,
        futureAction: data.futureAction,
        projectId: data.projectId,
        scheduleId: data.scheduleId || null,
      },
      include: {
        user: true,
        project: true,
        schedule: { select: { id: true, title: true, startDate: true, endDate: true, startTime: true, endTime: true, locationText: true } },
      },
    });

    notifyInspectionSubmitted(inspection.id).catch((error) => {
      console.error('Queue inspection submitted email failed:', error);
    });

    res.status(201).json(inspection);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create inspection error:', error);
    res.status(500).json({ error: 'Failed to create inspection' });
  }
});

// 視察更新
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existingInspection = await prisma.inspection.findUnique({
      where: { id },
    });

    if (!existingInspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    if (existingInspection.userId !== req.user!.id && req.user!.role !== 'MASTER') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // 部分更新に対応
    const updateSchema = createInspectionSchema.partial();
    const data = updateSchema.parse(req.body);

    const updateData: any = {};
    if (data.date !== undefined) updateData.date = new Date(data.date);
    if (data.destination !== undefined) updateData.destination = data.destination;
    if (data.purpose !== undefined) updateData.purpose = data.purpose;
    if (data.participants !== undefined) updateData.participants = data.participants;
    if (data.inspectionPurpose !== undefined) updateData.inspectionPurpose = data.inspectionPurpose;
    if (data.inspectionContent !== undefined) updateData.inspectionContent = data.inspectionContent;
    if (data.reflection !== undefined) updateData.reflection = data.reflection;
    if (data.futureAction !== undefined) updateData.futureAction = data.futureAction;
    if (data.projectId !== undefined) updateData.projectId = data.projectId;
    if (data.projectId) {
      const project = await prisma.project.findFirst({
        where: { id: data.projectId, userId: existingInspection.userId },
        select: { id: true },
      });
      if (!project) {
        return res.status(400).json({ error: 'プロジェクトが見つからないか、この隊員のプロジェクトではありません' });
      }
    }
    if (data.scheduleId !== undefined) {
      if (data.scheduleId === null) {
        updateData.scheduleId = null;
      } else {
        const schedule = await prisma.schedule.findFirst({
          where: {
            id: data.scheduleId,
            OR: [
              { userId: existingInspection.userId },
              { scheduleParticipants: { some: { userId: existingInspection.userId, status: 'APPROVED' } } },
            ],
          },
          select: { id: true, projectId: true },
        });
        if (!schedule) {
          return res.status(400).json({ error: '紐づける予定が見つからないか、この復命書の作成者の予定ではありません' });
        }
        const nextProjectId = data.projectId !== undefined ? data.projectId : existingInspection.projectId;
        if (nextProjectId && schedule.projectId && nextProjectId !== schedule.projectId) {
          return res.status(400).json({ error: '予定と復命書のプロジェクトが一致していません' });
        }
        updateData.scheduleId = data.scheduleId;
      }
    }
    if (existingInspection.userId === req.user!.id) {
      updateData.approvalStatus = 'PENDING';
      updateData.approvalComment = null;
      updateData.approvedBy = null;
      updateData.approvedAt = null;
    }

    const inspection = await prisma.inspection.update({
      where: { id },
      data: updateData,
      include: {
        user: true,
        project: true,
        schedule: { select: { id: true, title: true, startDate: true, endDate: true, startTime: true, endTime: true, locationText: true } },
      },
    });

    if (inspection.approvalStatus === 'PENDING') {
      notifyInspectionSubmitted(inspection.id).catch((error) => {
        console.error('Queue inspection submitted email failed:', error);
      });
    }

    res.json(inspection);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update inspection error:', error);
    res.status(500).json({ error: 'Failed to update inspection' });
  }
});

router.post('/:id/approve', async (req: AuthRequest, res) => {
  try {
    if (!isStaff(req.user!.role)) {
      return res.status(403).json({ error: '承認は行政・サポート・マスターのみです' });
    }
    const { id } = req.params;
    const data = approvalSchema.parse(req.body);

    const inspection = await prisma.inspection.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });
    if (!inspection) return res.status(404).json({ error: 'Inspection not found' });
    if (inspection.userId === req.user!.id) {
      return res.status(400).json({ error: '自分の復命書は承認できません' });
    }

    const updated = await prisma.inspection.update({
      where: { id },
      data: {
        approvalStatus: data.approvalStatus,
        approvalComment: data.comment?.trim() || null,
        approvedBy: req.user!.id,
        approvedAt: new Date(),
      },
      include: {
        user: { select: { id: true, name: true, avatarColor: true } },
        project: { select: { id: true, projectName: true } },
        schedule: { select: { id: true, title: true, startDate: true, endDate: true, startTime: true, endTime: true, locationText: true } },
        approver: { select: { id: true, name: true } },
      },
    });

    notifyInspectionResult(updated.id).catch((error) => {
      console.error('Queue inspection result email failed:', error);
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    console.error('Approve inspection error:', error);
    res.status(500).json({ error: '復命書の承認処理に失敗しました' });
  }
});

router.post('/:id/reopen', async (req: AuthRequest, res) => {
  try {
    if (!isStaff(req.user!.role)) {
      return res.status(403).json({ error: '戻し操作は行政・サポート・マスターのみです' });
    }
    const { id } = req.params;
    const inspection = await prisma.inspection.findUnique({
      where: { id },
      select: { id: true, approvalStatus: true, approvedBy: true },
    });
    if (!inspection) return res.status(404).json({ error: 'Inspection not found' });
    if (inspection.approvalStatus === 'PENDING') {
      return res.status(400).json({ error: 'すでに未承認です' });
    }
    if (inspection.approvedBy !== req.user!.id) {
      return res.status(403).json({ error: 'この対応を戻せるのは対応した本人のみです' });
    }

    const updated = await prisma.inspection.update({
      where: { id },
      data: {
        approvalStatus: 'PENDING',
        approvalComment: null,
        approvedBy: null,
        approvedAt: null,
      },
      include: {
        user: { select: { id: true, name: true, avatarColor: true } },
        project: { select: { id: true, projectName: true } },
        approver: { select: { id: true, name: true } },
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Reopen inspection error:', error);
    res.status(500).json({ error: '復命書の対応取り消しに失敗しました' });
  }
});

// 視察削除
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existingInspection = await prisma.inspection.findUnique({
      where: { id },
    });

    if (!existingInspection) {
      return res.status(404).json({ error: 'Inspection not found' });
    }

    if (existingInspection.userId !== req.user!.id && req.user!.role !== 'MASTER') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.inspection.delete({
      where: { id },
    });

    res.json({ message: 'Inspection deleted successfully' });
  } catch (error) {
    console.error('Delete inspection error:', error);
    res.status(500).json({ error: 'Failed to delete inspection' });
  }
});

// 復命書PDF出力
router.get('/:id/pdf', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const row = await prisma.inspection.findUnique({
      where: { id },
      include: { user: { select: { name: true } } },
    });
    if (!row) {
      return res.status(404).json({ error: 'Inspection not found' });
    }
    if (req.user!.role === 'MEMBER' && row.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const displayName = row?.user?.name?.trim() || 'user';
    const asciiSafe = displayName.replace(/[^\w.-]+/g, '_').slice(0, 60) || 'user';
    const dateStr = format(new Date(), 'yyyyMMdd');
    const pdf = await generateInspectionPDF(id);

    res.setHeader('Content-Type', 'application/pdf');
    const utfName = encodeURIComponent(`復命書_${displayName}_${dateStr}.pdf`);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="fukumeisho_${asciiSafe}_${dateStr}.pdf"; filename*=UTF-8''${utfName}`,
    );
    res.send(pdf);
  } catch (error) {
    console.error('Generate inspection PDF error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to generate PDF';
    res.status(500).json({ error: `PDF出力に失敗しました: ${errorMessage}` });
  }
});

export default router;
