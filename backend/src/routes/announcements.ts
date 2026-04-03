import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// --- カテゴリ ---

router.get('/categories', async (_req: AuthRequest, res) => {
  try {
    const rows = await prisma.announcementCategory.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    res.json(rows);
  } catch (e) {
    console.error('announcement categories list:', e);
    res.status(500).json({ error: '取得に失敗しました' });
  }
});

const categorySchema = z.object({
  name: z.string().min(1).max(100),
  sortOrder: z.number().int().optional(),
  colorHex: z.string().max(20).optional().nullable(),
});

router.post('/categories', authorize('MASTER', 'SUPPORT', 'GOVERNMENT'), async (req: AuthRequest, res) => {
  try {
    const data = categorySchema.parse(req.body);
    const row = await prisma.announcementCategory.create({
      data: {
        name: data.name.trim(),
        sortOrder: data.sortOrder ?? 0,
        colorHex: data.colorHex?.trim() || null,
      },
    });
    res.status(201).json(row);
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
    console.error('announcement category create:', e);
    res.status(500).json({ error: '作成に失敗しました' });
  }
});

router.patch('/categories/:id', authorize('MASTER', 'SUPPORT', 'GOVERNMENT'), async (req: AuthRequest, res) => {
  try {
    const data = categorySchema.partial().parse(req.body);
    const row = await prisma.announcementCategory.update({
      where: { id: req.params.id },
      data: {
        ...(data.name != null ? { name: data.name.trim() } : {}),
        ...(data.sortOrder != null ? { sortOrder: data.sortOrder } : {}),
        ...(data.colorHex !== undefined ? { colorHex: data.colorHex?.trim() || null } : {}),
      },
    });
    res.json(row);
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
    console.error('announcement category patch:', e);
    res.status(500).json({ error: '更新に失敗しました' });
  }
});

router.delete('/categories/:id', authorize('MASTER', 'SUPPORT', 'GOVERNMENT'), async (req: AuthRequest, res) => {
  try {
    const n = await prisma.announcement.count({ where: { categoryId: req.params.id } });
    if (n > 0) {
      return res.status(400).json({ error: 'このカテゴリに紐づくお知らせがあるため削除できません' });
    }
    await prisma.announcementCategory.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    console.error('announcement category delete:', e);
    res.status(500).json({ error: '削除に失敗しました' });
  }
});

// --- 未読件数（メンバーのみ） ---

router.get('/unread-count', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;

    // 自分が確認対象のお知らせを取得
    const allAnnouncements = await prisma.announcement.findMany({
      select: { id: true, confirmTarget: true, authorId: true },
    });

    // 自分が確認対象かどうか判定
    const targetIds = allAnnouncements
      .filter((a) => {
        // 自分が投稿したものは確認不要
        if (a.authorId === userId) return false;
        // confirmTarget=MEMBERの場合はメンバーのみ
        if (a.confirmTarget === 'MEMBER' && role !== 'MEMBER') return false;
        return true;
      })
      .map((a) => a.id);

    if (targetIds.length === 0) return res.json({ count: 0 });

    const reads = await prisma.announcementRead.findMany({
      where: { userId, announcementId: { in: targetIds } },
      select: { announcementId: true },
    });
    const readSet = new Set(reads.map((r) => r.announcementId));
    const count = targetIds.filter((id) => !readSet.has(id)).length;
    res.json({ count });
  } catch (e) {
    console.error('announcement unread-count:', e);
    res.status(500).json({ error: '取得に失敗しました' });
  }
});

// --- 一覧 ---

