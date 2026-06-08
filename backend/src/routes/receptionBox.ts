import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const unreadCountCache = new Map<string, { count: number; expiresAt: number }>();
const UNREAD_COUNT_CACHE_MS = 30_000;

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
  return staffRole === 'MASTER' || staffRole === 'SUPPORT' || staffRole === 'GOVERNMENT';
}

// 受付ボックスの未読数を取得
router.get('/unread-count', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const cacheKey = `${userId}:${role}`;
    const cached = unreadCountCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json({ count: cached.count });
    }

    let count = 0;

    // 全員共通: お知らせの未確認数
    const allAnnouncements = await prisma.announcement.findMany({
      select: { id: true, confirmTarget: true, authorId: true },
    });
    const targetAnnouncementIds = allAnnouncements
      .filter((a) => {
        if (a.authorId === userId) return false;
        if (a.confirmTarget === 'MEMBER' && role !== 'MEMBER') return false;
        return true;
      })
      .map((a) => a.id);
    if (targetAnnouncementIds.length > 0) {
      const announcementReads = await prisma.announcementRead.findMany({
        where: { userId, announcementId: { in: targetAnnouncementIds } },
        select: { announcementId: true },
      });
      const readSet = new Set(announcementReads.map((r) => r.announcementId));
      count += targetAnnouncementIds.filter((id) => !readSet.has(id)).length;
    }

    // メンバー：スケジュール承認リクエスト（共同作業・イベント応援）
    if (role === 'MEMBER') {
      const scheduleCount = await prisma.scheduleParticipant.count({
        where: { userId, status: 'PENDING' },
      });
      count += scheduleCount;
    } else if (role === 'GOVERNMENT' || role === 'SUPPORT' || role === 'MASTER') {
      const [
        scheduleCount,
        openConsultations,
        expenseCount,
        weeklyReportCount,
        inspectionCount,
        monthlyReportCount,
        compensatoryLeaveCount,
        timeAdjustmentCount,
      ] = await Promise.all([
        prisma.scheduleParticipant.count({
          where: {
            schedule: { userId: { not: userId } },
            status: 'PENDING',
          },
        }),
        prisma.consultation.findMany({
          where: { status: 'OPEN' },
          include: {
            assignedUsers: { select: { id: true } },
          },
        }),
        prisma.activityExpenseEntry.count({
          where: { userId: { not: userId }, status: 'PENDING' },
        }),
        prisma.weeklyReport.count({
          where: {
            submittedAt: { not: null },
            approvalStatus: 'PENDING',
            user: { role: 'MEMBER' },
          },
        }),
        prisma.inspection.count({
          where: { user: { role: 'MEMBER' }, approvalStatus: 'PENDING' },
        }),
        prisma.monthlyReport.count({
          where: {
            submittedAt: { not: null },
            approvalStatus: 'PENDING',
            creator: { role: { in: ['SUPPORT', 'MASTER'] } },
          },
        }),
        prisma.compensatoryLeave.count({
          where: { confirmedAt: null, user: { role: 'MEMBER' } },
        }),
        prisma.timeAdjustment.count({
          where: { confirmedAt: null, user: { role: 'MEMBER' } },
        }),
      ]);

      const consultationCount = openConsultations.filter((c) =>
        consultationMatchesStaff(c, userId, role)
      ).length;

      count += scheduleCount + consultationCount + expenseCount + weeklyReportCount + inspectionCount + monthlyReportCount + compensatoryLeaveCount + timeAdjustmentCount;
    }

    unreadCountCache.set(cacheKey, {
      count,
      expiresAt: Date.now() + UNREAD_COUNT_CACHE_MS,
    });
    res.json({ count });
  } catch (error) {
    console.error('Get reception box unread count error:', error);
    res.status(500).json({ error: '未読数の取得に失敗しました' });
  }
});

