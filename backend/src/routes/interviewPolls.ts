import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { deleteScheduleFromGoogle } from '../services/googleCalendarService';
import { createNotification } from '../services/notificationService';
import {
  createDepartmentRenameMap,
  updateDepartmentList,
  updateDepartmentValue,
} from '../utils/interviewDepartments';
import { getInterviewPollAssignmentConsistency } from '../utils/interviewPollConsistency';
import { isCompleteAssignmentOrder } from '../utils/interviewAssignmentOrder';

const router = Router();

router.use(authenticate);

const staffRoles = ['MASTER', 'SUPPORT', 'GOVERNMENT'];
const isStaff = (role?: string) => !!role && staffRoles.includes(role);

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const monthSchema = z.string().regex(/^\d{4}-\d{2}$/);
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);
const pollMutationSchema = z.object({
  title: z.string().min(1).max(200),
  month: monthSchema,
  startTime: timeSchema.default('09:00'),
  endTime: timeSchema.default('17:00'),
  memo: z.string().optional().nullable(),
  dates: z.array(z.object({
    date: dateStringSchema,
    capacity: z.number().int().min(1).max(20).default(4),
    unavailableDepartments: z.array(z.string()).default([]),
  })).min(1),
  memberIds: z.array(z.string()).min(1),
});

