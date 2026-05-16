import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

function isStaff(role: string) {
  return role === 'MASTER' || role === 'SUPPORT' || role === 'GOVERNMENT';
}

function resolveTargetUserId(req: AuthRequest, queryUserId?: string): string {
  if (req.user!.role === 'MEMBER') return req.user!.id;
  if (!queryUserId) throw Object.assign(new Error('USER_ID_REQUIRED'), { status: 400 });
  return queryUserId;
}

/** 年度から有効期限（3月31日）を計算 */
function fiscalYearExpiry(fiscalYear: number): Date {
  return new Date(`${fiscalYear + 1}-03-31T12:00:00.000Z`);
}

/** 現在の年度を取得（4月始まり） */
function currentFiscalYear(): number {
  const now = new Date();
  const month = now.getMonth() + 1;
  return month >= 4 ? now.getFullYear() : now.getFullYear() - 1;
}

function fiscalYearStart(fiscalYear: number): Date {
  return new Date(`${fiscalYear}-04-01T00:00:00.000Z`);
}

function fiscalYearEnd(fiscalYear: number): Date {
  return new Date(`${fiscalYear + 1}-03-31T23:59:59.999Z`);
}

function dateOnly(date: string): Date {
  return new Date(`${date}T12:00:00.000Z`);
}

function dateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function hoursBetween(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.max(0, (eh * 60 + em - (sh * 60 + sm)) / 60);
}

function dayOffTitle(type: 'PAID' | 'UNPAID' | 'COMPENSATORY' | 'TIME_ADJUST', amount: number) {
  if (type === 'PAID') return `有給（${amount}日）`;
  if (type === 'UNPAID') return `無休（${amount}日）`;
  if (type === 'COMPENSATORY') return `代休（${amount}日）`;
  return `時間調整（${amount}時間）`;
}

async function upsertDayOffSchedule(args: {
  scheduleId?: string | null;
  userId: string;
  usedAt: Date;
  dayOffType: 'PAID' | 'UNPAID' | 'COMPENSATORY' | 'TIME_ADJUST';
  amount: number;
  startTime?: string;
  endTime?: string;
  note?: string | null;
}) {
  const startTime = args.startTime ?? '09:00';
  const endTime = args.endTime ?? (args.amount <= 0.5 ? '12:00' : '17:00');
  const data = {
    userId: args.userId,
    date: args.usedAt,
    startDate: args.usedAt,
    endDate: args.usedAt,
    startTime,
    endTime,
    locationText: '休暇・調整',
    title: dayOffTitle(args.dayOffType, args.amount),
    activityDescription: args.note?.trim() || dayOffTitle(args.dayOffType, args.amount),
    freeNote: args.note?.trim() || null,
    isDayOff: true,
    dayOffType: args.dayOffType,
    isHolidayWork: false,
    compensatoryLeaveRequired: false,
    compensatoryLeaveType: null,
  };

  if (args.scheduleId) {
    const existing = await prisma.schedule.findUnique({ where: { id: args.scheduleId }, select: { id: true } });
    if (existing) {
      return prisma.schedule.update({ where: { id: args.scheduleId }, data });
    }
  }
  return prisma.schedule.create({ data });
}

async function deleteLinkedSchedule(scheduleId?: string | null) {
  if (!scheduleId) return;
  await prisma.schedule.delete({ where: { id: scheduleId } }).catch(() => undefined);
}

async function remainingPaidDays(userId: string, fiscalYear: number) {
  const allocation = await prisma.paidLeaveAllocation.findUnique({
    where: { userId_fiscalYear: { userId, fiscalYear } },
  });
  const used = await prisma.paidLeaveEntry.aggregate({
    where: { userId, usedAt: { gte: fiscalYearStart(fiscalYear), lte: fiscalYearEnd(fiscalYear) } },
    _sum: { days: true },
  });
  return {
    allocation,
    usedDays: used._sum.days ?? 0,
    remainingDays: (allocation?.totalDays ?? 0) - (used._sum.days ?? 0),
  };
}

