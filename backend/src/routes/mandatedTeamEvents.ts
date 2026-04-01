import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

function isStaff(role: string) {
  return role === 'MASTER' || role === 'SUPPORT' || role === 'GOVERNMENT';
}

async function ensureAttendanceRows(eventId: string) {
  const [members, existing] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'MEMBER' },
      select: { id: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.mandatedTeamEventAttendance.findMany({
      where: { eventId },
      select: { userId: true },
    }),
  ]);
  const have = new Set(existing.map((e) => e.userId));
  const missing = members.filter((m) => !have.has(m.id));
  if (missing.length === 0) return;
  await prisma.mandatedTeamEventAttendance.createMany({
    data: missing.map((m) => ({ eventId, userId: m.id, attended: false })),
  });
}

function overlapsYear(start: Date, end: Date, year: number): boolean {
  const ys = new Date(year, 0, 1);
  const ye = new Date(year, 11, 31, 23, 59, 59, 999);
  return start <= ye && end >= ys;
}

/** 日本の年度: 4月1日〜翌年3月31日（年度の数字 = 開始年） */
function fiscalYearRange(fyStartYear: number): { start: Date; end: Date } {
  const start = new Date(fyStartYear, 3, 1);
  const end = new Date(fyStartYear + 1, 2, 31, 23, 59, 59, 999);
  return { start, end };
}

const HIDDEN_MATRIX_MEMBER_NAME = 'さとうだいち';

function filterMatrixMembers<T extends { name: string }>(members: T[]): T[] {
  return members.filter((m) => m.name !== HIDDEN_MATRIX_MEMBER_NAME);
}

const createSchema = z.object({
  title: z.string().min(1).max(400),
  description: z.string().max(10000).optional().nullable(),
  startDate: z.string(),
  endDate: z.string(),
  requiredSlots: z.number().int().min(1).max(999),
});

/** GET /api/mandated-team-events/summary/year?year=2026 */
router.get('/summary/year', async (req: AuthRequest, res) => {
  try {
    const year = parseInt(String(req.query.year || new Date().getFullYear()), 10);
    if (Number.isNaN(year)) return res.status(400).json({ error: 'year が不正です' });

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

    const events = await prisma.mandatedTeamEvent.findMany({
      where: {
        AND: [{ startDate: { lte: yearEnd } }, { endDate: { gte: yearStart } }],
      },
      include: {
        attendances: { select: { userId: true, attended: true } },
      },
      orderBy: [{ startDate: 'asc' }, { title: 'asc' }],
    });

    const membersRaw = await prisma.user.findMany({
      where: { role: 'MEMBER' },
      select: { id: true, name: true, displayOrder: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    const members = filterMatrixMembers(membersRaw);
    const visibleMemberIds = new Set(members.map((m) => m.id));

    const counts: Record<string, number> = {};
    for (const m of members) counts[m.id] = 0;

    for (const ev of events) {
      const sd = new Date(ev.startDate);
      const ed = new Date(ev.endDate);
      if (!overlapsYear(sd, ed, year)) continue;
      for (const a of ev.attendances) {
        if (a.attended && visibleMemberIds.has(a.userId)) {
          counts[a.userId] = (counts[a.userId] ?? 0) + 1;
        }
      }
    }

    const countList = members.map((m) => ({ userId: m.id, name: m.name, count: counts[m.id] ?? 0 }));
    const nums = countList.map((c) => c.count);
    const sum = nums.reduce((a, b) => a + b, 0);
    const avg = members.length ? sum / members.length : 0;
    const min = nums.length ? Math.min(...nums) : 0;
    const max = nums.length ? Math.max(...nums) : 0;

    res.json({
      year,
      members: countList,
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        startDate: e.startDate.toISOString().slice(0, 10),
        endDate: e.endDate.toISOString().slice(0, 10),
        requiredSlots: e.requiredSlots,
        attendedCount: e.attendances.filter((a) => a.attended && visibleMemberIds.has(a.userId)).length,
      })),
      stats: {
        avg: Math.round(avg * 10) / 10,
        min,
        max,
        spread: max - min,
      },
    });
  } catch (e) {
    console.error('mandated-team-events summary/year:', e);
    res.status(500).json({ error: '集計の取得に失敗しました' });
  }
});