// 受付ボックスの未読リストを取得
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;

    const scheduleInvites: any[] = [];
    const consultations: any[] = [];
    const expenses: any[] = [];
    const weeklyReports: any[] = [];
    const inspections: any[] = [];
    const monthlyReports: any[] = [];
    const compensatoryLeaves: any[] = [];
    const timeAdjustments: any[] = [];

    if (role === 'MEMBER') {
      const invites = await prisma.scheduleParticipant.findMany({
        where: { userId, status: 'PENDING' },
        include: {
          schedule: { include: { user: { select: { id: true, name: true, avatarColor: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      });
      scheduleInvites.push(...invites);
    } else if (role === 'GOVERNMENT' || role === 'SUPPORT' || role === 'MASTER') {
      const invites = await prisma.scheduleParticipant.findMany({
        where: {
          schedule: { userId: { not: userId } },
          status: 'PENDING',
        },
        include: {
          schedule: { include: { user: { select: { id: true, name: true, avatarColor: true } } } },
          user: { select: { id: true, name: true, avatarColor: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      scheduleInvites.push(...invites);

      const consults = await prisma.consultation.findMany({
        where: {
          OR: [
            { status: 'OPEN' },
            { status: 'RESOLVED' },
          ],
        },
        include: {
          member: { select: { id: true, name: true, avatarColor: true } },
          targetUser: { select: { id: true, name: true } },
          assignedUsers: { select: { id: true, name: true, role: true } },
          resolvedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      consultations.push(...consults.filter((c) => consultationMatchesStaff(c, userId, role)));

      // 活動経費: PENDING + APPROVED/REJECTED 全件返す（フロント側でタブ分け）
      const expenseList = await prisma.activityExpenseEntry.findMany({
        where: { userId: { not: userId } },
        include: {
          user: { select: { id: true, name: true, avatarColor: true } },
          project: { select: { id: true, projectName: true } },
          updatedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      expenses.push(...expenseList);

      const reports = await prisma.weeklyReport.findMany({
        where: { submittedAt: { not: null }, user: { role: 'MEMBER' } },
        include: {
          user: { select: { id: true, name: true, avatarColor: true } },
          approver: { select: { id: true, name: true } },
        },
        orderBy: { submittedAt: 'desc' },
      });
      weeklyReports.push(...reports);

      const insp = await prisma.inspection.findMany({
        where: { user: { role: 'MEMBER' } },
        include: {
          user: { select: { id: true, name: true, avatarColor: true } },
          approver: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      inspections.push(...insp);

      const monthly = await prisma.monthlyReport.findMany({
        where: { submittedAt: { not: null }, creator: { role: { in: ['SUPPORT', 'MASTER'] } } },
        include: {
          creator: { select: { id: true, name: true, avatarColor: true } },
          approver: { select: { id: true, name: true } },
        },
        orderBy: { submittedAt: 'desc' },
      });
      monthlyReports.push(...monthly);

      const compLeaves = await prisma.compensatoryLeave.findMany({
        where: { user: { role: 'MEMBER' } },
        include: {
          user: { select: { id: true, name: true, avatarColor: true } },
          schedule: { select: { id: true, title: true, activityDescription: true, startDate: true } },
          confirmedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      compensatoryLeaves.push(...compLeaves);

      const adjustments = await prisma.timeAdjustment.findMany({
        where: { user: { role: 'MEMBER' } },
        include: {
          user: { select: { id: true, name: true, avatarColor: true } },
          sourceSchedule: { select: { id: true, title: true, activityDescription: true, startDate: true } },
          compensatoryLeave: { select: { id: true, expiresAt: true } },
          confirmedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      timeAdjustments.push(...adjustments);
    }

    res.json({
      scheduleInvites,
      consultations,
      expenses,
      weeklyReports,
      inspections,
      monthlyReports,
      compensatoryLeaves,
      timeAdjustments,
    });
  } catch (error) {
    console.error('Get reception box list error:', error);
    res.status(500).json({ error: 'リストの取得に失敗しました' });
  }
});

export default router;
