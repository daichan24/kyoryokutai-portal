import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  audience: z.enum(['ANY', 'SUPPORT_ONLY', 'GOVERNMENT_ONLY', 'SPECIFIC_USER']),
  targetUserId: z.string().uuid().optional().nullable(),
  subject: z.string().max(400).optional().nullable(),
  body: z.string().min(1).max(20000),
});

function canSeeInbox(userRole: string) {
  return userRole === 'MASTER' || userRole === 'SUPPORT' || userRole === 'GOVERNMENT';
}

/** この相談をスタッフが受け取りボックスに出すか */
function consultationMatchesStaff(c: { audience: string; targetUserId: string | null }, staffId: string, staffRole: string) {
  if (c.audience === 'SPECIFIC_USER') {
    return c.targetUserId === staffId || staffRole === 'MASTER';
  }
  if (c.audience === 'SUPPORT_ONLY') {
    return staffRole === 'MASTER' || staffRole === 'SUPPORT';
  }
  if (c.audience === 'GOVERNMENT_ONLY') {
    return staffRole === 'MASTER' || staffRole === 'GOVERNMENT';
  }
  // ANY
  return staffRole === 'MASTER' || staffRole === 'SUPPORT' || staffRole === 'GOVERNMENT';
}

// メンバー: 相談を送る
router.post('/', authorize('MEMBER'), async (req: AuthRequest, res) => {
  try {
    const data = createSchema.parse(req.body);
    if (data.audience === 'SPECIFIC_USER') {
      if (!data.targetUserId) {
        return res.status(400).json({ error: '特定の相手を選ぶ場合は targetUserId が必要です' });
      }
      const target = await prisma.user.findUnique({
        where: { id: data.targetUserId },
        select: { id: true, role: true },
      });
      if (!target || (target.role !== 'SUPPORT' && target.role !== 'GOVERNMENT')) {
        return res.status(400).json({ error: '相手はサポートまたは行政のユーザーを選んでください' });
      }
    } else if (data.targetUserId) {
      return res.status(400).json({ error: '誰でも・サポート宛・行政宛のときは特定ユーザーは指定できません' });
    }

    const row = await prisma.consultation.create({
      data: {
        memberId: req.user!.id,
        audience: data.audience,
        targetUserId: data.audience === 'SPECIFIC_USER' ? data.targetUserId : null,
        subject: data.subject?.trim() || null,
        body: data.body.trim(),
      },
      include: {
        member: { select: { id: true, name: true, avatarColor: true } },
        targetUser: { select: { id: true, name: true, role: true, avatarColor: true } },
      },
    });

    res.status(201).json(row);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors });
    }
    console.error('consultation create:', e);
    res.status(500).json({ error: '相談の送信に失敗しました' });
  }
});

// メンバー: 自分の相談一覧
router.get('/mine', authorize('MEMBER'), async (req: AuthRequest, res) => {
  try {
    const list = await prisma.consultation.findMany({
      where: { memberId: req.user!.id },
      include: {
        targetUser: { select: { id: true, name: true, role: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(list);
  } catch (e) {
    console.error('consultation mine:', e);
    res.status(500).json({ error: '取得に失敗しました' });
  }
});

// サポート・行政・マスター: 受信箱（自分が対応できる相談）
router.get('/inbox', async (req: AuthRequest, res) => {
  try {
    if (!canSeeInbox(req.user!.role)) {
      return res.status(403).json({ error: '権限がありません' });
    }
    const status = typeof req.query.status === 'string' ? req.query.status : 'OPEN';
    const whereStatus = status === 'ALL' ? {} : { status: status as 'OPEN' | 'RESOLVED' };

    const all = await prisma.consultation.findMany({
      where: whereStatus,
      include: {
        member: { select: { id: true, name: true, avatarColor: true } },
        targetUser: { select: { id: true, name: true, role: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    const filtered = all.filter((c) => consultationMatchesStaff(c, req.user!.id, req.user!.role));
    res.json(filtered);
  } catch (e) {
    console.error('consultation inbox:', e);
    res.status(500).json({ error: '取得に失敗しました' });
  }
});

const resolveSchema = z.object({
  resolutionNote: z.string().min(1).max(10000),
});

// 対応済みにする
router.patch('/:id/resolve', async (req: AuthRequest, res) => {
  try {
    if (!canSeeInbox(req.user!.role)) {
      return res.status(403).json({ error: '権限がありません' });
    }
    const { id } = req.params;
    const { resolutionNote } = resolveSchema.parse(req.body);

    const existing = await prisma.consultation.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: '見つかりません' });
    }
    if (!consultationMatchesStaff(existing, req.user!.id, req.user!.role)) {
      return res.status(403).json({ error: 'この相談に対応する権限がありません' });
    }
    if (existing.status === 'RESOLVED') {
      return res.status(400).json({ error: 'すでに対応済みです' });
    }

    const updated = await prisma.consultation.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedById: req.user!.id,
        resolutionNote: resolutionNote.trim(),
      },
      include: {
        member: { select: { id: true, name: true, avatarColor: true } },
        targetUser: { select: { id: true, name: true, role: true } },
        resolvedBy: { select: { id: true, name: true } },
      },
    });

    res.json(updated);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors });
    }
    console.error('consultation resolve:', e);
    res.status(500).json({ error: '更新に失敗しました' });
  }
});

export default router;
