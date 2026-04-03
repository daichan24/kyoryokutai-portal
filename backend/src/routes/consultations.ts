import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const createSchema = z.object({
  audience: z.enum(['ANY', 'SUPPORT_ONLY', 'GOVERNMENT_ONLY', 'SPECIFIC_USER']),
  targetUserId: z.string().uuid().optional().nullable(),
  targetUserIds: z.array(z.string().uuid()).optional(),
  subject: z.string().max(400).optional().nullable(),
  body: z.string().min(1).max(20000),
});

function canSeeInbox(userRole: string) {
  return userRole === 'MASTER' || userRole === 'SUPPORT' || userRole === 'GOVERNMENT';
}

/** この相談をスタッフが受け取りボックスに出すか */
function consultationMatchesStaff(c: any, staffId: string, staffRole: string) {
  if (c.audience === 'SPECIFIC_USER') {
    const isAssigned = c.assignedUsers?.some((u: any) => u.id === staffId);
    return isAssigned || c.targetUserId === staffId || staffRole === 'MASTER';
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
    let targetUserIds: string[] = [];

    if (data.audience === 'SPECIFIC_USER') {
      if (data.targetUserIds && data.targetUserIds.length > 0) {
        targetUserIds = data.targetUserIds;
      } else if (data.targetUserId) {
        targetUserIds = [data.targetUserId];
      }

      if (targetUserIds.length === 0) {
        return res.status(400).json({ error: '特定の相手を選ぶ場合は宛先が必要です' });
      }

      const targets = await prisma.user.findMany({
        where: { id: { in: targetUserIds } },
        select: { id: true, role: true },
      });

      if (targets.some((t) => t.role !== 'SUPPORT' && t.role !== 'GOVERNMENT' && t.role !== 'MASTER')) {
        return res.status(400).json({ error: '相手はサポートまたは行政のユーザーを選んでください' });
      }
    } else if (data.targetUserId || (data.targetUserIds && data.targetUserIds.length > 0)) {
      return res.status(400).json({ error: '誰でも・サポート宛・行政宛のときは特定ユーザーは指定できません' });
    }

    if (data.audience === 'SPECIFIC_USER' && targetUserIds.length > 0) {
      const row = await prisma.consultation.create({
        data: {
          memberId: req.user!.id,
          audience: data.audience,
          subject: data.subject?.trim() || null,
          body: data.body.trim(),
          assignedUsers: {
            connect: targetUserIds.map((id) => ({ id })),
          },
        },
        include: {
          member: { select: { id: true, name: true, avatarColor: true } },
          assignedUsers: { select: { id: true, name: true, role: true, avatarColor: true } },
        },
      });
      return res.status(201).json(row);
    } else {
      // ANYやSUPPORT_ONLY等の単一レコード
      const row = await prisma.consultation.create({
        data: {
          memberId: req.user!.id,
          audience: data.audience,
          targetUserId: null,
          subject: data.subject?.trim() || null,
          body: data.body.trim(),
        },
        include: {
          member: { select: { id: true, name: true, avatarColor: true } },
          targetUser: { select: { id: true, name: true, role: true, avatarColor: true } },
        },
      });
      return res.status(201).json(row);
    }
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
        assignedUsers: { select: { id: true, name: true, role: true } },
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

// 詳細取得（コメント含む）
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const isStaff = canSeeInbox(req.user!.role);

    const row = await prisma.consultation.findUnique({
      where: { id },
      include: {
        member: { select: { id: true, name: true, avatarColor: true } },
        targetUser: { select: { id: true, name: true, role: true, avatarColor: true } },
        assignedUsers: { select: { id: true, name: true, role: true, avatarColor: true } },
        resolvedBy: { select: { id: true, name: true } },
        comments: {
          where: isStaff ? {} : { isInternal: false },
          include: {
            author: { select: { id: true, name: true, role: true, avatarColor: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!row) return res.status(404).json({ error: '見つかりません' });

    // アクセス権チェック
    const isOwner = row.memberId === req.user!.id;
    const isMatchStaff = isStaff && consultationMatchesStaff(row, req.user!.id, req.user!.role);

    if (!isOwner && !isMatchStaff) {
      return res.status(403).json({ error: '閲覧権限がありません' });
    }

    res.json(row);
  } catch (e) {
    console.error('consultation detail:', e);
    res.status(500).json({ error: '取得に失敗しました' });
  }
});

const commentSchema = z.object({
  body: z.string().min(1).max(10000),
  isInternal: z.boolean().optional().default(false),
});

// コメント投稿
router.post('/:id/comments', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { body, isInternal } = commentSchema.parse(req.body);
    const isStaff = canSeeInbox(req.user!.role);

    const consultation = await prisma.consultation.findUnique({
      where: { id },
    });

    if (!consultation) return res.status(404).json({ error: '見つかりません' });

    // 権限チェック
    const isOwner = consultation.memberId === req.user!.id;
    const isMatchStaff = isStaff && consultationMatchesStaff(consultation, req.user!.id, req.user!.role);

    if (!isOwner && !isMatchStaff) {
      return res.status(403).json({ error: '投稿権限がありません' });
    }

    if (isInternal && !isStaff) {
      return res.status(403).json({ error: '内部コメントはスタッフのみ投稿可能です' });
    }

    const comment = await prisma.consultationComment.create({
      data: {
        consultationId: id,
        authorId: req.user!.id,
        body: body.trim(),
        isInternal: isInternal || false,
      },
      include: {
        author: { select: { id: true, name: true, role: true, avatarColor: true } },
      },
    });

    res.status(201).json(comment);
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
    console.error('consultation comment create:', e);
    res.status(500).json({ error: 'コメントの投稿に失敗しました' });
  }
});

export default router;
