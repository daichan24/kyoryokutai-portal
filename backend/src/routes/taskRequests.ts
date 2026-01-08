import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { notifyTaskRequest } from '../services/notificationService';

const router = Router();
router.use(authenticate);

// バリデーションスキーマ
const createTaskRequestSchema = z.object({
  requestedTo: z.string(),
  requestTitle: z.string().min(1),
  requestDescription: z.string().min(1),
  deadline: z.string().optional(),
  projectId: z.string().optional(),
});

const respondSchema = z.object({
  approvalStatus: z.enum(['APPROVED', 'REJECTED']),
  approvalNote: z.string().optional(),
});

// タスク依頼一覧取得
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

    const requests = await prisma.taskRequest.findMany({
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
    console.error('Get task requests error:', error);
    res.status(500).json({ error: 'Failed to get task requests' });
  }
});

// タスク依頼詳細取得
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const request = await prisma.taskRequest.findUnique({
      where: { id },
      include: {
        requester: true,
        requestee: true,
        project: true,
        createdTask: true,
      },
    });

    if (!request) {
      return res.status(404).json({ error: 'Task request not found' });
    }

    res.json(request);
  } catch (error) {
    console.error('Get task request error:', error);
    res.status(500).json({ error: 'Failed to get task request' });
  }
});

// タスク依頼作成（サポート・役場のみ）
router.post('/', authorize('SUPPORT', 'GOVERNMENT'), async (req: AuthRequest, res) => {
  try {
    const data = createTaskRequestSchema.parse(req.body);

    const taskRequest = await prisma.taskRequest.create({
      data: {
        requestedBy: req.user!.id,
        requestedTo: data.requestedTo,
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
    await notifyTaskRequest(
      data.requestedTo,
      requester?.name || 'Unknown',
      data.requestTitle,
      taskRequest.id
    );

    res.status(201).json(taskRequest);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create task request error:', error);
    res.status(500).json({ error: 'Failed to create task request' });
  }
});

// タスク依頼に応答（承認/却下）
router.post('/:id/respond', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = respondSchema.parse(req.body);

    const existingRequest = await prisma.taskRequest.findUnique({
      where: { id },
      include: { project: true },
    });

    if (!existingRequest) {
      return res.status(404).json({ error: 'Task request not found' });
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

    // タスク依頼を更新
    const updatedRequest = await prisma.taskRequest.update({
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
    console.error('Respond to task request error:', error);
    res.status(500).json({ error: 'Failed to respond to task request' });
  }
});

// タスク依頼削除（依頼者のみ）
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existingRequest = await prisma.taskRequest.findUnique({
      where: { id },
    });

    if (!existingRequest) {
      return res.status(404).json({ error: 'Task request not found' });
    }

    if (existingRequest.requestedBy !== req.user!.id && req.user!.role !== 'MASTER') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.taskRequest.delete({
      where: { id },
    });

    res.json({ message: 'Task request deleted successfully' });
  } catch (error) {
    console.error('Delete task request error:', error);
    res.status(500).json({ error: 'Failed to delete task request' });
  }
});

export default router;