const pollInclude = {
  createdBy: { select: { id: true, name: true, role: true } },
  confirmedBy: { select: { id: true, name: true, role: true } },
  dates: { orderBy: { date: 'asc' as const } },
  participants: {
    include: {
      member: { select: { id: true, name: true, role: true, department: true, avatarColor: true, displayOrder: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  availability: true,
  assignments: {
    include: {
      date: true,
      member: { select: { id: true, name: true, department: true, avatarColor: true } },
    },
    orderBy: { slotOrder: 'asc' as const },
  },
};

function toDateOnly(value: string) {
  return new Date(`${value}T12:00:00.000Z`);
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function hasDuplicateDates(dates: Array<{ date: string }>) {
  return new Set(dates.map(({ date }) => date)).size !== dates.length;
}

function normalizePoll(poll: any, viewerId?: string, viewerRole?: string) {
  const availabilityRows = (poll.availability || []) as Array<{
    memberId: string;
    dateId: string;
    status: 'OK' | 'NG';
  }>;
  const assignmentRows = (poll.assignments || []) as Array<{
    id: string;
    memberId: string;
    dateId: string;
    member?: { department?: string | null };
    date?: { unavailableDepartments?: string[] };
  }>;
  const responsesByMember = new Map<string, number>();
  for (const a of availabilityRows) {
    responsesByMember.set(a.memberId, (responsesByMember.get(a.memberId) || 0) + 1);
  }
  const assignmentConsistency = getInterviewPollAssignmentConsistency({
    availability: availabilityRows,
    assignments: assignmentRows,
    dates: poll.dates || [],
  });
  return {
    ...poll,
    dates: (poll.dates || []).map((d: any) => ({ ...d, date: formatDateOnly(d.date) })),
    responseSummary: {
      totalParticipants: poll.participants?.length || 0,
      respondedParticipants: [...responsesByMember.keys()].length,
    },
    myAvailability:
      viewerId && !isStaff(viewerRole)
        ? (poll.availability || []).filter((a: any) => a.memberId === viewerId)
        : poll.availability || [],
    assignmentConsistency,
  };
}

async function resetAssignments(
  tx: Prisma.TransactionClient,
  pollId: string,
  assignments: Array<{ memberId: string; scheduleId?: string | null }>,
) {
  const schedules = assignments.flatMap((assignment) =>
    assignment.scheduleId
      ? [{ scheduleId: assignment.scheduleId, userId: assignment.memberId }]
      : [],
  );
  const scheduleIds = schedules.map(({ scheduleId }) => scheduleId);
  if (scheduleIds.length > 0) {
    await tx.schedule.updateMany({
      where: { id: { in: scheduleIds } },
      data: { deletedAt: new Date() },
    });
  }
  await tx.interviewPollAssignment.deleteMany({ where: { pollId } });
  return schedules;
}

function syncScheduleDeletions(schedules: Array<{ scheduleId: string; userId: string }>) {
  for (const schedule of schedules) {
    deleteScheduleFromGoogle(schedule.scheduleId, schedule.userId).catch((error) => {
      console.error(`Failed to delete interview schedule ${schedule.scheduleId} from Google Calendar:`, error);
    });
  }
}

function buildAssignments(poll: any) {
  const dates = [...poll.dates].sort((a: any, b: any) => formatDateOnly(a.date).localeCompare(formatDateOnly(b.date)));
  const dateById = new Map(dates.map((d: any) => [d.id, d]));
  const availability = new Map<string, Set<string>>();
  for (const a of poll.availability || []) {
    if (a.status !== 'OK') continue;
    if (!availability.has(a.memberId)) availability.set(a.memberId, new Set());
    availability.get(a.memberId)!.add(a.dateId);
  }

  const participants = [...poll.participants].map((p: any) => p.member);
  const candidatesByMember = new Map<string, any[]>();
  for (const member of participants) {
    const okDateIds = availability.get(member.id) || new Set<string>();
    const candidates = dates.filter((d: any) => {
      if (!okDateIds.has(d.id)) return false;
      const dept = (member.department || '').trim();
      return !dept || !(d.unavailableDepartments || []).includes(dept);
    });
    candidatesByMember.set(member.id, candidates);
  }

  const counts = new Map<string, number>(dates.map((d: any) => [d.id, 0]));
  const assignments: Array<{ dateId: string; memberId: string; slotOrder: number }> = [];
  const unassigned: Array<{ memberId: string; reason: string }> = [];

  participants
    .sort((a: any, b: any) => {
      const ac = candidatesByMember.get(a.id)?.length || 0;
      const bc = candidatesByMember.get(b.id)?.length || 0;
      if (ac !== bc) return ac - bc;
      return (a.displayOrder || 0) - (b.displayOrder || 0);
    })
    .forEach((member: any) => {
      const candidates = candidatesByMember.get(member.id) || [];
      const available = candidates
        .filter((d: any) => (counts.get(d.id) || 0) < d.capacity)
        .sort((a: any, b: any) => {
          const byFill = (counts.get(a.id) || 0) - (counts.get(b.id) || 0);
          if (byFill !== 0) return byFill;
          return formatDateOnly(a.date).localeCompare(formatDateOnly(b.date));
        });
      const selected = available[0];
      if (!selected) {
        unassigned.push({ memberId: member.id, reason: candidates.length === 0 ? '候補日なし' : '定員超過' });
        return;
      }
      const nextCount = (counts.get(selected.id) || 0) + 1;
      counts.set(selected.id, nextCount);
      assignments.push({ dateId: selected.id, memberId: member.id, slotOrder: nextCount });
    });

  return {
    assignments,
    unassigned,
    byDate: dates.map((d: any) => ({
      dateId: d.id,
      date: formatDateOnly(d.date),
      capacity: d.capacity,
      assigned: assignments
        .filter((a) => a.dateId === d.id)
        .map((a) => ({
          ...a,
          member: participants.find((m: any) => m.id === a.memberId),
        })),
    })),
    dateById,
  };
}

router.get('/', async (req: AuthRequest, res) => {
  try {
    const month = typeof req.query.month === 'string' ? req.query.month : undefined;
    const where: any = month && /^\d{4}-\d{2}$/.test(month) ? { month } : {};
    if (!isStaff(req.user!.role)) {
      where.participants = { some: { memberId: req.user!.id } };
    }

    const polls = await prisma.interviewPoll.findMany({
      where,
      include: pollInclude,
      orderBy: [{ month: 'desc' }, { createdAt: 'desc' }],
    });
    res.json(polls.map((p) => normalizePoll(p, req.user!.id, req.user!.role)));
  } catch (error) {
    console.error('List interview polls error:', error);
    res.status(500).json({ error: '面談日程調整の取得に失敗しました' });
  }
});

router.put('/departments', async (req: AuthRequest, res) => {
  if (!isStaff(req.user!.role)) {
    return res.status(403).json({ error: '権限がありません' });
  }

  const schema = z.object({
    renames: z.array(z.object({
      oldName: z.string().trim().min(1).max(100),
      newName: z.string().trim().min(1).max(100),
    })).max(100).default([]),
    deletions: z.array(z.string().trim().min(1).max(100)).max(100).default([]),
  }).refine(({ renames, deletions }) => renames.length > 0 || deletions.length > 0);
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '入力内容が不正です', details: parsed.error.flatten() });
  }
  const normalizedRenames = parsed.data.renames.filter(({ oldName, newName }) => oldName !== newName);
  const deletions = [...new Set(parsed.data.deletions)];
  const oldNames = normalizedRenames.map(({ oldName }) => oldName);
  const newNames = normalizedRenames.map(({ newName }) => newName);
  if (
    (normalizedRenames.length === 0 && deletions.length === 0)
    || new Set(oldNames).size !== oldNames.length
    || new Set(newNames).size !== newNames.length
    || oldNames.some((name) => deletions.includes(name))
  ) {
    return res.status(400).json({ error: '課・係の変更内容が重複しています' });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const [members, dates] = await Promise.all([
        tx.user.findMany({
          where: { role: 'MEMBER', department: { not: null } },
          select: { id: true, department: true },
        }),
        tx.interviewPollDate.findMany({
          select: { id: true, unavailableDepartments: true },
        }),
      ]);

      const renameMap = createDepartmentRenameMap(normalizedRenames);
      const deletedDepartments = new Set(deletions);
      const currentDepartments = new Set(
        members.map(({ department }) => department?.trim()).filter((value): value is string => !!value),
      );
      const requestedDepartments = [...oldNames, ...deletions];
      const missingDepartment = requestedDepartments.find((name) => !currentDepartments.has(name));
      if (missingDepartment) {
        return { error: `「${missingDepartment}」は現在の課・係にありません`, status: 404 as const };
      }

      const unchangedDepartments = new Set(
        [...currentDepartments].filter((name) => !renameMap.has(name) && !deletedDepartments.has(name)),
      );
      const duplicateDepartment = newNames.find((name) => unchangedDepartments.has(name));
      if (duplicateDepartment) {
        return { error: `「${duplicateDepartment}」はすでに使用されています`, status: 409 as const };
      }

      const memberUpdates = members
        .map((member) => ({
          id: member.id,
          department: updateDepartmentValue(member.department, renameMap, deletedDepartments),
          changed:
            renameMap.has(member.department?.trim() || '')
            || deletedDepartments.has(member.department?.trim() || ''),
        }))
        .filter((member) => member.changed);
      const dateUpdates = dates
        .map((date) => ({
          id: date.id,
          before: date.unavailableDepartments,
          after: updateDepartmentList(date.unavailableDepartments, renameMap, deletedDepartments),
        }))
        .filter((date) =>
          date.before.some((department) =>
            renameMap.has(department.trim()) || deletedDepartments.has(department.trim()),
          ),
        );

      await Promise.all([
        ...memberUpdates.map(({ id, department }) => tx.user.update({ where: { id }, data: { department } })),
        ...dateUpdates.map(({ id, after }) =>
          tx.interviewPollDate.update({ where: { id }, data: { unavailableDepartments: after } }),
        ),
      ]);

      return {
        departments: [...new Set(members
          .map(({ department }) => updateDepartmentValue(department, renameMap, deletedDepartments)?.trim())
          .filter((value): value is string => !!value))].sort(),
        updatedMembers: memberUpdates.length,
        updatedDates: dateUpdates.length,
        deletedDepartments: deletions.length,
      };
    });

    if ('error' in result && result.error && result.status) {
      return res.status(result.status).json({ error: result.error });
    }
    res.json(result);
  } catch (error) {
    console.error('Update interview departments error:', error);
    res.status(500).json({ error: '課・係の変更に失敗しました' });
  }
});

