import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
  notifyScheduleInvite,
  notifyScheduleInviteApproved,
  notifyScheduleInviteRejected,
} from '../services/notificationService';

const router = Router();

router.use(authenticate);

const createScheduleSchema = z.object({
  date: z.string(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  locationText: z.string().optional(),
  activityDescription: z.string().min(1),
  freeNote: z.string().optional(),
  isPending: z.boolean().optional(),
  participantsUserIds: z.array(z.string()).optional(),
});

const updateScheduleSchema = createScheduleSchema.partial();

router.get('/', async (req: AuthRequest, res) => {
  try {
    const { userId, date, startDate, endDate, view } = req.query;
    const currentUserId = req.user!.id;

    // 取得条件: 作成者であるか、承認済みの参加者である
    const where: any = {
      OR: [
        { userId: currentUserId }, // 自分が作成したスケジュール
        {
          scheduleParticipants: {
            some: {
              userId: currentUserId,
              status: 'APPROVED', // 承認済みの参加者
            },
          },
        },
      ],
    };

    // 既存のフィルター条件を適用
    if (userId) {
      // userId指定時は、そのユーザーが作成したもののみ
      where.userId = userId as string;
      delete where.OR; // OR条件を削除
    }

    if (date) {
      const targetDate = new Date(date as string);
      where.date = targetDate;
    } else if (startDate && endDate) {
      where.date = {
        gte: new Date(startDate as string),
        lte: new Date(endDate as string),
      };
    } else if (view === 'week' || view === 'month') {
      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);

      if (view === 'week') {
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);

        const end = new Date(start);
        end.setDate(end.getDate() + 6);

        where.date = { gte: start, lte: end };
      } else if (view === 'month') {
        start.setDate(1);
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);
        end.setDate(0);

        where.date = { gte: start, lte: end };
      }
    }

    // 作成者かどうかを判定（where条件から）
    const isCreator = where.userId === currentUserId || (where.OR && where.OR[0]?.userId === currentUserId);

    const schedules = await prisma.schedule.findMany({
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
        scheduleParticipants: {
          // 作成者の場合は全参加者を返す、参加者の場合は自分のみ
          where: isCreator ? undefined : {
            userId: currentUserId,
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                role: true,
                avatarColor: true,
              },
            },
          },
        },
      },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    res.json(schedules);
  } catch (error) {
    console.error('Get schedules error:', error);
    res.status(500).json({ error: 'Failed to get schedules' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = createScheduleSchema.parse(req.body);
    const creatorId = req.user!.id;

    // 参加者リストから自分自身を除外
    const participantIds = (data.participantsUserIds || []).filter(
      (id) => id !== creatorId
    );

    // スケジュール作成
    const schedule = await prisma.schedule.create({
      data: {
        userId: creatorId,
        date: new Date(data.date),
        startTime: data.startTime,
        endTime: data.endTime,
        locationText: data.locationText,
        activityDescription: data.activityDescription,
        freeNote: data.freeNote,
        isPending: data.isPending || false,
        scheduleParticipants: participantIds.length > 0 ? {
          create: participantIds.map((userId) => ({
            userId,
            status: 'PENDING',
          })),
        } : undefined,
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
        scheduleParticipants: {
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
    });

    // 参加者へ通知を送信
    if (participantIds.length > 0) {
      const creator = await prisma.user.findUnique({
        where: { id: creatorId },
        select: { name: true },
      });

      const startAt = new Date(`${data.date}T${data.startTime}`);
      const endAt = new Date(`${data.date}T${data.endTime}`);

      for (const participantId of participantIds) {
        await notifyScheduleInvite(
          participantId,
          creator?.name || 'ユーザー',
          data.activityDescription,
          schedule.id,
          startAt,
          endAt
        );
      }
    }

    res.status(201).json(schedule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create schedule error:', error);
    res.status(500).json({ error: 'Failed to create schedule' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = updateScheduleSchema.parse(req.body);

    const existingSchedule = await prisma.schedule.findUnique({
      where: { id },
    });

    if (!existingSchedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // 編集権限: 作成者のみ（participantは不可）
    if (existingSchedule.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Only the creator can edit this schedule' });
    }

    const updateData: any = { ...data };
    if (data.date) {
      updateData.date = new Date(data.date);
    }

    const schedule = await prisma.schedule.update({
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
        scheduleParticipants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                role: true,
                avatarColor: true,
              },
            },
          },
        },
      },
    });

    res.json(schedule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update schedule error:', error);
    res.status(500).json({ error: 'Failed to update schedule' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existingSchedule = await prisma.schedule.findUnique({
      where: { id },
    });

    if (!existingSchedule) {
      return res.status(404).json({ error: 'Schedule not found' });
    }

    // 削除権限: 作成者のみ（participantは不可）
    if (existingSchedule.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Only the creator can delete this schedule' });
    }

    await prisma.schedule.delete({
      where: { id },
    });

    res.json({ message: 'Schedule deleted successfully' });
  } catch (error) {
    console.error('Delete schedule error:', error);
    res.status(500).json({ error: 'Failed to delete schedule' });
  }
});

// スケジュール招待への承認/却下
router.post('/:id/respond', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { decision } = req.body;
    const currentUserId = req.user!.id;

    if (!decision || !['APPROVED', 'REJECTED'].includes(decision)) {
      return res.status(400).json({ error: 'Invalid decision. Must be APPROVED or REJECTED' });
    }

    // 参加者レコードを取得
    const participant = await prisma.scheduleParticipant.findUnique({
      where: {
        scheduleId_userId: {
          scheduleId: id,
          userId: currentUserId,
        },
      },
      include: {
        schedule: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!participant) {
      return res.status(404).json({ error: 'Schedule invitation not found' });
    }

    // ステータス更新
    const updatedParticipant = await prisma.scheduleParticipant.update({
      where: {
        scheduleId_userId: {
          scheduleId: id,
          userId: currentUserId,
        },
      },
      data: {
        status: decision,
        respondedAt: new Date(),
      },
    });

    // 作成者へ通知
    if (decision === 'APPROVED') {
      await notifyScheduleInviteApproved(
        participant.schedule.userId,
        participant.user.name,
        participant.schedule.activityDescription,
        id
      );
    } else {
      await notifyScheduleInviteRejected(
        participant.schedule.userId,
        participant.user.name,
        participant.schedule.activityDescription,
        id
      );
    }

    res.json(updatedParticipant);
  } catch (error) {
    console.error('Respond to schedule invite error:', error);
    res.status(500).json({ error: 'Failed to respond to schedule invite' });
  }
});

export default router;
