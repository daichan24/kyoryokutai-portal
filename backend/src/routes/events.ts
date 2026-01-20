import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const eventSchema = z.object({
  eventName: z.string().min(1),
  eventType: z.enum(['TOWN_OFFICIAL', 'TEAM', 'OTHER']),
  date: z.string(), // 開始日（後方互換性のため残す）
  endDate: z.string().optional(), // 終了日（オプショナル、指定されない場合は開始日と同じ）
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
        creator: { select: { id: true, name: true, avatarColor: true, avatarLetter: true } },
        updater: { select: { id: true, name: true, avatarColor: true, avatarLetter: true } },
        project: { select: { id: true, projectName: true } },
        location: { select: { id: true, name: true } },
        participations: {
          include: { user: { select: { id: true, name: true, avatarColor: true, avatarLetter: true } } },
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
        creator: { select: { id: true, name: true, avatarColor: true, avatarLetter: true } },
        updater: { select: { id: true, name: true, avatarColor: true, avatarLetter: true } },
        project: true,
        participations: { 
          include: { 
            user: { select: { id: true, name: true, avatarColor: true, avatarLetter: true } } 
          } 
        },
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
    const startDate = new Date(data.date);
    const endDate = data.endDate ? new Date(data.endDate) : startDate; // 終了日が指定されていない場合は開始日と同じ
    
    const event = await prisma.event.create({
      data: {
        createdBy: req.user!.id,
        eventName: data.eventName,
        eventType: data.eventType,
        date: startDate, // 後方互換性のため
        startDate: startDate,
        endDate: endDate,
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
        creator: { select: { id: true, name: true, avatarColor: true, avatarLetter: true } },
        updater: { select: { id: true, name: true, avatarColor: true, avatarLetter: true } },
        project: { select: { id: true, projectName: true } },
        location: { select: { id: true, name: true } },
        participations: {
          include: {
            user: { select: { id: true, name: true, avatarColor: true, avatarLetter: true } },
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

    // イベント存在確認
    const event = await prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // 誰でも編集可能（最終更新者を記録）
    const dataWithEndDate = data as any;
    const updateData: any = {
      eventName: data.eventName,
      eventType: data.eventType,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      locationId: data.locationId || null,
      locationText: data.locationText || data.location || null,
      description: data.description || null,
      projectId: data.projectId || null,
      updatedBy: req.user!.id, // 最終更新者を記録
    };
    
    if (data.date) {
      const startDate = new Date(data.date);
      const endDate = dataWithEndDate.endDate ? new Date(dataWithEndDate.endDate) : startDate;
      updateData.date = startDate; // 後方互換性のため
      updateData.startDate = startDate;
      updateData.endDate = endDate;
    } else if (dataWithEndDate.endDate) {
      // dateが指定されていないがendDateが指定されている場合
      const existingStartDate = event.startDate || event.date;
      updateData.endDate = new Date(dataWithEndDate.endDate);
      updateData.startDate = existingStartDate;
    }
    
    const updated = await prisma.event.update({
      where: { id },
      data: updateData,
      include: { creator: true, project: true, updater: true },
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
        creator: { select: { id: true, name: true, avatarColor: true, avatarLetter: true } },
        updater: { select: { id: true, name: true, avatarColor: true, avatarLetter: true } },
        project: { select: { id: true, projectName: true } },
        location: { select: { id: true, name: true } },
        participations: {
          include: {
            user: { select: { id: true, name: true, avatarColor: true, avatarLetter: true } },
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

    // イベント存在確認
    const event = await prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // 誰でも削除可能
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

// イベント参加メンバー追加（管理者が他のメンバーを追加、スケジュールも自動追加）
router.post('/:id/participants', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { userIds, participationType = 'PARTICIPATION' } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds is required and must be an array' });
    }

    // イベント情報を取得
    const event = await prisma.event.findUnique({
      where: { id },
      include: {
        location: true,
      },
    });

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // ポイント計算
    const pointEarned = participationType === 'PARTICIPATION' ? 1.0 : 0.5;

    // 各ユーザーに対して参加登録とスケジュール追加
    const results = await Promise.all(
      userIds.map(async (userId: string) => {
        // 既存参加チェック
        const existing = await prisma.eventParticipation.findUnique({
          where: {
            eventId_userId: {
              eventId: id,
              userId,
            },
          },
        });

        if (existing) {
          return { userId, status: 'already_participated', participation: existing };
        }

        // 参加登録
        const participation = await prisma.eventParticipation.create({
          data: {
            eventId: id,
            userId,
            participationType,
            pointEarned,
          },
        });

        // スケジュールに追加（イベントと同じ日時で）
        // startTimeとendTimeがない場合はデフォルト値を設定
        const scheduleStartTime = event.startTime || '09:00';
        const scheduleEndTime = event.endTime || '17:00';

        // 既存のスケジュールと重複チェック（同じ日時で同じイベント名のスケジュールがあるか）
        const existingSchedule = await prisma.schedule.findFirst({
          where: {
            userId,
            date: event.date,
            startTime: scheduleStartTime,
            endTime: scheduleEndTime,
            activityDescription: event.eventName,
          },
        });

        if (!existingSchedule) {
          const scheduleStartDate = event.startDate || event.date;
          const scheduleEndDate = event.endDate || scheduleStartDate;
          
          await prisma.schedule.create({
            data: {
              userId,
              date: scheduleStartDate, // 後方互換性のため
              startDate: scheduleStartDate,
              endDate: scheduleEndDate,
              startTime: scheduleStartTime,
              endTime: scheduleEndTime,
              locationId: event.locationId || null,
              locationText: event.locationText || event.location?.name || null,
              activityDescription: event.eventName,
              freeNote: event.description || null,
              projectId: event.projectId || null,
              createdBy: 'MANUAL',
            },
          });
        }

        return { userId, status: 'added', participation };
      })
    );

    // 更新されたイベント情報を返す
    const updatedEvent = await prisma.event.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true, avatarColor: true, avatarLetter: true } },
        updater: { select: { id: true, name: true, avatarColor: true, avatarLetter: true } },
        project: { select: { id: true, projectName: true } },
        location: { select: { id: true, name: true } },
        participations: {
          include: {
            user: { select: { id: true, name: true, avatarColor: true, avatarLetter: true } },
          },
        },
      },
    });

    res.status(201).json({
      event: updatedEvent,
      results,
    });
  } catch (error) {
    console.error('Add participants error:', error);
    res.status(500).json({ error: 'Failed to add participants' });
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
