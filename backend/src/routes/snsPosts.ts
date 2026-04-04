import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { PostType } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getCurrentWeekBoundary, getWeekBoundaryForDate, jstWallToUtcDate } from '../utils/weekBoundary';
import { followerCountField, snsPostCreateSchema, snsPostUpdateSchema, parsePostedAtInput } from '../utils/snsValidation';

const router = Router();
router.use(authenticate);

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
 * SNS投稿を作成（upsert: 同じuserId+week+postType+accountIdなら更新）
 *
 * Upsertロジック:
 * 1. userId+week+postType+accountIdで既存レコードを検索
 * 2. 存在する場合はIDベースで更新（最も確実）
 * 3. 存在しない場合は新規作成
 * 4. P2002（unique制約違反）発生時は再検索して更新（競合状態への対応）
 */
router.post('/', async (req: AuthRequest, res) => {
  try {
    console.log('[API] POST /api/sns-posts body:', JSON.stringify(req.body));

    const data = snsPostCreateSchema.parse(req.body);
    const postedAt = parsePostedAtInput(data.postedAt);
    const { weekKey } = getWeekBoundaryForDate(postedAt);
    const userId = req.user!.id;
    const postType = data.postType;
    const accountId = data.accountId || null;
    const url = data.url?.trim() || null;
    const note = data.note?.trim() || null;
    const followerCount = data.followerCount ?? null;

    console.log('[API] weekKey:', weekKey, 'postType:', postType, 'userId:', userId, 'accountId:', accountId);

    // 既存レコードをIDで検索（accountIdも含めて検索）
    const existing = await prisma.sNSPost.findFirst({
      where: { userId, week: weekKey, postType, accountId },
    });

    let post;
    if (existing) {
      // IDベースで更新（最も確実）
      console.log('[API] Updating id:', existing.id);
      post = await prisma.sNSPost.update({
        where: { id: existing.id },
        data: { postedAt, url, note, ...(followerCount !== null ? { followerCount } : {}) },
        include: { user: true },
      });
    } else {
      // 新規作成。P2002が発生した場合は再検索してupdate
      try {
        console.log('[API] Creating new post:', postType);
        post = await prisma.sNSPost.create({
          data: { userId, week: weekKey, postedAt, postType, accountId, url, note, followerCount },
          include: { user: true },
        });
      } catch (createErr: any) {
        if (createErr?.code === 'P2002') {
          // 競合: 再検索してupdate
          console.log('[API] P2002 on create, constraint:', JSON.stringify(createErr?.meta), '- retrying update');
          const retry = await prisma.sNSPost.findFirst({
            where: { userId, week: weekKey, postType },
          });
          if (retry) {
            post = await prisma.sNSPost.update({
              where: { id: retry.id },
              data: { postedAt, url, note, ...(followerCount !== null ? { followerCount } : {}) },
              include: { user: true },
            });
          } else {
            // userId+weekのみのunique制約に引っかかっている場合
            // 同じweekの全レコードを確認
            const allForWeek = await prisma.sNSPost.findMany({
              where: { userId, week: weekKey },
              select: { id: true, postType: true, accountId: true },
            });
            console.error('[API] P2002 but no matching postType found. allForWeek:', JSON.stringify(allForWeek));
            console.error('[API] This means DB has userId+week unique constraint (without postType)');
            // 古い制約を削除して再試行
            try {
              await prisma.$executeRawUnsafe(`
                DO $fix$ DECLARE r RECORD;
                BEGIN
                  FOR r IN SELECT indexname FROM pg_indexes 
                    WHERE tablename='SNSPost' AND indexdef LIKE '%userId%week%' 
                    AND indexdef NOT LIKE '%postType%' AND indexname != 'SNSPost_userId_week_idx'
                  LOOP
                    EXECUTE 'DROP INDEX IF EXISTS "' || r.indexname || '"';
                    RAISE NOTICE 'Dropped: %', r.indexname;
                  END LOOP;
                END $fix$;
              `);
              post = await prisma.sNSPost.create({
                data: { userId, week: weekKey, postedAt, postType, url, note, followerCount },
                include: { user: true },
              });
            } catch (fixErr: any) {
              console.error('[API] Fix attempt failed:', fixErr?.message);
              throw createErr;
            }
          }
        } else {
          throw createErr;
        }
      }
    }

    console.log('[API] SNS post saved:', post.id, post.postType);
    return res.json(post);

  } catch (error: any) {
    if (error instanceof z.ZodError) {
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
