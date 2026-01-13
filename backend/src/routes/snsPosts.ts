import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const snsPostSchema = z.object({
  week: z.string(),
  postDate: z.string().optional(),
  postType: z.enum(['STORY', 'FEED', 'BOTH']).optional(),
  isPosted: z.boolean().default(false),
});

// SNS投稿一覧取得
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { userId, week } = req.query;
    const where: any = {};

    if (userId) {
      where.userId = userId;
    } else if (req.user!.role === 'MEMBER') {
      where.userId = req.user!.id;
    }

    if (week) where.week = week;

    const posts = await prisma.sNSPost.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { week: 'desc' },
    });

    res.json(posts);
  } catch (error) {
    console.error('Get SNS posts error:', error);
    res.status(500).json({ error: 'Failed to get SNS posts' });
  }
});

// SNS投稿作成/更新
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = snsPostSchema.parse(req.body);

    const post = await prisma.sNSPost.upsert({
      where: {
        userId_week: {
          userId: req.user!.id,
          week: data.week,
        },
      },
      update: {
        postDate: data.postDate ? new Date(data.postDate) : null,
        postType: data.postType,
        isPosted: data.isPosted,
      },
      create: {
        userId: req.user!.id,
        week: data.week,
        postDate: data.postDate ? new Date(data.postDate) : null,
        postType: data.postType,
        isPosted: data.isPosted,
      },
      include: { user: true },
    });

    res.json(post);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create/update SNS post error:', error);
    res.status(500).json({ error: 'Failed to create/update SNS post' });
  }
});

// SNS投稿削除
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

// 未投稿者一覧
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
