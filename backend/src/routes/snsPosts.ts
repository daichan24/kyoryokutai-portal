import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { PostType } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getCurrentWeekBoundary, getWeekBoundaryForDate, jstWallToUtcDate } from '../utils/weekBoundary';

const router = Router();
router.use(authenticate);

function parsePostedAtInput(raw: string): Date {
  const t = raw.trim();
  if (t.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const y = parseInt(t.slice(0, 4), 10);
    const mo = parseInt(t.slice(5, 7), 10);
    const d = parseInt(t.slice(8, 10), 10);
    return jstWallToUtcDate(y, mo, d, 12, 0, 0);
  }
  return new Date(t);
}

const followerCountField = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (v === '') return undefined;
    const n = typeof v === 'string' ? parseInt(String(v).replace(/,/g, ''), 10) : Number(v);
    if (!Number.isFinite(n) || Number.isNaN(n)) return undefined;
    const t = Math.trunc(n);
    if (t < 0 || t > 99_999_999) return undefined;
    return t;
  });

// 新スキーマ（日付＋種別中心。テーマ・フォロワー等は廃止）
const snsPostCreateSchema = z.object({
  postedAt: z.string(), // ISO 日時または YYYY-MM-DD（日付のみは JST 正午として週境界と整合）
  postType: z.enum(['STORY', 'FEED']),
  url: z.string().optional().refine((val) => !val || val === '' || z.string().url().safeParse(val).success, {
    message: 'Invalid URL format',
  }),
  note: z.string().max(2000).optional(),
  followerCount: followerCountField,
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
      const pa: Record<string, unknown> = { not: null };
      if (from) pa.gte = new Date(from as string);
      if (to) {
        const toDate = new Date(to as string);
        toDate.setHours(23, 59, 59, 999);
        pa.lte = toDate;
      }
      where.postedAt = pa;
    } else if (week) {
      where.week = week;
    }

    const posts = await prisma.sNSPost.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { postedAt: 'desc' },
    });

    // 暫定回避: week が数値形式の場合、文字列に変換して返す
    const normalizedPosts = posts.map(post => {
      if (post.week && /^[0-9]+$/.test(post.week)) {
        // 数値のみの week を "YYYY-WWW" 形式に変換（暫定）
        const year = new Date().getFullYear();
        const weekNum = parseInt(post.week, 10);
        return {
          ...post,
          week: `${year}-W${weekNum.toString().padStart(2, '0')}`,
        };
      }
      return post;
    });

    res.json(normalizedPosts);
  } catch (error: any) {
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
 * 
 * 注意: このエンドポイントは /:id より前に定義する必要がある（ルーティング順序）
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
  } catch (error: any) {
    console.error('Get weekly status error:', error);
    res.status(500).json({ error: 'Failed to get weekly status' });
  }
});

/**
 * POST /api/sns-posts
 * SNS投稿を作成（詳細入力対応）
 * 同じ週・同じ種別が既にある場合はupdateする
 * PostgreSQL の INSERT ... ON CONFLICT DO UPDATE を使用（DB制約に依存しない）
 */
router.post('/', async (req: AuthRequest, res) => {
  try {
    console.log('[API] POST /api/sns-posts body:', JSON.stringify(req.body));

    const data = snsPostCreateSchema.parse(req.body);
    const postedAt = parsePostedAtInput(data.postedAt);
    const { weekKey } = getWeekBoundaryForDate(postedAt);
    const userId = req.user!.id;

    console.log('[API] weekKey:', weekKey, 'postType:', data.postType, 'userId:', userId);

    // findFirst で既存を確認してから update/create（シンプルで確実）
    const existing = await prisma.sNSPost.findFirst({
      where: { userId, week: weekKey, postType: data.postType },
    });

    let post;
    if (existing) {
      console.log('[API] Found existing post, updating id:', existing.id);
      post = await prisma.sNSPost.update({
        where: { id: existing.id },
        data: {
          postedAt,
          url: data.url !== undefined ? (data.url?.trim() || null) : undefined,
          note: data.note !== undefined ? (data.note?.trim() || null) : undefined,
          followerCount: data.followerCount !== undefined
            ? (data.followerCount === null ? null : data.followerCount)
            : undefined,
        },
        include: { user: true },
      });
    } else {
      console.log('[API] No existing post, creating new:', data.postType);
      try {
        post = await prisma.sNSPost.create({
          data: {
            userId,
            week: weekKey,
            postedAt,
            postType: data.postType,
            url: data.url?.trim() || null,
            note: data.note?.trim() || null,
            followerCount: data.followerCount ?? null,
          },
          include: { user: true },
        });
      } catch (createError: any) {
        // P2002: create失敗時は再度findFirstして更新（競合状態対策）
        if (createError?.code === 'P2002') {
          console.log('[API] P2002 on create, retrying findFirst+update. meta:', JSON.stringify(createError?.meta));
          const retryExisting = await prisma.sNSPost.findFirst({
            where: { userId, week: weekKey, postType: data.postType },
          });
          if (retryExisting) {
            post = await prisma.sNSPost.update({
              where: { id: retryExisting.id },
              data: {
                postedAt,
                url: data.url?.trim() || null,
                note: data.note?.trim() || null,
                followerCount: data.followerCount ?? null,
              },
              include: { user: true },
            });
          } else {
            // 同じweekKeyで別postTypeが存在する場合（古いuserId+week制約）
            // 既存の全レコードを確認してログ出力
            const allForWeek = await prisma.sNSPost.findMany({
              where: { userId, week: weekKey },
              select: { id: true, postType: true, week: true },
            });
            console.error('[API] P2002 but no matching record found. All records for week:', JSON.stringify(allForWeek));
            console.error('[API] constraint meta:', JSON.stringify(createError?.meta));
            throw createError;
          }
        } else {
          throw createError;
        }
      }
    }

    console.log('[API] SNS post saved:', post.id, post.postType);
    return res.json(post);

  } catch (error: any) {
    if (error instanceof z.ZodError) {
      console.error('[API] Validation error:', error.errors);
      return res.status(400).json({ error: 'Validation failed', details: error.errors });
    }
    console.error('[API] SNS post error:', {
      name: error?.name,
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
    });
    res.status(500).json({
      error: 'Failed to create SNS post',
      details: error?.message,
      code: error?.code,
      meta: error?.meta,
    });
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
      const pd = parsePostedAtInput(data.postedAt);
      updateData.postedAt = pd;
      const { weekKey } = getWeekBoundaryForDate(pd);
      updateData.week = weekKey;
    }
    if (data.postType !== undefined) updateData.postType = data.postType;
    if (data.url !== undefined) {
      updateData.url = data.url && data.url.trim() !== '' ? data.url : null;
    }
    if (data.note !== undefined) {
      updateData.note = data.note && data.note.trim() !== '' ? data.note : null;
    }
    if (data.followerCount !== undefined) {
      updateData.followerCount =
        data.followerCount === null || data.followerCount === undefined ? null : data.followerCount;
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
