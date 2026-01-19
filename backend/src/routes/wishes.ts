import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const createWishSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.string().optional(),
  status: z.enum(['ACTIVE', 'DONE', 'PAUSED']).optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  estimate: z.enum(['S', 'M', 'L']).optional(),
  priority: z.enum(['LOW', 'MID', 'HIGH']).optional(),
  dueMonth: z.number().int().min(1).max(12).optional(),
  tags: z.array(z.string()).optional(),
  memo: z.string().optional(),
});

const updateWishSchema = createWishSchema.partial();

const createCheckinSchema = z.object({
  type: z.enum(['REFLECTION', 'NOTE']),
  content: z.string().min(1),
});

// GET /api/wishes - 自分のやりたいこと一覧（または指定ユーザーの一覧）
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { status, category, search, sort, userId } = req.query;
    // メンバー以外の役職は、userIdパラメータで他のメンバーのリストを見れる
    // メンバーは自分のもののみ
    const targetUserId = req.user!.role === 'MEMBER' 
      ? req.user!.id 
      : (userId ? userId as string : req.user!.id);
    
    const where: any = {
      userId: targetUserId,
    };

    if (status) {
      where.status = status;
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { title: { contains: search as string } },
        { memo: { contains: search as string } },
        { tags: { has: search as string } },
      ];
    }

    let orderBy: any = {};
    if (sort === 'priority') {
      orderBy = { priority: 'desc' };
    } else if (sort === 'dueMonth') {
      orderBy = { dueMonth: 'asc' };
    } else if (sort === 'created') {
      orderBy = { createdAt: 'desc' };
    } else {
      // デフォルト：ACTIVE優先、EASY/S優先、dueMonthが今月/来月のものが上
      orderBy = [
        { status: 'asc' }, // ACTIVEが先
        { difficulty: 'asc' }, // EASYが先
        { estimate: 'asc' }, // Sが先
        { dueMonth: 'asc' },
        { createdAt: 'desc' },
      ];
    }

    const wishes = await prisma.wish.findMany({
      where,
      include: {
        checkins: {
          orderBy: { createdAt: 'desc' },
          take: 1, // 最新の1件のみ
        },
      },
      orderBy,
    });

    res.json(wishes);
  } catch (error) {
    console.error('Get wishes error:', error);
    res.status(500).json({ error: 'やりたいことの取得に失敗しました' });
  }
});

// GET /api/wishes/stats - 統計情報
router.get('/stats', async (req: AuthRequest, res) => {
  try {
    const { userId } = req.query;
    // メンバー以外の役職は、userIdパラメータで他のメンバーの統計を見れる
    const targetUserId = req.user!.role === 'MEMBER' 
      ? req.user!.id 
      : (userId ? userId as string : req.user!.id);
    
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    const startOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const endOfMonth = new Date(currentYear, currentMonth, 0, 23, 59, 59);

    const [total, done, thisMonthDone, active] = await Promise.all([
      prisma.wish.count({
        where: { userId: targetUserId },
      }),
      prisma.wish.count({
        where: {
          userId: targetUserId,
          status: 'DONE',
        },
      }),
      prisma.wish.count({
        where: {
          userId: targetUserId,
          status: 'DONE',
          completedAt: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      }),
      prisma.wish.count({
        where: {
          userId: targetUserId,
          status: 'ACTIVE',
        },
      }),
    ]);

    res.json({
      total,
      done,
      thisMonthDone,
      active,
    });
  } catch (error) {
    console.error('Get wishes stats error:', error);
    res.status(500).json({ error: '統計情報の取得に失敗しました' });
  }
});

// GET /api/wishes/next - 次にやる1つ（推奨）
router.get('/next', async (req: AuthRequest, res) => {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;

    // ACTIVEで、EASY/S優先、dueMonthが今月/来月のもの
    const wishes = await prisma.wish.findMany({
      where: {
        userId: req.user!.id,
        status: 'ACTIVE',
        OR: [
          { difficulty: 'EASY' },
          { estimate: 'S' },
          { dueMonth: currentMonth },
          { dueMonth: nextMonth },
        ],
      },
      orderBy: [
        { difficulty: 'asc' },
        { estimate: 'asc' },
        { dueMonth: 'asc' },
        { createdAt: 'asc' },
      ],
      take: 1,
    });

    if (wishes.length === 0) {
      // 候補がない場合は、ACTIVEのものを返す
      const fallback = await prisma.wish.findFirst({
        where: {
          userId: req.user!.id,
          status: 'ACTIVE',
        },
        orderBy: { createdAt: 'asc' },
      });
      return res.json(fallback);
    }

    res.json(wishes[0]);
  } catch (error) {
    console.error('Get next wish error:', error);
    res.status(500).json({ error: '次にやる1つの取得に失敗しました' });
  }
});