/** GET /api/mandated-team-events/matrix?year=2026 — イベント×隊員の参加マトリクス */
router.get('/matrix', async (req: AuthRequest, res) => {
  try {
    const year = parseInt(String(req.query.year || new Date().getFullYear()), 10);
    if (Number.isNaN(year)) return res.status(400).json({ error: 'year が不正です' });

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

    const events = await prisma.mandatedTeamEvent.findMany({
      where: { AND: [{ startDate: { lte: yearEnd } }, { endDate: { gte: yearStart } }] },
      orderBy: [{ startDate: 'asc' }, { title: 'asc' }],
      select: {
        id: true,
        title: true,
        description: true,
        startDate: true,
        endDate: true,
        requiredSlots: true,
      },
    });

    const membersRaw = await prisma.user.findMany({
      where: { role: 'MEMBER' },
      select: { id: true, name: true, displayOrder: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    const members = filterMatrixMembers(membersRaw);
    const visibleIds = new Set(members.map((m) => m.id));

    const cells: Record<string, boolean> = {};
    for (const ev of events) {
      await ensureAttendanceRows(ev.id);
      const rows = await prisma.mandatedTeamEventAttendance.findMany({
        where: { eventId: ev.id },
        select: { userId: true, attended: true },
      });
      for (const r of rows) {
        if (!visibleIds.has(r.userId)) continue;
        cells[`${ev.id}:${r.userId}`] = r.attended;
      }
    }

    const { start: fyStart, end: fyEnd } = fiscalYearRange(year);
    const fyEvents = await prisma.mandatedTeamEvent.findMany({
      where: { AND: [{ startDate: { lte: fyEnd } }, { endDate: { gte: fyStart } }] },
      select: { id: true },
    });
    const fyEventIds = fyEvents.map((e) => e.id);
    for (const eid of fyEventIds) {
      await ensureAttendanceRows(eid);
    }
    const fyAttendances = await prisma.mandatedTeamEventAttendance.findMany({
      where: {
        attended: true,
        userId: { in: [...visibleIds] },
        eventId: { in: fyEventIds },
      },
      select: { userId: true },
    });
    const memberFiscalParticipationCounts: Record<string, number> = {};
    for (const m of members) memberFiscalParticipationCounts[m.id] = 0;
    for (const a of fyAttendances) {
      memberFiscalParticipationCounts[a.userId] = (memberFiscalParticipationCounts[a.userId] ?? 0) + 1;
    }

    res.json({
      year,
      fiscalYearLabel: year,
      members,
      events: events.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        startDate: e.startDate.toISOString().slice(0, 10),
        endDate: e.endDate.toISOString().slice(0, 10),
        requiredSlots: e.requiredSlots,
      })),
      cells,
      memberFiscalParticipationCounts,
    });
  } catch (e) {
    console.error('mandated-team-events matrix:', e);
    res.status(500).json({ error: 'マトリクスの取得に失敗しました' });
  }
});

const matrixSaveSchema = z.object({
  changes: z.array(
    z.object({
      eventId: z.string().uuid(),
      userId: z.string().uuid(),
      attended: z.boolean(),
    }),
  ),
});

/** POST /api/mandated-team-events/matrix/save — マトリクス一括保存（履歴付き） */
router.post('/matrix/save', async (req: AuthRequest, res) => {
  try {
    const { changes } = matrixSaveSchema.parse(req.body);
    const uid = req.user!.id;
    const role = req.user!.role;

    for (const ch of changes) {
      if (role === 'MEMBER' && ch.userId !== uid) {
        return res.status(403).json({ error: '他の隊員のチェックは変更できません' });
      }

      await ensureAttendanceRows(ch.eventId);

      const prev = await prisma.mandatedTeamEventAttendance.findUnique({
        where: { eventId_userId: { eventId: ch.eventId, userId: ch.userId } },
      });
      if (prev && prev.attended === ch.attended) continue;

      await prisma.$transaction([
        prisma.mandatedTeamEventAttendance.upsert({
          where: { eventId_userId: { eventId: ch.eventId, userId: ch.userId } },
          create: { eventId: ch.eventId, userId: ch.userId, attended: ch.attended },
          update: { attended: ch.attended },
        }),
        prisma.mandatedAttendanceAuditLog.create({
          data: {
            eventId: ch.eventId,
            userId: ch.userId,
            attended: ch.attended,
            changedById: uid,
          },
        }),
      ]);
    }

    res.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
    console.error('mandated-team-events matrix/save:', e);
    res.status(500).json({ error: '保存に失敗しました' });
  }
});

