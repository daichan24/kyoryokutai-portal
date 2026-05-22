import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);
router.use(authorize('MASTER', 'SUPPORT', 'GOVERNMENT'));

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);

const saveSchema = z.object({
  memberId: z.string().min(1),
  month: monthSchema,
  memo: z.string().max(10000).optional().nullable(),
  snsNote: z.string().max(2000).optional().nullable(),
  snsChecked: z.boolean().optional(),
  snsSnapshot: z.unknown().optional().nullable(),
});

async function assertMember(memberId: string) {
  const member = await prisma.user.findUnique({
    where: { id: memberId },
    select: { id: true, name: true, role: true },
  });
  if (!member || member.role !== 'MEMBER') {
    const error = new Error('隊員が見つかりません');
    (error as any).statusCode = 404;
    throw error;
  }
  return member;
}

function monthBounds(month: string) {
  const [year, monthText] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, monthText - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthText, 0, 23, 59, 59, 999));
  return { start, end };
}

async function getSnsSnapshot(memberId: string, month: string) {
  const { start, end } = monthBounds(month);
  const accounts = await prisma.sNSAccount.findMany({
    where: { userId: memberId },
    include: {
      posts: {
        where: { followerCount: { not: null } },
        orderBy: { postedAt: 'desc' },
        take: 1,
        select: { id: true, postedAt: true, followerCount: true, postType: true },
      },
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });

  const monthPosts = await prisma.sNSPost.findMany({
    where: {
      userId: memberId,
      postedAt: { gte: start, lte: end },
    },
    select: {
      id: true,
      accountId: true,
      postType: true,
      postedAt: true,
      followerCount: true,
    },
    orderBy: { postedAt: 'desc' },
  });

  return accounts.map((account) => {
    const accountPosts = monthPosts.filter((post) => post.accountId === account.id);
    return {
      id: account.id,
      platform: account.platform,
      accountName: account.accountName,
      displayName: account.displayName,
      url: account.url,
      isDefault: account.isDefault,
      latestFollowerCount: account.posts[0]?.followerCount ?? null,
      latestFollowerAt: account.posts[0]?.postedAt ?? null,
      monthPostCount: accountPosts.length,
      monthFollowerCount: accountPosts.find((post) => post.followerCount != null)?.followerCount ?? null,
      hasStoryThisMonth: accountPosts.some((post) => post.postType === 'STORY'),
      hasFeedThisMonth: accountPosts.some((post) => post.postType === 'FEED'),
    };
  });
}

router.get('/', async (req: AuthRequest, res) => {
  try {
    const memberId = typeof req.query.memberId === 'string' ? req.query.memberId : '';
    const month = typeof req.query.month === 'string' ? req.query.month : '';
    monthSchema.parse(month);
    await assertMember(memberId);

    const [note, snsAccounts] = await Promise.all([
      prisma.interviewNote.findUnique({
        where: { memberId_month: { memberId, month } },
        include: { updatedBy: { select: { id: true, name: true } } },
      }),
      getSnsSnapshot(memberId, month),
    ]);

    res.json({ note, snsAccounts });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(error.statusCode || 500).json({ error: error.message || '面談メモの取得に失敗しました' });
  }
});

router.put('/', async (req: AuthRequest, res) => {
  try {
    const data = saveSchema.parse(req.body);
    await assertMember(data.memberId);
    const snsSnapshot = data.snsSnapshot === undefined ? undefined : data.snsSnapshot;
    const note = await prisma.interviewNote.upsert({
      where: { memberId_month: { memberId: data.memberId, month: data.month } },
      create: {
        memberId: data.memberId,
        month: data.month,
        memo: data.memo?.trim() || null,
        snsNote: data.snsNote?.trim() || null,
        snsCheckedAt: data.snsChecked ? new Date() : null,
        snsSnapshot: snsSnapshot as any,
        updatedById: req.user!.id,
      },
      update: {
        memo: data.memo?.trim() || null,
        snsNote: data.snsNote?.trim() || null,
        ...(data.snsChecked !== undefined ? { snsCheckedAt: data.snsChecked ? new Date() : null } : {}),
        ...(snsSnapshot !== undefined ? { snsSnapshot: snsSnapshot as any } : {}),
        updatedById: req.user!.id,
      },
      include: { updatedBy: { select: { id: true, name: true } } },
    });
    res.json(note);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(error.statusCode || 500).json({ error: error.message || '面談メモの保存に失敗しました' });
  }
});

export default router;