router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;

    const list = await prisma.announcement.findMany({
      include: {
        category: true,
        author: { select: { id: true, name: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: 300,
    });

    if (role === 'MEMBER') {
      const readRows = await prisma.announcementRead.findMany({
        where: { userId },
        select: { announcementId: true },
      });
      const readSet = new Set(readRows.map((r) => r.announcementId));
      const withFlag = list.map((a) => ({
        id: a.id,
        categoryId: a.categoryId,
        title: a.title,
        body: a.body,
        publishedAt: a.publishedAt.toISOString(),
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        category: a.category,
        author: a.author,
        confirmTarget: a.confirmTarget,
        isRead: readSet.has(a.id),
      }));
      withFlag.sort((a, b) => {
        if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
        return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
      });
      return res.json(withFlag);
    }

    // スタッフ・全員: 自分の確認状況も返す
    const readRows = await prisma.announcementRead.findMany({
      where: { userId },
      select: { announcementId: true },
    });
    const myReadSet = new Set(readRows.map((r) => r.announcementId));

    const readCounts = await prisma.announcementRead.groupBy({
      by: ['announcementId'],
      _count: { id: true },
    });
    const countMap = Object.fromEntries(readCounts.map((x) => [x.announcementId, x._count.id]));

    const memberCount = await prisma.user.count({ where: { role: 'MEMBER' } });
    const totalCount = await prisma.user.count();

    const withCounts = list.map((a) => ({
      id: a.id,
      categoryId: a.categoryId,
      title: a.title,
      body: a.body,
      publishedAt: a.publishedAt.toISOString(),
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
      category: a.category,
      author: a.author,
      confirmTarget: a.confirmTarget,
      isRead: myReadSet.has(a.id),
      readCount: countMap[a.id] ?? 0,
      memberCount: a.confirmTarget === 'MEMBER' ? memberCount : totalCount,
    }));

    res.json(withCounts);
  } catch (e) {
    console.error('announcements list:', e);
    res.status(500).json({ error: '取得に失敗しました' });
  }
});

const announcementSchema = z.object({
  categoryId: z.string().uuid(),
  title: z.string().min(1).max(400),
  body: z.string().min(1).max(50000),
  confirmTarget: z.enum(['ALL', 'MEMBER']).optional().default('ALL'),
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = announcementSchema.parse(req.body);
    const cat = await prisma.announcementCategory.findUnique({ where: { id: data.categoryId } });
    if (!cat) {
      return res.status(400).json({ error: 'カテゴリが見つかりません' });
    }
    const row = await prisma.announcement.create({
      data: {
        categoryId: data.categoryId,
        title: data.title.trim(),
        body: data.body.trim(),
        authorId: req.user!.id,
        confirmTarget: data.confirmTarget,
      },
      include: {
        category: true,
        author: { select: { id: true, name: true } },
      },
    });
    res.status(201).json(row);
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
    console.error('announcement create:', e);
    res.status(500).json({ error: '作成に失敗しました' });
  }
});

router.post('/:id/read', async (req: AuthRequest, res) => {
  try {
    const announcementId = req.params.id;
    const exists = await prisma.announcement.findUnique({ where: { id: announcementId }, select: { id: true, confirmTarget: true } });
    if (!exists) return res.status(404).json({ error: '見つかりません' });

    // confirmTargetがMEMBERの場合はメンバーのみ確認可能
    if (exists.confirmTarget === 'MEMBER' && req.user!.role !== 'MEMBER') {
      return res.status(403).json({ error: 'この確認はメンバーのみ対象です' });
    }

    await prisma.announcementRead.upsert({
      where: {
        announcementId_userId: { announcementId, userId: req.user!.id },
      },
      create: { announcementId, userId: req.user!.id },
      update: {},
    });

    res.json({ ok: true });
  } catch (e) {
    console.error('announcement read:', e);
    res.status(500).json({ error: '更新に失敗しました' });
  }
});

router.patch('/:id', authorize('MASTER', 'SUPPORT', 'GOVERNMENT'), async (req: AuthRequest, res) => {
  try {
    const data = announcementSchema.partial().parse(req.body);
    if (data.categoryId) {
      const cat = await prisma.announcementCategory.findUnique({ where: { id: data.categoryId } });
      if (!cat) return res.status(400).json({ error: 'カテゴリが見つかりません' });
    }
    const row = await prisma.announcement.update({
      where: { id: req.params.id },
      data: {
        ...(data.categoryId ? { categoryId: data.categoryId } : {}),
        ...(data.title != null ? { title: data.title.trim() } : {}),
        ...(data.body != null ? { body: data.body.trim() } : {}),
      },
      include: {
        category: true,
        author: { select: { id: true, name: true } },
      },
    });
    res.json(row);
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
    console.error('announcement patch:', e);
    res.status(500).json({ error: '更新に失敗しました' });
  }
});

router.delete('/:id', authorize('MASTER', 'SUPPORT', 'GOVERNMENT'), async (req: AuthRequest, res) => {
  try {
    await prisma.announcement.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    console.error('announcement delete:', e);
    res.status(500).json({ error: '削除に失敗しました' });
  }
});

export default router;
