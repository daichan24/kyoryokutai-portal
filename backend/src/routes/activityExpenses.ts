import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { getActivityExpenseSummary } from '../services/activityExpenseService';

const router = Router();
router.use(authenticate);

function isStaff(role: string) {
  return role === 'MASTER' || role === 'SUPPORT' || role === 'GOVERNMENT';
}

async function assertTargetIsMember(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });
  if (!u || u.role !== 'MEMBER') {
    const err = new Error('MEMBER_NOT_FOUND') as Error & { status: number };
    err.status = 404;
    throw err;
  }
  return u;
}

/** メンバーは自分のみ。スタッフは任意の隊員。 */
function resolveTargetUserId(req: AuthRequest, queryUserId: string | undefined): string {
  if (req.user!.role === 'MEMBER') {
    return req.user!.id;
  }
  if (!queryUserId || typeof queryUserId !== 'string') {
    const err = new Error('USER_ID_REQUIRED') as Error & { status: number };
    err.status = 400;
    throw err;
  }
  return queryUserId;
}

const budgetPutSchema = z.object({
  userId: z.string().uuid(),
  allocatedAmount: z.number().int().min(0).max(200_000_000),
  memo: z.string().max(2000).optional().nullable(),
});

const entryCreateSchema = z.object({
  userId: z.string().uuid().optional(),
  spentAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1).max(500),
  amount: z.number().int().min(1).max(50_000_000),
});

const entryUpdateSchema = z.object({
  spentAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  description: z.string().min(1).max(500).optional(),
  amount: z.number().int().min(1).max(50_000_000).optional(),
});

// サマリー（予算・一覧・合計・残り）
router.get('/summary', async (req: AuthRequest, res) => {
  try {
    const targetId = resolveTargetUserId(req, req.query.userId as string | undefined);
    await assertTargetIsMember(targetId);
    const summary = await getActivityExpenseSummary(targetId, 500);
    res.json(summary);
  } catch (e: unknown) {
    const err = e as Error & { status?: number };
    if (err.message === 'USER_ID_REQUIRED') {
      return res.status(400).json({ error: '隊員を userId で指定してください' });
    }
    if (err.message === 'MEMBER_NOT_FOUND') {
      return res.status(404).json({ error: '隊員が見つかりません' });
    }
    console.error('activity-expenses summary:', e);
    res.status(500).json({ error: '取得に失敗しました' });
  }
});

// 予算（上限）設定 — スタッフのみ
router.put('/budget', async (req: AuthRequest, res) => {
  try {
    if (!isStaff(req.user!.role)) {
      return res.status(403).json({ error: '予算の設定は行政・サポート・マスターのみです' });
    }
    const data = budgetPutSchema.parse(req.body);
    await assertTargetIsMember(data.userId);

    const row = await prisma.activityExpenseBudget.upsert({
      where: { userId: data.userId },
      create: {
        userId: data.userId,
        allocatedAmount: data.allocatedAmount,
        memo: data.memo?.trim() || null,
        updatedById: req.user!.id,
      },
      update: {
        allocatedAmount: data.allocatedAmount,
        memo: data.memo?.trim() || null,
        updatedById: req.user!.id,
      },
      include: {
        updatedBy: { select: { id: true, name: true } },
      },
    });

    const summary = await getActivityExpenseSummary(data.userId, 500);
    res.json({ budget: row, summary });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors });
    }
    console.error('activity-expenses budget:', e);
    res.status(500).json({ error: '保存に失敗しました' });
  }
});

async function loadEntryWithAccess(entryId: string, req: AuthRequest) {
  const entry = await prisma.activityExpenseEntry.findUnique({
    where: { id: entryId },
    select: { id: true, userId: true },
  });
  if (!entry) {
    const err = new Error('NOT_FOUND') as Error & { status: number };
    err.status = 404;
    throw err;
  }
  if (req.user!.role === 'MEMBER' && entry.userId !== req.user!.id) {
    const err = new Error('FORBIDDEN') as Error & { status: number };
    err.status = 403;
    throw err;
  }
  return entry;
}

router.post('/entries', async (req: AuthRequest, res) => {
  try {
    const data = entryCreateSchema.parse(req.body);
    let targetUserId = data.userId;
    if (req.user!.role === 'MEMBER') {
      targetUserId = req.user!.id;
    } else if (!targetUserId) {
      return res.status(400).json({ error: '隊員の userId を指定してください' });
    }
    await assertTargetIsMember(targetUserId);

    const spentAt = new Date(`${data.spentAt}T12:00:00.000Z`);
    const row = await prisma.activityExpenseEntry.create({
      data: {
        userId: targetUserId,
        spentAt,
        description: data.description.trim(),
        amount: data.amount,
        createdById: req.user!.id,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    const summary = await getActivityExpenseSummary(targetUserId, 500);
    res.status(201).json({ entry: row, summary });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors });
    }
    console.error('activity-expenses create entry:', e);
    res.status(500).json({ error: '登録に失敗しました' });
  }
});

router.put('/entries/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await loadEntryWithAccess(id, req);
    const data = entryUpdateSchema.parse(req.body);
    if (!data.spentAt && !data.description && data.amount === undefined) {
      return res.status(400).json({ error: '更新内容がありません' });
    }

    const update: {
      spentAt?: Date;
      description?: string;
      amount?: number;
      updatedById: string;
    } = { updatedById: req.user!.id };
    if (data.spentAt) update.spentAt = new Date(`${data.spentAt}T12:00:00.000Z`);
    if (data.description !== undefined) update.description = data.description.trim();
    if (data.amount !== undefined) update.amount = data.amount;

    const row = await prisma.activityExpenseEntry.update({
      where: { id },
      data: update,
    });

    const summary = await getActivityExpenseSummary(row.userId, 500);
    res.json({ entry: row, summary });
  } catch (e: unknown) {
    const err = e as Error & { status?: number };
    if (err.message === 'NOT_FOUND') return res.status(404).json({ error: '見つかりません' });
    if (err.message === 'FORBIDDEN') return res.status(403).json({ error: '権限がありません' });
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
    console.error('activity-expenses update entry:', e);
    res.status(500).json({ error: '更新に失敗しました' });
  }
});

router.delete('/entries/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const entry = await loadEntryWithAccess(id, req);
    const userId = entry.userId;
    await prisma.activityExpenseEntry.delete({ where: { id } });
    const summary = await getActivityExpenseSummary(userId, 500);
    res.json({ ok: true, summary });
  } catch (e: unknown) {
    const err = e as Error & { status?: number };
    if (err.message === 'NOT_FOUND') return res.status(404).json({ error: '見つかりません' });
    if (err.message === 'FORBIDDEN') return res.status(403).json({ error: '権限がありません' });
    console.error('activity-expenses delete entry:', e);
    res.status(500).json({ error: '削除に失敗しました' });
  }
});

export default router;
