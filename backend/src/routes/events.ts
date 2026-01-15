import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const eventSchema = z.object({
  eventName: z.string().min(1),
  eventType: z.enum(['TOWN_OFFICIAL', 'TEAM', 'OTHER']),
  date: z.string(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  location: z.string().optional(),
  locationText: z.string().optional(),
  locationId: z.string().optional(),
  description: z.string().optional(),
  maxParticipants: z.number().optional(),
  projectId: z.string().optional(),
  participants: z.array(z.object({
    userId: z.string(),
    participationType: z.enum(['PARTICIPATION', 'PREPARATION']),
  })).optional(),
});

// イベント一覧取得
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { eventType, status } = req.query;
    const where: any = {};

    if (eventType) where.eventType = eventType;

    const events = await prisma.event.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true, avatarColor: true } },
        project: { select: { id: true, projectName: true } },
        location: { select: { id: true, name: true } },
        participations: {
          include: { user: { select: { id: true, name: true, avatarColor: true } } },
        },
      },
      orderBy: { date: 'desc' },
    });

    // クライアント側で実施済み/未実施を判定しやすくするため、endAtを計算して追加
    const now = new Date();
    const eventsWithStatus = events.map(event => {
      // endAtを計算（date + endTime、endTimeがない場合はdateの23:59:59）
      let endAt: Date;
      if (event.endTime) {
        const [hours, minutes] = event.endTime.split(':').map(Number);
        endAt = new Date(event.date);
        endAt.setHours(hours, minutes, 0, 0);
      } else {
        endAt = new Date(event.date);
        endAt.setHours(23, 59, 59, 999);
      }
      
      const isCompleted = endAt < now;
      
      return {
        ...event,
        endAt: endAt.toISOString(),
        isCompleted,
      };
    });

    // ステータスフィルター（クライアント側でフィルタリング）
    let filteredEvents = eventsWithStatus;
    if (status === 'upcoming') {
      filteredEvents = eventsWithStatus.filter(e => !e.isCompleted);
    } else if (status === 'past') {
      filteredEvents = eventsWithStatus.filter(e => e.isCompleted);
    }

    res.json(filteredEvents);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

// イベント詳細取得
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: {
        creator: true,
        project: true,
        participations: { include: { user: true } },
      },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ error: 'Failed to get event' });
  }
});

// イベント作成
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = eventSchema.parse(req.body);

    // イベント作成
    const event = await prisma.event.create({
      data: {
        createdBy: req.user!.id,
        eventName: data.eventName,
        eventType: data.eventType,
        date: new Date(data.date),
        startTime: data.startTime || null,
        endTime: data.endTime || null,
        locationId: data.locationId || null,
        locationText: data.locationText || data.location || null,
        description: data.description || null,
        projectId: data.projectId || null,
      },
      include: { creator: true, project: true },
    });

    // 参加メンバーを追加
    if (data.participants && data.participants.length > 0) {
      await Promise.all(
        data.participants.map((participant) => {
          const pointEarned = participant.participationType === 'PARTICIPATION' 
            ? 1.0 
            : 0.5;
          return prisma.eventParticipation.create({
            data: {
              eventId: event.id,
              userId: participant.userId,
              participationType: participant.participationType,
              pointEarned,
            },
          });
        })
      );
    }

    // 参加メンバーを含めて再取得
    const eventWithParticipants = await prisma.event.findUnique({
      where: { id: event.id },
      include: {
        creator: { select: { id: true, name: true, avatarColor: true } },
        project: { select: { id: true, projectName: true } },
        location: { select: { id: true, name: true } },
        participations: {
          include: {
            user: { select: { id: true, name: true, avatarColor: true } },
          },
        },
      },
    });

    res.status(201).json(eventWithParticipants);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// イベント更新
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = eventSchema.parse(req.body);

    // 作成者のみ編集可能
    const event = await prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.createdBy !== req.user!.id && req.user!.role !== 'MASTER') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // イベント情報を更新
    const updated = await prisma.event.update({
      where: { id },
      data: {
        eventName: data.eventName,
        eventType: data.eventType,
        date: new Date(data.date),
        startTime: data.startTime || null,
        endTime: data.endTime || null,
        locationId: data.locationId || null,
        locationText: data.locationText || data.location || null,
        description: data.description || null,
        projectId: data.projectId || null,
      },
      include: { creator: true, project: true },
    });

    // 参加メンバーを更新（既存を削除して新規作成）
    if (data.participants !== undefined) {
      // 既存の参加メンバーを削除
      await prisma.eventParticipation.deleteMany({
        where: { eventId: id },
      });

      // 新しい参加メンバーを追加
      if (data.participants.length > 0) {
        await Promise.all(
          data.participants.map((participant) => {
            const pointEarned = participant.participationType === 'PARTICIPATION' 
              ? 1.0 
              : 0.5;
            return prisma.eventParticipation.create({
              data: {
                eventId: id,
                userId: participant.userId,
                participationType: participant.participationType,
                pointEarned,
              },
            });
          })
        );
      }
    }

    // 参加メンバーを含めて再取得
    const eventWithParticipants = await prisma.event.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, avatarColor: true } },
        project: { select: { id: true, projectName: true } },
        location: { select: { id: true, name: true } },
        participations: {
          include: {
            user: { select: { id: true, name: true, avatarColor: true } },
          },
        },
      },
    });

    res.json(eventWithParticipants);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update event error:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// イベント削除
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // 作成者のみ削除可能
    const event = await prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    if (event.createdBy !== req.user!.id && req.user!.role !== 'MASTER') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    await prisma.event.delete({
      where: { id },
    });

    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// イベント参加登録