router.post('/', async (req: AuthRequest, res) => {
  if (!isStaff(req.user!.role)) {
    return res.status(403).json({ error: '権限がありません' });
  }

  const parsed = pollMutationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '入力内容が不正です', details: parsed.error.flatten() });
  }
  if (hasDuplicateDates(parsed.data.dates)) {
    return res.status(400).json({ error: '同じ候補日を複数登録することはできません' });
  }

  try {
    const data = parsed.data;
    const members = await prisma.user.findMany({
      where: { id: { in: data.memberIds }, role: 'MEMBER' },
      select: { id: true },
    });
    if (members.length !== data.memberIds.length) {
      return res.status(400).json({ error: '隊員以外のユーザーが含まれています' });
    }

    const poll = await prisma.interviewPoll.create({
      data: {
        title: data.title,
        month: data.month,
        startTime: data.startTime,
        endTime: data.endTime,
        memo: data.memo,
        createdById: req.user!.id,
        dates: {
          create: data.dates.map((d) => ({
            date: toDateOnly(d.date),
            capacity: d.capacity,
            unavailableDepartments: [...new Set(d.unavailableDepartments.map((v) => v.trim()).filter(Boolean))],
          })),
        },
        participants: {
          create: data.memberIds.map((memberId) => ({ memberId })),
        },
      },
      include: pollInclude,
    });

    await Promise.all(
      data.memberIds.map((memberId) =>
        createNotification(
          memberId,
          'SCHEDULE_SUGGESTION',
          '面談候補日の回答依頼',
          `${data.month}の面談候補日を回答してください`,
          '/interview/polls',
        ).catch((error) => console.error('Interview poll notification error:', error)),
      ),
    );

    res.status(201).json(normalizePoll(poll, req.user!.id, req.user!.role));
  } catch (error) {
    console.error('Create interview poll error:', error);
    res.status(500).json({ error: '面談日程調整の作成に失敗しました' });
  }
});

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const poll = await prisma.interviewPoll.findUnique({ where: { id: req.params.id }, include: pollInclude });
    if (!poll) return res.status(404).json({ error: '面談日程調整が見つかりません' });
    if (!isStaff(req.user!.role) && !poll.participants.some((p) => p.memberId === req.user!.id)) {
      return res.status(403).json({ error: '権限がありません' });
    }
    res.json(normalizePoll(poll, req.user!.id, req.user!.role));
  } catch (error) {
    console.error('Get interview poll error:', error);
    res.status(500).json({ error: '面談日程調整の取得に失敗しました' });
  }
});

