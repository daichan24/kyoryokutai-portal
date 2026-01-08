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
  location: z.string().optional(),
  locationText: z.string().optional(),
  description: z.string().optional(),
  maxParticipants: z.number().optional(),
  projectId: z.string().optional(),
});

// イベント一覧取得
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { eventType, upcoming } = req.query;
    const where: any = {};

    if (eventType) where.eventType = eventType;
    if (upcoming === 'true') {
      where.date = { gte: new Date() };
    }

    const events = await prisma.event.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true, avatarColor: true } },
        project: { select: { id: true, projectName: true } },
        participations: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
      orderBy: { date: 'desc' },
    });

    res.json(events);
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ error: 'Failed to get events' });
  }
});

// イベント詳細取得
router.get('/:id', async (req, res) => {
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

    const event = await prisma.event.create({
      data: {
        createdBy: req.user!.id,
        eventName: data.eventName,
        eventType: data.eventType,
        date: new Date(data.date),
        locationText: data.locationText || data.location,
        description: data.description,
        projectId: data.projectId,
      },
      include: { creator: true, project: true },
    });

    res.status(201).json(event);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create event error:', error);
    res.status(500).json({ error: 'Failed to create event' });
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