router.post('/:id/participate', async (req: AuthRequest, res) => {
  try {
    const { participationType } = req.body;

    // 既存参加チェック
    const existing = await prisma.eventParticipation.findUnique({
      where: {
        eventId_userId: {
          eventId: req.params.id,
          userId: req.user!.id,
        },
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'Already participated' });
    }

    // ポイント計算
    let pointEarned = 0;
    if (participationType === 'PARTICIPATION') {
      pointEarned = 1.0;
    } else if (participationType === 'PREPARATION') {
      pointEarned = 0.5;
    }

    const participation = await prisma.eventParticipation.create({
      data: {
        eventId: req.params.id,
        userId: req.user!.id,
        participationType,
        pointEarned,
      },
      include: { event: true, user: true },
    });

    res.status(201).json(participation);
  } catch (error) {
    console.error('Participate in event error:', error);
    res.status(500).json({ error: 'Failed to participate in event' });
  }
});

// イベント参加キャンセル
router.delete('/:id/participate', async (req: AuthRequest, res) => {
  try {
    await prisma.eventParticipation.delete({
      where: {
        eventId_userId: {
          eventId: req.params.id,
          userId: req.user!.id,
        },
      },
    });

    res.json({ message: 'Participation cancelled successfully' });
  } catch (error) {
    console.error('Cancel participation error:', error);
    res.status(500).json({ error: 'Failed to cancel participation' });
  }
});

// イベント参加状況サマリー（自分の参加回数・ポイント）
router.get('/participation-summary', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // 今月の参加
    const thisMonthParticipations = await prisma.eventParticipation.findMany({
      where: {
        userId,
        createdAt: {
          gte: currentMonthStart,
          lte: currentMonthEnd,
        },
      },
      include: {
        event: {
          select: {
            id: true,
            eventName: true,
            date: true,
          },
        },
      },
    });

    // 累計参加
    const allParticipations = await prisma.eventParticipation.findMany({
      where: {
        userId,
      },
      include: {
        event: {
          select: {
            id: true,
            eventName: true,
            date: true,
          },
        },
      },
    });

    const thisMonthCount = thisMonthParticipations.length;
    const totalCount = allParticipations.length;
    const totalPoints = allParticipations.reduce((sum, p) => sum + p.pointEarned, 0);

    res.json({
      thisMonthCount,
      totalCount,
      totalPoints,
    });
  } catch (error) {
    console.error('Get participation summary error:', error);
    res.status(500).json({ error: 'Failed to get participation summary' });
  }
});

// 年間ポイント集計
router.get('/points/summary/:userId?', async (req: AuthRequest, res) => {
  try {
    const userId = req.params.userId || req.user!.id;
    const year = req.query.year ? parseInt(req.query.year as string) : new Date().getFullYear();

    const participations = await prisma.eventParticipation.findMany({
      where: {
        userId,
        event: {
          date: {
            gte: new Date(`${year}-01-01`),
            lte: new Date(`${year}-12-31`),
          },
        },
      },
      include: { event: true },
    });

    const totalPoints = participations.reduce((sum, p) => sum + p.pointEarned, 0);
    const participationCount = participations.filter(
      (p) => p.participationType === 'PARTICIPATION'
    ).length;
    const preparationCount = participations.filter(
      (p) => p.participationType === 'PREPARATION'
    ).length;

    res.json({
      userId,
      year,
      totalPoints,
      participationCount,
      preparationCount,
      targetPoints: 10,
      progress: (totalPoints / 10) * 100,
    });
  } catch (error) {
    console.error('Get points summary error:', error);
    res.status(500).json({ error: 'Failed to get points summary' });
  }
});

export default router;