router.put('/:id', async (req: AuthRequest, res) => {
  if (!isStaff(req.user!.role)) {
    return res.status(403).json({ error: '権限がありません' });
  }

  const parsed = pollMutationSchema.extend({
    resetConfirmed: z.boolean().default(false),
  }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '入力内容が不正です', details: parsed.error.flatten() });
  }
  if (hasDuplicateDates(parsed.data.dates)) {
    return res.status(400).json({ error: '同じ候補日を複数登録することはできません' });
  }

  try {
    const data = parsed.data;
    const poll = await prisma.interviewPoll.findUnique({
      where: { id: req.params.id },
      include: pollInclude,
    });
    if (!poll) return res.status(404).json({ error: '面談日程調整が見つかりません' });
    if (poll.status === 'CANCELLED') {
      return res.status(400).json({ error: '取消済みの調整は編集できません' });
    }
    if (poll.status === 'CONFIRMED' && !data.resetConfirmed) {
      return res.status(409).json({
        error: '確定済みです。反映済みスケジュールを取り消して再調整する確認が必要です',
      });
    }

    const members = await prisma.user.findMany({
      where: { id: { in: data.memberIds }, role: 'MEMBER' },
      select: { id: true },
    });
    if (members.length !== data.memberIds.length) {
      return res.status(400).json({ error: '隊員以外のユーザーが含まれています' });
    }

    const retainedMemberIds = new Set(data.memberIds);
    const availabilityToPreserve = poll.availability
      .filter((availability) => retainedMemberIds.has(availability.memberId))
      .map((availability) => ({
        date: formatDateOnly(poll.dates.find((date) => date.id === availability.dateId)!.date),
        memberId: availability.memberId,
        status: availability.status,
      }));
    const existingMemberIds = new Set(poll.participants.map((participant) => participant.memberId));
    const addedMemberIds = data.memberIds.filter((memberId) => !existingMemberIds.has(memberId));

    let removedSchedules: Array<{ scheduleId: string; userId: string }> = [];
    await prisma.$transaction(async (tx) => {
      removedSchedules = await resetAssignments(tx, poll.id, poll.assignments);
      await tx.interviewPollAvailability.deleteMany({ where: { pollId: poll.id } });
      await tx.interviewPollDate.deleteMany({ where: { pollId: poll.id } });
      await tx.interviewPollParticipant.deleteMany({ where: { pollId: poll.id } });

      const dateIdByDate = new Map<string, string>();
      for (const date of data.dates) {
        const createdDate = await tx.interviewPollDate.create({
          data: {
            pollId: poll.id,
            date: toDateOnly(date.date),
            capacity: date.capacity,
            unavailableDepartments: [...new Set(
              date.unavailableDepartments.map((value) => value.trim()).filter(Boolean),
            )],
          },
        });
        dateIdByDate.set(date.date, createdDate.id);
      }

      await tx.interviewPollParticipant.createMany({
        data: data.memberIds.map((memberId) => ({ pollId: poll.id, memberId })),
      });
      const preservedAvailability = availabilityToPreserve.flatMap((availability) => {
        const dateId = dateIdByDate.get(availability.date);
        return dateId
          ? [{
            pollId: poll.id,
            dateId,
            memberId: availability.memberId,
            status: availability.status,
          }]
          : [];
      });
      if (preservedAvailability.length > 0) {
        await tx.interviewPollAvailability.createMany({ data: preservedAvailability });
      }

      await tx.interviewPoll.update({
        where: { id: poll.id },
        data: {
          title: data.title,
          month: data.month,
          startTime: data.startTime,
          endTime: data.endTime,
          memo: data.memo,
          status: 'COLLECTING',
          confirmedById: null,
          confirmedAt: null,
        },
      });
    });
    syncScheduleDeletions(removedSchedules);

    await Promise.all(
      addedMemberIds.map((memberId) =>
        createNotification(
          memberId,
          'SCHEDULE_SUGGESTION',
          '面談候補日の回答依頼',
          `${data.month}の面談候補日を回答してください`,
          '/interview/polls',
        ).catch((error) => console.error('Interview poll update notification error:', error)),
      ),
    );

    const updated = await prisma.interviewPoll.findUnique({ where: { id: poll.id }, include: pollInclude });
    if (!updated) return res.status(404).json({ error: '面談日程調整が見つかりません' });
    res.json(normalizePoll(updated, req.user!.id, req.user!.role));
  } catch (error) {
    console.error('Update interview poll error:', error);
    res.status(500).json({ error: '面談日程調整の編集に失敗しました' });
  }
});