/** GET /api/mandated-team-events?year=2026 */
router.get('/', async (req: AuthRequest, res) => {
  try {
    const yearQ = req.query.year;
    const year = yearQ ? parseInt(String(yearQ), 10) : null;
    const yearStart = year != null && !Number.isNaN(year) ? new Date(year, 0, 1) : null;
    const yearEnd = year != null && !Number.isNaN(year) ? new Date(year, 11, 31, 23, 59, 59, 999) : null;

    const where =
      yearStart && yearEnd
        ? { AND: [{ startDate: { lte: yearEnd } }, { endDate: { gte: yearStart } }] }
        : {};

    const rows = await prisma.mandatedTeamEvent.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true } },
        attendances: true,
      },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });

    const matrixVisibleMembers = filterMatrixMembers(
      await prisma.user.findMany({ where: { role: 'MEMBER' }, select: { id: true, name: true } }),
    );
    const matrixVisibleIds = new Set(matrixVisibleMembers.map((m) => m.id));

    res.json(
      rows.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        startDate: e.startDate.toISOString().slice(0, 10),
        endDate: e.endDate.toISOString().slice(0, 10),
        requiredSlots: e.requiredSlots,
        createdById: e.createdById,
        creator: e.creator,
        attendedCount: e.attendances.filter((a) => a.attended && matrixVisibleIds.has(a.userId)).length,
        totalRows: e.attendances.length,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      })),
    );
  } catch (e) {
    console.error('mandated-team-events list:', e);
    res.status(500).json({ error: '一覧の取得に失敗しました' });
  }
});

/** GET /api/mandated-team-events/:id/detail */
router.get('/:id/detail', async (req: AuthRequest, res) => {
  try {
    const eventId = req.params.id;
    const ev = await prisma.mandatedTeamEvent.findUnique({
      where: { id: eventId },
      include: { creator: { select: { id: true, name: true } } },
    });
    if (!ev) return res.status(404).json({ error: '見つかりません' });

    await ensureAttendanceRows(eventId);

    const membersRaw = await prisma.user.findMany({
      where: { role: 'MEMBER' },
      select: { id: true, name: true, displayOrder: true, avatarColor: true, avatarLetter: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
    const members = filterMatrixMembers(membersRaw);

    const attendances = await prisma.mandatedTeamEventAttendance.findMany({
      where: { eventId },
    });
    const map = new Map(attendances.map((a) => [a.userId, a]));

    res.json({
      id: ev.id,
      title: ev.title,
      description: ev.description,
      startDate: ev.startDate.toISOString().slice(0, 10),
      endDate: ev.endDate.toISOString().slice(0, 10),
      requiredSlots: ev.requiredSlots,
      creator: ev.creator,
      members: members.map((m) => {
        const row = map.get(m.id);
        return {
          userId: m.id,
          name: m.name,
          avatarColor: m.avatarColor,
          avatarLetter: m.avatarLetter,
          attendanceId: row?.id,
          attended: row?.attended ?? false,
        };
      }),
    });
  } catch (e) {
    console.error('mandated-team-events detail:', e);
    res.status(500).json({ error: '取得に失敗しました' });
  }
});

/** GET /api/mandated-team-events/:id/audit-logs */
router.get('/:id/audit-logs', async (req: AuthRequest, res) => {
  try {
    const eventId = req.params.id;
    const ev = await prisma.mandatedTeamEvent.findUnique({ where: { id: eventId } });
    if (!ev) return res.status(404).json({ error: '見つかりません' });

    const where: { eventId: string; userId?: string } = { eventId };
    if (req.user!.role === 'MEMBER') {
      where.userId = req.user!.id;
    }

    const logs = await prisma.mandatedAttendanceAuditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        changedBy: { select: { id: true, name: true } },
        member: { select: { id: true, name: true } },
      },
    });

    res.json(
      logs.map((l) => ({
        id: l.id,
        userId: l.userId,
        memberName: l.member.name,
        attended: l.attended,
        changedById: l.changedById,
        changedByName: l.changedBy.name,
        createdAt: l.createdAt.toISOString(),
      })),
    );
  } catch (e) {
    console.error('mandated-team-events audit-logs:', e);
    res.status(500).json({ error: '履歴の取得に失敗しました' });
  }
});

