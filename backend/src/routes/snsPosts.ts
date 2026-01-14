import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getCurrentWeekBoundary, getWeekBoundaryForDate } from '../utils/weekBoundary';

const router = Router();
router.use(authenticate);

// 新スキーマ（詳細入力対応）
const snsPostCreateSchema = z.object({
  postedAt: z.string(), // ISO日時文字列
  postType: z.enum(['STORY', 'FEED']),
  url: z.string().url().optional().or(z.literal('')),
  theme: z.string().max(200).optional(),
  followerDelta: z.number().int().min(0).optional(),
  views: z.number().int().min(0).optional(),
  likes: z.number().int().min(0).optional(),
  note: z.string().max(2000).optional(),
});

const snsPostUpdateSchema = snsPostCreateSchema.partial();

// 旧スキーマ（後方互換性のため残す）
const snsPostLegacySchema = z.object({
  week: z.string(),
  postDate: z.string().optional(),
  postType: z.enum(['STORY', 'FEED', 'BOTH']).optional(),
  isPosted: z.boolean().default(false),
});

/**
 * GET /api/sns-posts
 * SNS投稿一覧取得（期間指定可能）
 * 
 * クエリパラメータ:
 * - userId: 特定ユーザーの投稿のみ
 * - from: YYYY-MM-DD形式の開始日
 * - to: YYYY-MM-DD形式の終了日
 * - week: 週キー（YYYY-WW形式、後方互換性のため残す）
 */
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { userId, week, from, to } = req.query;
    const where: any = {};

    if (userId) {
      where.userId = userId;
    } else if (req.user!.role === 'MEMBER') {
      where.userId = req.user!.id;
    }

    // 期間指定（優先）
    if (from || to) {
      where.postedAt = {};
      if (from) {
        where.postedAt.gte = new Date(from as string);
      }
      if (to) {
        const toDate = new Date(to as string);
        toDate.setHours(23, 59, 59, 999);
        where.postedAt.lte = toDate;
      }
    } else if (week) {
      // 後方互換性: week指定
      where.week = week;
    }

    const posts = await prisma.sNSPost.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { postedAt: 'desc' },
    });

    res.json(posts);
  } catch (error) {
    console.error('Get SNS posts error:', error);
    res.status(500).json({ error: 'Failed to get SNS posts' });
  }
});

/**
 * GET /api/sns-posts/weekly-status
 * 週次投稿状況を取得（月曜9:00 JST基準）
 * 
 * クエリパラメータ:
 * - userId: 特定ユーザー（省略時は自分）
 */
router.get('/weekly-status', async (req: AuthRequest, res) => {
  try {
    const targetUserId = (req.query.userId as string) || req.user!.id;
    const { weekStart, weekEnd } = getCurrentWeekBoundary();

    const posts = await prisma.sNSPost.findMany({
      where: {
        userId: targetUserId,
        postedAt: {
          gte: weekStart,
          lt: weekEnd,
        },
      },
      select: {
        postType: true,
      },
    });

    const hasStory = posts.some((p) => p.postType === 'STORY');
    const hasFeed = posts.some((p) => p.postType === 'FEED');

    res.json({
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      hasStory,
      hasFeed,
    });
  } catch (error) {
    console.error('Get weekly status error:', error);
    res.status(500).json({ error: 'Failed to get weekly status' });
  }
});

/**
 * POST /api/sns-posts
 * SNS投稿を作成（詳細入力対応）
 */