router.delete('/:id', async (req: AuthRequest, res) => {
  if (!isStaff(req.user!.role)) {
    return res.status(403).json({ error: '権限がありません' });
  }

  const parsed = z.object({ deleteConfirmed: z.boolean().default(false) }).safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: '入力内容が不正です', details: parsed.error.flatten() });
  }

  try {
    const poll = await prisma.interviewPoll.findUnique({
      where: { id: req.params.id },
      include: { assignments: true },
    });
    if (!poll) return res.status(404).json({ error: '面談日程調整が見つかりません' });
    if (poll.status === 'CONFIRMED' && !parsed.data.deleteConfirmed) {
      return res.status(409).json({
        error: '確定済みです。反映済みスケジュールも取り消す確認が必要です',
      });
    }

    let removedSchedules: Array<{ scheduleId: string; userId: string }> = [];
    await prisma.$transaction(async (tx) => {
      removedSchedules = await resetAssignments(tx, poll.id, poll.assignments);
      await tx.interviewPoll.delete({ where: { id: poll.id } });
    });
    syncScheduleDeletions(removedSchedules);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete interview poll error:', error);
    res.status(500).json({ error: '面談日程調整の削除に失敗しました' });
  }
});

router.put('/:id/availability', async (req: AuthRequest, res) => {
  const schema = z.object({
    memberId: z.string().optional(),
    resetConfirmed: z.boolean().default(false),
    availability: z.array(z.object({
      dateId: z.string(),
      status: z.enum(['OK', 'NG']).nullable(),
    })),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '入力内容が不正です', details: parsed.error.flatten() });
  }

  try {
    const poll = await prisma.interviewPoll.findUnique({
      where: { id: req.params.id },
      include: { dates: true, participants: true, availability: true, assignments: true },
    });
    if (!poll) return res.status(404).json({ error: '面談日程調整が見つかりません' });
    if (poll.status === 'CANCELLED') {
      return res.status(400).json({ error: '確定または取消済みの調整には回答できません' });
    }
    const staffEditingMember = isStaff(req.user!.role) && !!parsed.data.memberId;
    const targetMemberId = staffEditingMember ? parsed.data.memberId! : req.user!.id;
    const canAnswer = poll.participants.some((participant) => participant.memberId === targetMemberId);
    if (!canAnswer || (!staffEditingMember && targetMemberId !== req.user!.id)) {
      return res.status(403).json({ error: '権限がありません' });
    }
    if (poll.status === 'CONFIRMED' && (!staffEditingMember || !parsed.data.resetConfirmed)) {
      return res.status(409).json({
        error: '確定済みです。反映済みスケジュールを取り消して再調整する確認が必要です',
      });
    }

    const dateIds = new Set(poll.dates.map((d) => d.id));
    if (parsed.data.availability.some((a) => !dateIds.has(a.dateId))) {
      return res.status(400).json({ error: '候補日に含まれない日付があります' });
    }

    const currentAvailability = new Map(
      poll.availability
        .filter((availability) => availability.memberId === targetMemberId)
        .map((availability) => [availability.dateId, availability.status]),
    );
    const hasChanges = parsed.data.availability.some(
      (availability) => (currentAvailability.get(availability.dateId) || null) !== availability.status,
    );

    if (hasChanges) {
      let removedSchedules: Array<{ scheduleId: string; userId: string }> = [];
      await prisma.$transaction(async (tx) => {
        for (const availability of parsed.data.availability) {
          if (availability.status === null) {
            await tx.interviewPollAvailability.deleteMany({
              where: { pollId: poll.id, dateId: availability.dateId, memberId: targetMemberId },
            });
          } else {
            await tx.interviewPollAvailability.upsert({
              where: {
                pollId_dateId_memberId: {
                  pollId: poll.id,
                  dateId: availability.dateId,
                  memberId: targetMemberId,
                },
              },
              update: { status: availability.status },
              create: {
                pollId: poll.id,
                dateId: availability.dateId,
                memberId: targetMemberId,
                status: availability.status,
              },
            });
          }
        }
        if (poll.assignments.length > 0) {
          removedSchedules = await resetAssignments(tx, poll.id, poll.assignments);
        }
        if (poll.status === 'PROPOSED' || poll.status === 'CONFIRMED') {
          await tx.interviewPoll.update({
            where: { id: poll.id },
            data: {
              status: 'COLLECTING',
              confirmedById: null,
              confirmedAt: null,
            },
          });
        }
      });
      syncScheduleDeletions(removedSchedules);
    }

    const updated = await prisma.interviewPoll.findUnique({ where: { id: poll.id }, include: pollInclude });
    if (!updated) return res.status(404).json({ error: '面談日程調整が見つかりません' });
    res.json(normalizePoll(updated, req.user!.id, req.user!.role));
  } catch (error) {
    console.error('Update interview availability error:', error);
    res.status(500).json({ error: '回答の保存に失敗しました' });
  }
});

