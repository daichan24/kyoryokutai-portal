import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

/**
 * GET /api/inbox
 * 受信箱: 自分宛の未対応/未読系をまとめて返す
 */
router.get('/', async (req: AuthRequest, res) => {
  try {
    const currentUserId = req.user!.id;

    // A) スケジュール招待（自分が参加者で status=PENDING）
    const scheduleInvites = await prisma.scheduleParticipant.findMany({
      where: {
        userId: currentUserId,
        status: 'PENDING',
      },
      include: {
        schedule: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                avatarColor: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // B) スケジュール承認結果（自分が作成者で、誰かがAPPROVED/REJECTEDした最近の結果）
    // 7日以内に応答があったものを取得
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const mySchedules = await prisma.schedule.findMany({
      where: {
        userId: currentUserId,
      },
      select: {
        id: true,
      },
    });

    const scheduleIds = mySchedules.length > 0 ? mySchedules.map(s => s.id) : [];

    const scheduleResponses = await prisma.scheduleParticipant.findMany({
      where: {
        scheduleId: { in: scheduleIds },
        status: { in: ['APPROVED', 'REJECTED'] },
        respondedAt: { gte: sevenDaysAgo },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarColor: true,
          },
        },
        schedule: {
          select: {
            id: true,
            activityDescription: true,
            date: true,
            startTime: true,
            endTime: true,
          },
        },
      },
      orderBy: {
        respondedAt: 'desc',
      },
      take: 20, // 最新20件
    });

    // C) タスク依頼（未対応/未読）
    const taskRequests = await prisma.taskRequest.findMany({
      where: {
        requestedTo: currentUserId,
        approvalStatus: 'PENDING',
      },
      include: {
        requester: {
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
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // レスポンス形式に整形
    const response = {
      scheduleInvites: scheduleInvites.map((invite) => ({
        participantId: invite.id,
        scheduleId: invite.scheduleId,
        fromUser: invite.schedule.user,
        title: invite.schedule.activityDescription,
        date: invite.schedule.date,
        startTime: invite.schedule.startTime,
        endTime: invite.schedule.endTime,
        status: invite.status,
        createdAt: invite.createdAt,
      })),
      scheduleResponses: scheduleResponses.map((response) => ({
        scheduleId: response.scheduleId,
        scheduleTitle: response.schedule.activityDescription,
        toUser: response.user,
        decision: response.status,
        respondedAt: response.respondedAt,
      })),
      taskRequests: taskRequests.map((request) => ({
        id: request.id,
        requester: request.requester,
        requestTitle: request.requestTitle,
        requestDescription: request.requestDescription,
        deadline: request.deadline,
        project: request.project,
        approvalStatus: request.approvalStatus,
        createdAt: request.createdAt,
      })),
    };

    res.json(response);
  } catch (error) {
    console.error('Get inbox error:', error);
    res.status(500).json({ error: 'Failed to get inbox' });
  }
});

export default router;