/** POST /api/mandated-team-events */
router.post('/', async (req: AuthRequest, res) => {
  try {
    if (!isStaff(req.user!.role)) {
      return res.status(403).json({ error: '作成権限がありません' });
    }
    const data = createSchema.parse(req.body);
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    if (endDate < startDate) {
      return res.status(400).json({ error: '終了日は開始日以降にしてください' });
    }

    const row = await prisma.mandatedTeamEvent.create({
      data: {
        title: data.title.trim(),
        description: data.description?.trim() || null,
        startDate,
        endDate,
        requiredSlots: data.requiredSlots,
        createdById: req.user!.id,
      },
    });

    await ensureAttendanceRows(row.id);

    const full = await prisma.mandatedTeamEvent.findUnique({
      where: { id: row.id },
      include: { creator: { select: { id: true, name: true } }, attendances: true },
    });
    res.status(201).json(full);
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
    console.error('mandated-team-events create:', e);
    res.status(500).json({ error: '作成に失敗しました' });
  }
});

/** PATCH /api/mandated-team-events/:id */
router.patch('/:id', async (req: AuthRequest, res) => {
  try {
    if (!isStaff(req.user!.role)) {
      return res.status(403).json({ error: '権限がありません' });
    }
    const data = createSchema.partial().parse(req.body);
    const id = req.params.id;
    const existing = await prisma.mandatedTeamEvent.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: '見つかりません' });

    const startDate = data.startDate ? new Date(data.startDate) : existing.startDate;
    const endDate = data.endDate ? new Date(data.endDate) : existing.endDate;
    if (endDate < startDate) {
      return res.status(400).json({ error: '終了日は開始日以降にしてください' });
    }

    const updated = await prisma.mandatedTeamEvent.update({
      where: { id },
      data: {
        ...(data.title != null ? { title: data.title.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
        ...(data.startDate ? { startDate } : {}),
        ...(data.endDate ? { endDate } : {}),
        ...(data.requiredSlots != null ? { requiredSlots: data.requiredSlots } : {}),
      },
      include: { creator: { select: { id: true, name: true } }, attendances: true },
    });

    await ensureAttendanceRows(id);

    res.json(updated);
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
    console.error('mandated-team-events patch:', e);
    res.status(500).json({ error: '更新に失敗しました' });
  }
});

/** DELETE /api/mandated-team-events/:id */
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    if (!isStaff(req.user!.role)) {
      return res.status(403).json({ error: '権限がありません' });
    }
    await prisma.mandatedTeamEvent.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    console.error('mandated-team-events delete:', e);
    res.status(500).json({ error: '削除に失敗しました' });
  }
});

const attendanceSchema = z.object({
  userId: z.string().uuid(),
  attended: z.boolean(),
});

/** PATCH /api/mandated-team-events/:id/attendance */
router.patch('/:id/attendance', async (req: AuthRequest, res) => {
  try {
    const eventId = req.params.id;
    const data = attendanceSchema.parse(req.body);

    const ev = await prisma.mandatedTeamEvent.findUnique({ where: { id: eventId } });
    if (!ev) return res.status(404).json({ error: '見つかりません' });

    if (req.user!.role === 'MEMBER' && data.userId !== req.user!.id) {
      return res.status(403).json({ error: '自分の参加状況のみ変更できます' });
    }

    const target = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { role: true },
    });
    if (!target || target.role !== 'MEMBER') {
      return res.status(400).json({ error: '隊員のみ対象です' });
    }

    await ensureAttendanceRows(eventId);

    const prev = await prisma.mandatedTeamEventAttendance.findUnique({
      where: { eventId_userId: { eventId, userId: data.userId } },
    });
    if (prev?.attended === data.attended) {
      return res.json({ ok: true });
    }

    await prisma.$transaction([
      prisma.mandatedTeamEventAttendance.upsert({
        where: {
          eventId_userId: { eventId, userId: data.userId },
        },
        create: { eventId, userId: data.userId, attended: data.attended },
        update: { attended: data.attended },
      }),
      prisma.mandatedAttendanceAuditLog.create({
        data: {
          eventId,
          userId: data.userId,
          attended: data.attended,
          changedById: req.user!.id,
        },
      }),
    ]);

    res.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
    console.error('mandated-team-events attendance:', e);
    res.status(500).json({ error: '更新に失敗しました' });
  }
});

export default router;