router.post('/', async (req: AuthRequest, res) => {
  try {
    // 新スキーマで試行
    try {
      const data = snsPostCreateSchema.parse(req.body);
      const postedAt = new Date(data.postedAt);
      const { weekKey } = getWeekBoundaryForDate(postedAt);

      const post = await prisma.sNSPost.create({
        data: {
          userId: req.user!.id,
          week: weekKey,
          postedAt,
          postType: data.postType,
          url: data.url && data.url.trim() !== '' ? data.url : null,
          theme: data.theme && data.theme.trim() !== '' ? data.theme : null,
          followerDelta: data.followerDelta ?? null,
          views: data.views ?? null,
          likes: data.likes ?? null,
          note: data.note && data.note.trim() !== '' ? data.note : null,
        },
        include: { user: true },
      });

      return res.json(post);
    } catch (zodError) {
      // 旧スキーマで試行（後方互換性）
      if (zodError instanceof z.ZodError) {
        const legacyData = snsPostLegacySchema.parse(req.body);
        const post = await prisma.sNSPost.upsert({
          where: {
            userId_week: {
              userId: req.user!.id,
              week: legacyData.week,
            },
          },
          update: {
            postDate: legacyData.postDate ? new Date(legacyData.postDate) : null,
            postType: legacyData.postType,
            isPosted: legacyData.isPosted,
          },
          create: {
            userId: req.user!.id,
            week: legacyData.week,
            postDate: legacyData.postDate ? new Date(legacyData.postDate) : null,
            postType: legacyData.postType,
            isPosted: legacyData.isPosted,
            postedAt: legacyData.postDate ? new Date(legacyData.postDate) : new Date(),
          },
          include: { user: true },
        });

        return res.json(post);
      }
      throw zodError;
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create SNS post error:', error);
    res.status(500).json({ error: 'Failed to create SNS post' });
  }
});

/**
 * PUT /api/sns-posts/:id
 * SNS投稿を更新（詳細入力対応）
 */
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = snsPostUpdateSchema.parse(req.body);

    const existingPost = await prisma.sNSPost.findUnique({
      where: { id },
    });

    if (!existingPost) {
      return res.status(404).json({ error: 'SNS投稿が見つかりません' });
    }

    // 自分の投稿のみ更新可能（MEMBERの場合）
    if (req.user!.role === 'MEMBER' && existingPost.userId !== req.user!.id) {
      return res.status(403).json({ error: '権限がありません' });
    }

    const updateData: any = {};
    if (data.postedAt) {
      updateData.postedAt = new Date(data.postedAt);
      // 週キーも更新
      const { weekKey } = getWeekBoundaryForDate(new Date(data.postedAt));
      updateData.week = weekKey;
    }
    if (data.postType !== undefined) updateData.postType = data.postType;
    if (data.url !== undefined) {
      updateData.url = data.url && data.url.trim() !== '' ? data.url : null;
    }
    if (data.theme !== undefined) {
      updateData.theme = data.theme && data.theme.trim() !== '' ? data.theme : null;
    }
    if (data.followerDelta !== undefined) updateData.followerDelta = data.followerDelta ?? null;
    if (data.views !== undefined) updateData.views = data.views ?? null;
    if (data.likes !== undefined) updateData.likes = data.likes ?? null;
    if (data.note !== undefined) {
      updateData.note = data.note && data.note.trim() !== '' ? data.note : null;
    }

    const post = await prisma.sNSPost.update({
      where: { id },
      data: updateData,
      include: { user: true },
    });

    res.json(post);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update SNS post error:', error);
    res.status(500).json({ error: 'Failed to update SNS post' });
  }
});

/**
 * DELETE /api/sns-posts/:id
 * SNS投稿を削除
 */
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const post = await prisma.sNSPost.findUnique({
      where: { id: req.params.id },
    });

    if (!post) {
      return res.status(404).json({ error: 'SNS投稿が見つかりません' });
    }

    // 自分の投稿のみ削除可能（MEMBERの場合）
    if (req.user!.role === 'MEMBER' && post.userId !== req.user!.id) {
      return res.status(403).json({ error: '権限がありません' });
    }

    await prisma.sNSPost.delete({
      where: { id: req.params.id },
    });

    res.json({ message: '削除しました' });
  } catch (error) {
    console.error('Delete SNS post error:', error);
    res.status(500).json({ error: 'SNS投稿の削除に失敗しました' });
  }
});

// 未投稿者一覧（後方互換性のため残す）
router.get('/unpublished', async (req, res) => {
  try {
    const { week } = req.query;

    if (!week) {
      return res.status(400).json({ error: 'Week parameter is required' });
    }

    const allMembers = await prisma.user.findMany({
      where: { role: 'MEMBER' },
      select: { id: true, name: true, avatarColor: true },
    });

    const posts = await prisma.sNSPost.findMany({
      where: { week: week as string, isPosted: true },
      select: { userId: true },
    });

    const postedUserIds = new Set(posts.map((p) => p.userId));
    const unpublishedUsers = allMembers.filter((u) => !postedUserIds.has(u.id));

    res.json(unpublishedUsers);
  } catch (error) {
    console.error('Get unpublished users error:', error);
    res.status(500).json({ error: 'Failed to get unpublished users' });
  }
});

export default router;
