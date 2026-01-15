import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { notifyRequest } from '../services/notificationService';
import type { Role } from '@prisma/client';

const router = Router();
router.use(authenticate);

// バリデーションスキーマ
const createRequestSchema = z.object({
  requesteeId: z.string(),
  requestTitle: z.string().min(1),
  requestDescription: z.string().min(1),
  deadline: z.string().optional(),
  projectId: z.string().optional(),
});

const respondSchema = z.object({
  approvalStatus: z.enum(['APPROVED', 'REJECTED']),
  approvalNote: z.string().optional(),
});

// 依頼一覧取得
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { status, requestedTo } = req.query;

    const where: any = {};

    // フィルター条件
    if (status) {
      where.approvalStatus = status;
    }

    if (requestedTo) {
      where.requestedTo = requestedTo;
    } else if (req.user!.role === 'MEMBER') {
      // 協力隊員は自分宛の依頼のみ
      where.requestedTo = req.user!.id;
    }

    const requests = await prisma.request.findMany({
      where,
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            role: true,
            avatarColor: true,
          },
        },
        requestee: {
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
        createdTask: {
          select: {
            id: true,
            taskName: true,
            progress: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(requests);
  } catch (error) {
    console.error('Get requests error:', error);
    res.status(500).json({ error: 'Failed to get requests' });
  }
});

// 依頼詳細取得
router.get('/:id', async (req, res) => {
  try {
    const request = await prisma.request.findUnique({
      where: { id: req.params.id },
      include: {
        requester: true,
        requestee: true,
        project: true,
        createdTask: true,
      },
    });

    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }

    res.json(request);
  } catch (error) {
    console.error('Get request error:', error);
    res.status(500).json({ error: 'Failed to get request' });
  }
});

// 依頼作成（MASTER, SUPPORT, GOVERNMENT, MEMBER 全員可能）
router.post('/', async (req: AuthRequest, res) => {
  try {
    // 認可チェック: MASTER, SUPPORT, GOVERNMENT, MEMBER 全員可能
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const allowedRoles: Role[] = ['MASTER', 'SUPPORT', 'GOVERNMENT', 'MEMBER'];
    if (!allowedRoles.includes(req.user.role)) {
      console.log(`❌ [AUTH] POST /api/requests: Role ${req.user.role} is not allowed`);
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    console.log(`✅ [AUTH] POST /api/requests: User ${req.user.email} (${req.user.role}) is allowed`);

    const data = createRequestSchema.parse(req.body);

    const request = await prisma.request.create({
      data: {
        requestedBy: req.user.id,
        requestedTo: data.requesteeId,
        requestTitle: data.requestTitle,
        requestDescription: data.requestDescription,
        deadline: data.deadline ? new Date(data.deadline) : null,
        projectId: data.projectId,
      },
      include: {
        requester: true,
        requestee: true,
        project: true,
      },
    });

    // 通知を送信
    const requester = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { name: true },
    });
    await notifyRequest(
      data.requesteeId,
      requester?.name || 'Unknown',
      data.requestTitle,
      request.id
    );

    res.status(201).json(request);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create request error:', error);
    res.status(500).json({ error: 'Failed to create request' });
  }
});

// 依頼に応答（承認/却下）
router.post('/:id/respond', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = respondSchema.parse(req.body);

    const existingRequest = await prisma.request.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!existingRequest) {
      return res.status(404).json({ error: 'Request not found' });
    }

    // 依頼先本人のみ応答可能
    if (existingRequest.requestedTo !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    // 承認の場合、ProjectTaskを自動作成
    let createdTaskId: string | undefined;

    if (data.approvalStatus === 'APPROVED' && existingRequest.projectId) {
      const task = await prisma.projectTask.create({
        data: {
          projectId: existingRequest.projectId,
          taskName: existingRequest.requestTitle,
          assignedTo: existingRequest.requestedTo,
          deadline: existingRequest.deadline,
          progress: 0,
        },
      });
      createdTaskId = task.id;
    }

    // 依頼を更新
    const updatedRequest = await prisma.request.update({
      where: { id },
      data: {
        approvalStatus: data.approvalStatus,
        approvalNote: data.approvalNote,
        approvedAt: new Date(),
        createdTaskId,
      },
      include: {
        requester: true,
        requestee: true,
        project: true,
        createdTask: true,
      },
    });

    res.json(updatedRequest);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Respond to request error:', error);
    res.status(500).json({ error: 'Failed to respond to request' });
  }
});

export default router;