router.post('/:id/propose', async (req: AuthRequest, res) => {
  if (!isStaff(req.user!.role)) {
    return res.status(403).json({ error: '権限がありません' });
  }

  try {
    const poll = await prisma.interviewPoll.findUnique({ where: { id: req.params.id }, include: pollInclude });
    if (!poll) return res.status(404).json({ error: '面談日程調整が見つかりません' });
    if (poll.status === 'CONFIRMED' || poll.status === 'CANCELLED') {
      return res.status(400).json({ error: '確定または取消済みの調整は再割当できません' });
    }

    const result = buildAssignments(poll);
    await prisma.$transaction([
      prisma.interviewPollAssignment.deleteMany({ where: { pollId: poll.id } }),
      ...result.assignments.map((a) =>
        prisma.interviewPollAssignment.create({
          data: { pollId: poll.id, dateId: a.dateId, memberId: a.memberId, slotOrder: a.slotOrder },
        }),
      ),
      prisma.interviewPoll.update({ where: { id: poll.id }, data: { status: 'PROPOSED' } }),
    ]);

    const updated = await prisma.interviewPoll.findUnique({ where: { id: poll.id }, include: pollInclude });
    if (!updated) return res.status(404).json({ error: '面談日程調整が見つかりません' });
    res.json({ poll: normalizePoll(updated, req.user!.id, req.user!.role), proposal: result });
  } catch (error) {
    console.error('Propose interview assignments error:', error);
    res.status(500).json({ error: '暫定日割りの作成に失敗しました' });
  }
});