// GET /api/wishes/:id - やりたいこと詳細
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const wish = await prisma.wish.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
        checkins: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!wish) {
      return res.status(404).json({ error: 'やりたいことが見つかりません' });
    }

    // 所有者のみ閲覧可能
    if (wish.userId !== req.user!.id) {
      return res.status(403).json({ error: 'このやりたいことは閲覧できません' });
    }

    res.json(wish);
  } catch (error) {
    console.error('Get wish error:', error);
    res.status(500).json({ error: 'やりたいことの取得に失敗しました' });
  }
});

// POST /api/wishes - やりたいこと作成
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = createWishSchema.parse(req.body);

    const wish = await prisma.wish.create({
      data: {
        ...data,
        userId: req.user!.id,
        tags: data.tags || [],
        status: data.status || 'ACTIVE', // デフォルト値を設定
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json(wish);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errorMessage = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return res.status(400).json({ error: errorMessage });
    }
    console.error('Create wish error:', error);
    res.status(500).json({ error: 'やりたいことの作成に失敗しました' });
  }
});

// PUT /api/wishes/:id - やりたいこと更新
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = updateWishSchema.parse(req.body);

    const existingWish = await prisma.wish.findUnique({
      where: { id },
    });

    if (!existingWish) {
      return res.status(404).json({ error: 'やりたいことが見つかりません' });
    }

    // 所有者のみ更新可能
    if (existingWish.userId !== req.user!.id) {
      return res.status(403).json({ error: 'このやりたいことは編集できません' });
    }

    const wish = await prisma.wish.update({
      where: { id },
      data: {
        ...data,
        tags: data.tags !== undefined ? data.tags : existingWish.tags,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json(wish);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update wish error:', error);
    res.status(500).json({ error: 'やりたいことの更新に失敗しました' });
  }
});

// POST /api/wishes/:id/complete - やりたいこと完了
router.post('/:id/complete', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existingWish = await prisma.wish.findUnique({
      where: { id },
    });

    if (!existingWish) {
      return res.status(404).json({ error: 'やりたいことが見つかりません' });
    }

    // 所有者のみ完了可能
    if (existingWish.userId !== req.user!.id) {
      return res.status(403).json({ error: 'このやりたいことは完了できません' });
    }

    const wish = await prisma.wish.update({
      where: { id },
      data: {
        status: 'DONE',
        completedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.json(wish);
  } catch (error) {
    console.error('Complete wish error:', error);
    res.status(500).json({ error: 'やりたいことの完了処理に失敗しました' });
  }
});

// DELETE /api/wishes/:id - やりたいこと削除
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existingWish = await prisma.wish.findUnique({
      where: { id },
    });

    if (!existingWish) {
      return res.status(404).json({ error: 'やりたいことが見つかりません' });
    }

    // 所有者のみ削除可能
    if (existingWish.userId !== req.user!.id) {
      return res.status(403).json({ error: 'このやりたいことは削除できません' });
    }

    await prisma.wish.delete({
      where: { id },
    });

    res.json({ message: 'やりたいことを削除しました' });
  } catch (error) {
    console.error('Delete wish error:', error);
    res.status(500).json({ error: 'やりたいことの削除に失敗しました' });
  }
});

// GET /api/wishes/:id/checkins - 振り返りログ一覧
router.get('/:id/checkins', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const existingWish = await prisma.wish.findUnique({
      where: { id },
    });

    if (!existingWish) {
      return res.status(404).json({ error: 'やりたいことが見つかりません' });
    }

    // 所有者のみ閲覧可能
    if (existingWish.userId !== req.user!.id) {
      return res.status(403).json({ error: 'このやりたいことは閲覧できません' });
    }

    const checkins = await prisma.wishCheckin.findMany({
      where: { wishId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(checkins);
  } catch (error) {
    console.error('Get checkins error:', error);
    res.status(500).json({ error: '振り返りログの取得に失敗しました' });
  }
});

// POST /api/wishes/:id/checkins - 振り返りログ追加
router.post('/:id/checkins', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = createCheckinSchema.parse(req.body);

    const existingWish = await prisma.wish.findUnique({
      where: { id },
    });

    if (!existingWish) {
      return res.status(404).json({ error: 'やりたいことが見つかりません' });
    }

    // 所有者のみ追加可能
    if (existingWish.userId !== req.user!.id) {
      return res.status(403).json({ error: 'このやりたいことは編集できません' });
    }

    const checkin = await prisma.wishCheckin.create({
      data: {
        ...data,
        wishId: id,
        userId: req.user!.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    res.status(201).json(checkin);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create checkin error:', error);
    res.status(500).json({ error: '振り返りログの追加に失敗しました' });
  }
});

export default router;