// ============================================================
// サマリー
// ============================================================
router.get('/summary', async (req: AuthRequest, res) => {
  try {
    const targetId = resolveTargetUserId(req, req.query.userId as string | undefined);
    const fiscalYear = currentFiscalYear();
    const today = new Date();
    today.setHours(12, 0, 0, 0);

    const [allocation, paidEntries, unpaidEntries, compensatoryLeaves, timeAdjustments] =
      await Promise.all([
        prisma.paidLeaveAllocation.findUnique({ where: { userId_fiscalYear: { userId: targetId, fiscalYear } }, include: { updatedBy: { select: { id: true, name: true } } } }),
        prisma.paidLeaveEntry.findMany({
          where: { userId: targetId, usedAt: { gte: fiscalYearStart(fiscalYear), lte: fiscalYearEnd(fiscalYear) } },
          include: { schedule: { select: { id: true } } },
          orderBy: { usedAt: 'desc' },
        }),
        prisma.unpaidLeaveEntry.findMany({
          where: { userId: targetId, usedAt: { gte: fiscalYearStart(fiscalYear), lte: fiscalYearEnd(fiscalYear) } },
          include: { schedule: { select: { id: true } } },
          orderBy: { usedAt: 'desc' },
        }),
        prisma.compensatoryLeave.findMany({
          where: { userId: targetId },
          include: {
            schedule: { select: { id: true, title: true, activityDescription: true, startDate: true, startTime: true, endTime: true } },
            usages: { include: { schedule: { select: { id: true } } } },
            timeAdjustments: true,
            confirmedBy: { select: { id: true, name: true } },
          },
          orderBy: { grantedAt: 'asc' },
        }),
        prisma.timeAdjustment.findMany({
          where: { userId: targetId },
          include: {
            compensatoryLeave: { select: { id: true, grantedAt: true, expiresAt: true } },
            sourceSchedule: { select: { id: true, title: true, activityDescription: true, startDate: true } },
            confirmedBy: { select: { id: true, name: true } },
          },
          orderBy: { adjustedAt: 'desc' },
        }),
      ]);

    const paidUsed = paidEntries.reduce((s, e) => s + e.days, 0);
    const paidTotal = allocation?.totalDays ?? 0;
    const paidRemaining = paidTotal - paidUsed;
    const paidExpiry = allocation?.expiresAt ?? fiscalYearExpiry(fiscalYear);
    const paidDaysUntilExpiry = Math.ceil((new Date(paidExpiry).getTime() - today.getTime()) / 86400000);

    const unpaidTotal = unpaidEntries.reduce((s, e) => s + e.days, 0);

    // 代休：期限切れ自動更新
    const updatedLeaves = await Promise.all(
      compensatoryLeaves.map(async (cl) => {
        const exp = new Date(cl.expiresAt);
        exp.setHours(12, 0, 0, 0);
        const usedDays = cl.usages.reduce((s, u) => s + u.days, 0);
        if (cl.status === 'PENDING' && exp < today && usedDays < 1) {
          await prisma.compensatoryLeave.update({ where: { id: cl.id }, data: { status: 'EXPIRED' } });
          return { ...cl, status: 'EXPIRED' as const };
        }
        return cl;
      }),
    );

    const activeLeaves = updatedLeaves.filter((cl) => cl.status === 'PENDING' && cl.leaveType === 'FULL_DAY');
    const compTotalDays = activeLeaves.reduce((s, cl) => {
      const usedDays = cl.usages.reduce((u, x) => u + x.days, 0);
      return s + Math.max(0, 1 - usedDays);
    }, 0);

    const compWithDeadline = activeLeaves.map((cl) => {
      const exp = new Date(cl.expiresAt);
      exp.setHours(12, 0, 0, 0);
      const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
      const usedDays = cl.usages.reduce((u, x) => u + x.days, 0);
      return { ...cl, daysLeft, remainingDays: Math.max(0, 1 - usedDays) };
    }).sort((a, b) => a.daysLeft - b.daysLeft);

    const usableTimeAdjustments = timeAdjustments.filter((t) => {
      if (!t.compensatoryLeave) return true;
      const exp = new Date(t.compensatoryLeave.expiresAt);
      exp.setHours(23, 59, 59, 999);
      return exp >= today;
    });
    const timeAdjTotal = timeAdjustments.reduce((s, t) => s + t.hours, 0);
    const timeAdjUsed = timeAdjustments.filter(t => t.usedAt).reduce((s, t) => {
      if (!t.usedStartTime || !t.usedEndTime) return s;
      return s + hoursBetween(t.usedStartTime, t.usedEndTime);
    }, 0);
    const timeAdjRemaining = usableTimeAdjustments.filter(t => !t.usedAt).reduce((s, t) => s + t.hours, 0);

    res.json({
      fiscalYear,
      paid: {
        totalDays: paidTotal,
        usedDays: paidUsed,
        remainingDays: paidRemaining,
        expiresAt: paidExpiry,
        daysUntilExpiry: paidDaysUntilExpiry,
        memo: allocation?.memo ?? null,
        updatedBy: allocation?.updatedBy ?? null,
        updatedAt: allocation?.updatedAt ?? null,
        entries: paidEntries,
      },
      unpaid: {
        totalUsedDays: unpaidTotal,
        entries: unpaidEntries,
      },
      compensatory: {
        totalAvailableDays: compTotalDays,
        activeLeaves: compWithDeadline,
        allLeaves: updatedLeaves,
      },
      timeAdjustment: {
        totalGrantedHours: timeAdjTotal,
        totalUsedHours: timeAdjUsed,
        remainingHours: timeAdjRemaining,
        entries: timeAdjustments,
      },
    });
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// ============================================================
// 有給設定（スタッフのみ）
// ============================================================
const allocationSchema = z.object({
  userId: z.string().uuid(),
  fiscalYear: z.number().int().min(2020).max(2100).optional(),
  totalDays: z.number().min(0).max(365),
  memo: z.string().max(2000).optional().nullable(),
});

router.put('/paid-leave/allocation', async (req: AuthRequest, res) => {
  if (!isStaff(req.user!.role)) return res.status(403).json({ error: '権限がありません' });
  try {
    const body = allocationSchema.parse(req.body);
    const fiscalYear = body.fiscalYear ?? currentFiscalYear();
    const expiresAt = fiscalYearExpiry(fiscalYear);
    const result = await prisma.paidLeaveAllocation.upsert({
      where: { userId_fiscalYear: { userId: body.userId, fiscalYear } },
      create: { userId: body.userId, fiscalYear, totalDays: body.totalDays, expiresAt, memo: body.memo ?? null, updatedById: req.user!.id },
      update: { totalDays: body.totalDays, expiresAt, memo: body.memo ?? null, updatedById: req.user!.id },
    });
    res.json(result);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 有給使用記録
// ============================================================
const paidEntrySchema = z.object({
  userId: z.string().uuid().optional(),
  usedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.number().min(0.5).max(30),
  note: z.string().max(500).optional().nullable(),
});

router.post('/paid-leave/entries', async (req: AuthRequest, res) => {
  if (!isStaff(req.user!.role)) return res.status(403).json({ error: '権限がありません' });
  try {
    const body = paidEntrySchema.parse(req.body);
    const targetId = body.userId ?? req.user!.id;
    const usedAt = dateOnly(body.usedAt);
    const fiscalYear = new Date(body.usedAt).getMonth() + 1 >= 4
      ? new Date(body.usedAt).getFullYear()
      : new Date(body.usedAt).getFullYear() - 1;
    const paid = await remainingPaidDays(targetId, fiscalYear);
    if (!paid.allocation) return res.status(400).json({ error: 'この年度の有給付与日数が設定されていません' });
    if (usedAt > paid.allocation.expiresAt) return res.status(400).json({ error: '有効期限を過ぎた有給は記録できません' });
    if (paid.remainingDays < body.days) return res.status(400).json({ error: `有給残日数が不足しています（残 ${paid.remainingDays} 日）` });
    const schedule = await upsertDayOffSchedule({
      userId: targetId,
      usedAt,
      dayOffType: 'PAID',
      amount: body.days,
      note: body.note ?? null,
    });
    const entry = await prisma.paidLeaveEntry.create({
      data: { userId: targetId, usedAt, days: body.days, note: body.note ?? null, scheduleId: schedule.id, createdById: req.user!.id },
    });
    res.json(entry);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/paid-leave/entries/:id', async (req: AuthRequest, res) => {
  if (!isStaff(req.user!.role)) return res.status(403).json({ error: '権限がありません' });
  try {
    const entry = await prisma.paidLeaveEntry.findUnique({ where: { id: req.params.id } });
    await prisma.paidLeaveEntry.delete({ where: { id: req.params.id } });
    await deleteLinkedSchedule(entry?.scheduleId);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 無休使用記録（メンバーも追加可）
// ============================================================
const unpaidEntrySchema = z.object({
  userId: z.string().uuid().optional(),
  usedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.number().min(0.5).max(30),
  note: z.string().max(500).optional().nullable(),
});

router.post('/unpaid-leave/entries', async (req: AuthRequest, res) => {
  try {
    const body = unpaidEntrySchema.parse(req.body);
    const targetId = req.user!.role === 'MEMBER' ? req.user!.id : (body.userId ?? req.user!.id);
    const usedAt = dateOnly(body.usedAt);
    const schedule = await upsertDayOffSchedule({
      userId: targetId,
      usedAt,
      dayOffType: 'UNPAID',
      amount: body.days,
      note: body.note ?? null,
    });
    const entry = await prisma.unpaidLeaveEntry.create({
      data: { userId: targetId, usedAt, days: body.days, note: body.note ?? null, scheduleId: schedule.id, createdById: req.user!.id },
    });
    res.json(entry);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/unpaid-leave/entries/:id', async (req: AuthRequest, res) => {
  try {
    const entry = await prisma.unpaidLeaveEntry.findUnique({ where: { id: req.params.id } });
    if (!entry) return res.status(404).json({ error: '見つかりません' });
    if (req.user!.role === 'MEMBER' && entry.userId !== req.user!.id) return res.status(403).json({ error: '権限がありません' });
    await prisma.unpaidLeaveEntry.delete({ where: { id: req.params.id } });
    await deleteLinkedSchedule(entry.scheduleId);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 代休
// ============================================================
const compLeaveSchema = z.object({
  userId: z.string().uuid().optional(),
  grantedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  scheduleId: z.string().uuid().optional().nullable(),
  totalHours: z.number().min(0).max(24).optional().nullable(),
  leaveType: z.enum(['FULL_DAY', 'TIME_ADJUST']).optional(),
  note: z.string().max(500).optional().nullable(),
});

router.get('/compensatory', async (req: AuthRequest, res) => {
  try {
    const targetId = resolveTargetUserId(req, req.query.userId as string | undefined);
    const leaves = await prisma.compensatoryLeave.findMany({
      where: { userId: targetId },
      include: {
        schedule: { select: { id: true, title: true, activityDescription: true, startDate: true, startTime: true, endTime: true } },
        usages: { include: { createdBy: { select: { id: true, name: true } } } },
        timeAdjustments: { include: { confirmedBy: { select: { id: true, name: true } } } },
        confirmedBy: { select: { id: true, name: true } },
      },
      orderBy: { grantedAt: 'desc' },
    });
    res.json(leaves);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/compensatory', async (req: AuthRequest, res) => {
  try {
    const body = compLeaveSchema.parse(req.body);
    const targetId = req.user!.role === 'MEMBER' ? req.user!.id : (body.userId ?? req.user!.id);
    const grantedDate = new Date(`${body.grantedAt}T12:00:00.000Z`);
    const expiresAt = new Date(grantedDate.getTime() + 56 * 86400000); // 8週間
    const leave = await prisma.compensatoryLeave.create({
      data: {
        userId: targetId,
        grantedAt: grantedDate,
        expiresAt,
        scheduleId: body.scheduleId ?? null,
        totalHours: body.totalHours ?? null,
        leaveType: body.leaveType ?? 'FULL_DAY',
        note: body.note ?? null,
      },
      include: {
        schedule: { select: { id: true, title: true, activityDescription: true, startDate: true } },
        usages: true,
        confirmedBy: { select: { id: true, name: true } },
      },
    });
    res.json(leave);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

router.put('/compensatory/:id', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.compensatoryLeave.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: '見つかりません' });
    if (req.user!.role === 'MEMBER' && existing.userId !== req.user!.id) return res.status(403).json({ error: '権限がありません' });
    const body = compLeaveSchema.partial().parse(req.body);
    const updateData: any = {};
    if (body.grantedAt) {
      const grantedDate = new Date(`${body.grantedAt}T12:00:00.000Z`);
      updateData.grantedAt = grantedDate;
      updateData.expiresAt = new Date(grantedDate.getTime() + 56 * 86400000);
    }
    if (body.totalHours !== undefined) updateData.totalHours = body.totalHours;
    if (body.note !== undefined) updateData.note = body.note;
    if (body.leaveType) updateData.leaveType = body.leaveType;
    const updated = await prisma.compensatoryLeave.update({ where: { id: req.params.id }, data: updateData });
    res.json(updated);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/compensatory/:id', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.compensatoryLeave.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: '見つかりません' });
    if (req.user!.role === 'MEMBER' && existing.userId !== req.user!.id) return res.status(403).json({ error: '権限がありません' });
    await prisma.compensatoryLeave.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 代休確認ボタン（スタッフのみ）
router.post('/compensatory/:id/confirm', async (req: AuthRequest, res) => {
  if (!isStaff(req.user!.role)) return res.status(403).json({ error: '権限がありません' });
  try {
    const updated = await prisma.compensatoryLeave.update({
      where: { id: req.params.id },
      data: { confirmedById: req.user!.id, confirmedAt: new Date() },
      include: { confirmedBy: { select: { id: true, name: true } } },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 代休使用記録
const compUsageSchema = z.object({
  usedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.number().min(0.5).max(1),
  note: z.string().max(500).optional().nullable(),
});

router.post('/compensatory/:id/usage', async (req: AuthRequest, res) => {
  try {
    const leave = await prisma.compensatoryLeave.findUnique({ where: { id: req.params.id }, include: { usages: true } });
    if (!leave) return res.status(404).json({ error: '見つかりません' });
    if (req.user!.role === 'MEMBER' && leave.userId !== req.user!.id) return res.status(403).json({ error: '権限がありません' });
    const body = compUsageSchema.parse(req.body);
    const usedAt = dateOnly(body.usedAt);
    const exp = new Date(leave.expiresAt);
    exp.setHours(23, 59, 59, 999);
    if (usedAt > exp) return res.status(400).json({ error: '期限を過ぎた代休は使用できません' });
    if (leave.status === 'USED') return res.status(400).json({ error: 'すでに使用済みです' });
    if (leave.status === 'EXPIRED') return res.status(400).json({ error: '期限切れの代休です' });
    const usedSoFar = leave.usages.reduce((s, u) => s + u.days, 0);
    if (usedSoFar + body.days > 1) return res.status(400).json({ error: '使用日数が1日を超えます' });
    const schedule = await upsertDayOffSchedule({
      userId: leave.userId,
      usedAt,
      dayOffType: 'COMPENSATORY',
      amount: body.days,
      note: body.note ?? null,
    });
    const usage = await prisma.compensatoryLeaveUsage.create({
      data: { compensatoryLeaveId: req.params.id, usedAt, days: body.days, note: body.note ?? null, scheduleId: schedule.id, createdById: req.user!.id },
    });
    const newTotal = usedSoFar + body.days;
    if (newTotal >= 1) {
      await prisma.compensatoryLeave.update({ where: { id: req.params.id }, data: { status: 'USED' } });
    }
    res.json(usage);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/compensatory/usage/:usageId', async (req: AuthRequest, res) => {
  try {
    const usage = await prisma.compensatoryLeaveUsage.findUnique({ where: { id: req.params.usageId }, include: { compensatoryLeave: true } });
    if (!usage) return res.status(404).json({ error: '見つかりません' });
    if (req.user!.role === 'MEMBER' && usage.compensatoryLeave.userId !== req.user!.id) return res.status(403).json({ error: '権限がありません' });
    await prisma.compensatoryLeaveUsage.delete({ where: { id: req.params.usageId } });
    await deleteLinkedSchedule(usage.scheduleId);
    // 使用済みステータスを戻す
    const remaining = await prisma.compensatoryLeaveUsage.findMany({ where: { compensatoryLeaveId: usage.compensatoryLeaveId } });
    const total = remaining.reduce((s, u) => s + u.days, 0);
    if (total < 1) {
      await prisma.compensatoryLeave.update({ where: { id: usage.compensatoryLeaveId }, data: { status: 'PENDING' } });
    }
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// 時間調整
// ============================================================
const timeAdjSchema = z.object({
  userId: z.string().uuid().optional(),
  compensatoryLeaveId: z.string().uuid().optional().nullable(),
  adjustedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hours: z.number().min(0.5).max(24),
  sourceScheduleId: z.string().uuid().optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  // 使用記録
  usedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  usedStartTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  usedEndTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  usedScheduleId: z.string().uuid().optional().nullable(),
});

router.get('/time-adjustments', async (req: AuthRequest, res) => {
  try {
    const targetId = resolveTargetUserId(req, req.query.userId as string | undefined);
    const entries = await prisma.timeAdjustment.findMany({
      where: { userId: targetId },
      include: {
        compensatoryLeave: { select: { id: true, grantedAt: true, expiresAt: true } },
        sourceSchedule: { select: { id: true, title: true, activityDescription: true, startDate: true } },
        confirmedBy: { select: { id: true, name: true } },
      },
      orderBy: { adjustedAt: 'desc' },
    });
    res.json(entries);
  } catch (err: any) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post('/time-adjustments', async (req: AuthRequest, res) => {
  try {
    const body = timeAdjSchema.parse(req.body);
    const targetId = req.user!.role === 'MEMBER' ? req.user!.id : (body.userId ?? req.user!.id);
    const usedHours = body.usedAt && body.usedStartTime && body.usedEndTime
      ? hoursBetween(body.usedStartTime, body.usedEndTime)
      : 0;
    if ((body.usedAt || body.usedStartTime || body.usedEndTime) && (!body.usedAt || !body.usedStartTime || !body.usedEndTime)) {
      return res.status(400).json({ error: '時間調整の使用日は開始・終了時刻も指定してください' });
    }
    if (usedHours > body.hours) {
      return res.status(400).json({ error: '使用時間が付与時間を超えています' });
    }
    const usedSchedule = body.usedAt && body.usedStartTime && body.usedEndTime
      ? await upsertDayOffSchedule({
          userId: targetId,
          usedAt: dateOnly(body.usedAt),
          dayOffType: 'TIME_ADJUST',
          amount: usedHours,
          startTime: body.usedStartTime,
          endTime: body.usedEndTime,
          note: body.note ?? null,
        })
      : null;
    const entry = await prisma.timeAdjustment.create({
      data: {
        userId: targetId,
        compensatoryLeaveId: body.compensatoryLeaveId ?? null,
        adjustedAt: dateOnly(body.adjustedAt),
        hours: body.hours,
        sourceScheduleId: body.sourceScheduleId ?? null,
        note: body.note ?? null,
        usedAt: body.usedAt ? dateOnly(body.usedAt) : null,
        usedStartTime: body.usedStartTime ?? null,
        usedEndTime: body.usedEndTime ?? null,
        usedScheduleId: body.usedScheduleId ?? usedSchedule?.id ?? null,
      },
      include: {
        compensatoryLeave: { select: { id: true, grantedAt: true } },
        sourceSchedule: { select: { id: true, title: true, activityDescription: true, startDate: true } },
        confirmedBy: { select: { id: true, name: true } },
      },
    });
    res.json(entry);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

router.put('/time-adjustments/:id', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.timeAdjustment.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: '見つかりません' });
    if (req.user!.role === 'MEMBER' && existing.userId !== req.user!.id) return res.status(403).json({ error: '権限がありません' });
    const body = timeAdjSchema.partial().parse(req.body);
    const updateData: any = {};
    if (body.adjustedAt) updateData.adjustedAt = new Date(`${body.adjustedAt}T12:00:00.000Z`);
    if (body.hours !== undefined) updateData.hours = body.hours;
    if (body.note !== undefined) updateData.note = body.note;
    if (body.compensatoryLeaveId !== undefined) updateData.compensatoryLeaveId = body.compensatoryLeaveId;
    const isClearingUsage = body.usedAt === null || body.usedStartTime === null || body.usedEndTime === null;
    const nextUsedAt = body.usedAt !== undefined ? body.usedAt : existing.usedAt ? dateInput(existing.usedAt) : null;
    const nextStart = body.usedStartTime !== undefined ? body.usedStartTime : existing.usedStartTime;
    const nextEnd = body.usedEndTime !== undefined ? body.usedEndTime : existing.usedEndTime;
    const nextHours = body.hours !== undefined ? body.hours : existing.hours;
    if (isClearingUsage) {
      await deleteLinkedSchedule(existing.usedScheduleId);
      updateData.usedScheduleId = null;
    } else if ((nextUsedAt || nextStart || nextEnd) && (!nextUsedAt || !nextStart || !nextEnd)) {
      return res.status(400).json({ error: '時間調整の使用日は開始・終了時刻も指定してください' });
    } else if (nextUsedAt && nextStart && nextEnd) {
      const usedHours = hoursBetween(nextStart, nextEnd);
      if (usedHours > nextHours) return res.status(400).json({ error: '使用時間が付与時間を超えています' });
      const usedSchedule = await upsertDayOffSchedule({
        scheduleId: existing.usedScheduleId,
        userId: existing.userId,
        usedAt: dateOnly(nextUsedAt),
        dayOffType: 'TIME_ADJUST',
        amount: usedHours,
        startTime: nextStart,
        endTime: nextEnd,
        note: body.note !== undefined ? body.note ?? null : existing.note,
      });
      updateData.usedScheduleId = usedSchedule.id;
    }
    if (body.usedAt !== undefined) updateData.usedAt = body.usedAt ? dateOnly(body.usedAt) : null;
    if (body.usedStartTime !== undefined) updateData.usedStartTime = body.usedStartTime;
    if (body.usedEndTime !== undefined) updateData.usedEndTime = body.usedEndTime;
    if (body.usedScheduleId !== undefined) updateData.usedScheduleId = body.usedScheduleId;
    const updated = await prisma.timeAdjustment.update({ where: { id: req.params.id }, data: updateData });
    res.json(updated);
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

router.delete('/time-adjustments/:id', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.timeAdjustment.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: '見つかりません' });
    if (req.user!.role === 'MEMBER' && existing.userId !== req.user!.id) return res.status(403).json({ error: '権限がありません' });
    await prisma.timeAdjustment.delete({ where: { id: req.params.id } });
    await deleteLinkedSchedule(existing.usedScheduleId);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/time-adjustments/:id/confirm', async (req: AuthRequest, res) => {
  if (!isStaff(req.user!.role)) return res.status(403).json({ error: '権限がありません' });
  try {
    const updated = await prisma.timeAdjustment.update({
      where: { id: req.params.id },
      data: { confirmedById: req.user!.id, confirmedAt: new Date() },
      include: { confirmedBy: { select: { id: true, name: true } } },
    });
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// スケジュール保存時の自動代休/時間調整作成
// ============================================================

/** 拘束時間（分）から実勤務時間（分）を計算するルール
 * 5h30m以下 → そのまま
 * 6h00m → 5h00m（-1h）
 * 6h30m → 5h30m（-1h）
 * 6h以上 → 拘束 - 1h
 */
function calcWorkMinutes(constraintMinutes: number): number {
  if (constraintMinutes <= 330) return constraintMinutes; // 5h30m以下
  return constraintMinutes - 60; // 6h以上は1時間引く
}

const autoCreateSchema = z.object({
  scheduleId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  grantedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  leaveType: z.enum(['FULL_DAY', 'TIME_ADJUST']),
  note: z.string().max(500).optional().nullable(),
});

router.post('/compensatory/from-schedule', async (req: AuthRequest, res) => {
  try {
    const body = autoCreateSchema.parse(req.body);
    const targetId = req.user!.role === 'MEMBER' ? req.user!.id : (body.userId ?? req.user!.id);
    const grantedDate = new Date(`${body.grantedAt}T12:00:00.000Z`);
    const expiresAt = new Date(grantedDate.getTime() + 56 * 86400000);

    // 拘束時間を計算
    const [sh, sm] = body.startTime.split(':').map(Number);
    const [eh, em] = body.endTime.split(':').map(Number);
    const constraintMinutes = (eh * 60 + em) - (sh * 60 + sm);
    const workMinutes = calcWorkMinutes(constraintMinutes);
    const workHours = Math.round(workMinutes / 60 * 10) / 10; // 小数点1桁

    // 既存チェック（同じスケジュールIDで既に作成済みなら更新）
    const existing = await prisma.compensatoryLeave.findFirst({
      where: { scheduleId: body.scheduleId, userId: targetId },
    });

    let leave;
    if (existing) {
      leave = await prisma.compensatoryLeave.update({
        where: { id: existing.id },
        data: { grantedAt: grantedDate, expiresAt, totalHours: workHours, leaveType: body.leaveType, note: body.note ?? null },
        include: { schedule: { select: { id: true, title: true, activityDescription: true, startDate: true } }, usages: true, confirmedBy: { select: { id: true, name: true } } },
      });
    } else {
      leave = await prisma.compensatoryLeave.create({
        data: { userId: targetId, grantedAt: grantedDate, expiresAt, scheduleId: body.scheduleId, totalHours: workHours, leaveType: body.leaveType, note: body.note ?? null },
        include: { schedule: { select: { id: true, title: true, activityDescription: true, startDate: true } }, usages: true, confirmedBy: { select: { id: true, name: true } } },
      });
    }

    // TIME_ADJUSTの場合は時間調整レコードも作成
    if (body.leaveType === 'TIME_ADJUST') {
      const existingTA = await prisma.timeAdjustment.findFirst({
        where: { sourceScheduleId: body.scheduleId, userId: targetId },
      });
      if (existingTA) {
        await prisma.timeAdjustment.update({
          where: { id: existingTA.id },
          data: { compensatoryLeaveId: leave.id, adjustedAt: grantedDate, hours: workHours },
        });
      } else {
        await prisma.timeAdjustment.create({
          data: { userId: targetId, compensatoryLeaveId: leave.id, adjustedAt: grantedDate, hours: workHours, sourceScheduleId: body.scheduleId },
        });
      }
    }

    res.json({ leave, workHours, constraintMinutes, workMinutes });
  } catch (err: any) {
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    res.status(500).json({ error: err.message });
  }
});

export default router;