router.put('/:id/assignments/order', async (req: AuthRequest, res) => {
  if (!isStaff(req.user!.role)) {
    return res.status(403).json({ error: '権限がありません' });
  }

  const schema = z.object({
    dateId: z.string().min(1),
    assignmentIds: z.array(z.string().min(1)).min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: '入力内容が不正です', details: parsed.error.flatten() });
  }

  try {
    const poll = await prisma.interviewPoll.findUnique({
      where: { id: req.params.id },
      include: pollInclude,
    });
    if (!poll) return res.status(404).json({ error: '面談日程調整が見つかりません' });
    if (poll.status === 'CANCELLED') {
      return res.status(400).json({ error: '取消済みの調整は並べ替えできません' });
    }
    if (!poll.dates.some((date) => date.id === parsed.data.dateId)) {
      return res.status(400).json({ error: '候補日に含まれない日付です' });
    }

    const currentAssignmentIds = poll.assignments
      .filter((assignment) => assignment.dateId === parsed.data.dateId)
      .map((assignment) => assignment.id);
    if (!isCompleteAssignmentOrder(currentAssignmentIds, parsed.data.assignmentIds)) {
      return res.status(400).json({ error: '面談順の指定が現在の割当と一致しません' });
    }

    await prisma.$transaction(
      parsed.data.assignmentIds.map((assignmentId, index) =>
        prisma.interviewPollAssignment.update({
          where: { id: assignmentId },
          data: { slotOrder: index + 1 },
        }),
      ),
    );

    const updated = await prisma.interviewPoll.findUnique({ where: { id: poll.id }, include: pollInclude });
    if (!updated) return res.status(404).json({ error: '面談日程調整が見つかりません' });
    res.json(normalizePoll(updated, req.user!.id, req.user!.role));
  } catch (error) {
    console.error('Reorder interview assignments error:', error);
    res.status(500).json({ error: '面談順の変更に失敗しました' });
  }
});

router.post('/:id/confirm', async (req: AuthRequest, res) => {
  if (!isStaff(req.user!.role)) {
    return res.status(403).json({ error: '権限がありません' });
  }

  try {
    const poll = await prisma.interviewPoll.findUnique({ where: { id: req.params.id }, include: pollInclude });
    if (!poll) return res.status(404).json({ error: '面談日程調整が見つかりません' });
    if (poll.status === 'CONFIRMED') {
      return res.status(400).json({ error: 'すでに確定済みです' });
    }
    if (poll.assignments.length === 0) {
      return res.status(400).json({ error: '暫定日割りを作成してから確定してください' });
    }

    const dateMap = new Map(poll.dates.map((d: any) => [d.id, d]));
    const updatedAssignments = await prisma.$transaction(async (tx) => {
      const rows = [];
      for (const assignment of poll.assignments) {
        if (assignment.scheduleId) {
          rows.push(assignment);
          continue;
        }
        const date = dateMap.get(assignment.dateId);
        if (!date) {
          throw new Error('Assignment date not found');
        }
        const schedule = await tx.schedule.create({
          data: {
            userId: assignment.memberId,
            date: date.date,
            startDate: date.date,
            endDate: date.date,
            startTime: poll.startTime,
            endTime: poll.endTime,
            title: poll.title,
            activityDescription: `${poll.month} 月次面談`,
            participants: [],
            reportable: false,
          },
        });
        const row = await tx.interviewPollAssignment.update({
          where: { id: assignment.id },
          data: { scheduleId: schedule.id },
        });
        rows.push(row);
      }
      await tx.interviewPoll.update({
        where: { id: poll.id },
        data: { status: 'CONFIRMED', confirmedById: req.user!.id, confirmedAt: new Date() },
      });
      return rows;
    });

    await Promise.all(
      updatedAssignments.map((assignment: any) =>
        createNotification(
          assignment.memberId,
          'SCHEDULE_SUGGESTION',
          '面談日程が確定しました',
          `${poll.month}の面談日程がスケジュールに反映されました`,
          '/schedule',
        ).catch((error) => console.error('Interview confirm notification error:', error)),
      ),
    );

    const updated = await prisma.interviewPoll.findUnique({ where: { id: poll.id }, include: pollInclude });
    if (!updated) return res.status(404).json({ error: '面談日程調整が見つかりません' });
    res.json(normalizePoll(updated, req.user!.id, req.user!.role));
  } catch (error) {
    console.error('Confirm interview poll error:', error);
    res.status(500).json({ error: '面談日程の確定に失敗しました' });
  }
});

export default router;
