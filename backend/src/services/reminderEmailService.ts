import { addDays, differenceInCalendarDays, format } from 'date-fns';
import prisma from '../lib/prisma';
import { getUsersByRoles, queueEmail } from './emailService';
import { getCurrentWeekBoundary } from '../utils/weekBoundary';

const staffRoles = ['MASTER', 'SUPPORT', 'GOVERNMENT'] as const;

export async function queueSnsWeeklySummaryEmail() {
  const { weekStart, weekEnd, weekKey } = getCurrentWeekBoundary();
  const [members, posts, recipients] = await Promise.all([
    prisma.user.findMany({
      where: { role: 'MEMBER', displayOrder: { not: 0 } },
      select: { id: true, name: true },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.sNSPost.findMany({
      where: { postedAt: { gte: weekStart, lt: weekEnd } },
      select: { userId: true, postType: true },
    }),
    getUsersByRoles([...staffRoles]),
  ]);

  const lines = members.map((member) => {
    const memberPosts = posts.filter((post) => post.userId === member.id);
    const hasFeed = memberPosts.some((post) => post.postType === 'FEED');
    const hasStory = memberPosts.some((post) => post.postType === 'STORY');
    return `${member.name}: 投稿 ${hasFeed ? '済' : '未'} / ストーリーズ ${hasStory ? '済' : '未'}`;
  });

  const textBody = [
    `今週のSNS投稿状況です。`,
    `対象週: ${weekKey}`,
    '',
    ...lines,
  ].join('\n');

  return queueEmail({
    eventType: 'SNS_WEEKLY_SUMMARY',
    recipients,
    subject: `今週のSNS投稿状況: ${weekKey}`,
    textBody,
    link: '/sns-posts',
    relatedType: 'SNSWeeklySummary',
    relatedId: weekKey,
    idempotencyKeyBase: `sns-weekly-summary:${weekKey}`,
  });
}

export async function queueLeaveExpiryReminderEmails() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const near = addDays(today, 14);
  const paidNear = addDays(today, 30);

  const [paidAllocations, compensatoryLeaves, timeAdjustments] = await Promise.all([
    prisma.paidLeaveAllocation.findMany({
      where: { expiresAt: { gte: today, lte: paidNear } },
      include: { user: { select: { id: true, email: true, name: true } } },
    }),
    prisma.compensatoryLeave.findMany({
      where: { status: 'PENDING', expiresAt: { gte: today, lte: near } },
      include: { user: { select: { id: true, email: true, name: true } }, usages: true },
    }),
    prisma.timeAdjustment.findMany({
      where: { usedAt: null, compensatoryLeave: { expiresAt: { gte: today, lte: near } } },
      include: {
        user: { select: { id: true, email: true, name: true } },
        compensatoryLeave: { select: { id: true, expiresAt: true } },
      },
    }),
  ]);

  let count = 0;

  for (const allocation of paidAllocations) {
    const used = await prisma.paidLeaveEntry.aggregate({
      where: {
        userId: allocation.userId,
        usedAt: {
          gte: new Date(`${allocation.fiscalYear}-04-01T00:00:00.000Z`),
          lte: new Date(`${allocation.fiscalYear + 1}-03-31T23:59:59.999Z`),
        },
      },
      _sum: { days: true },
    });
    const remainingDays = allocation.totalDays - (used._sum.days ?? 0);
    if (remainingDays <= 0) continue;

    const daysLeft = differenceInCalendarDays(allocation.expiresAt, today);
    const result = await queueEmail({
      eventType: 'LEAVE_EXPIRY_REMINDER',
      recipients: [allocation.user],
      subject: `有給の期限が近づいています（残 ${remainingDays}日）`,
      textBody: `有給の期限が近づいています。\n残日数: ${remainingDays}日\n期限: ${format(allocation.expiresAt, 'yyyy/MM/dd')}（あと${daysLeft}日）`,
      link: '/leave-management',
      relatedType: 'PaidLeaveAllocation',
      relatedId: allocation.id,
      idempotencyKeyBase: `paid-leave-expiry:${allocation.id}:${format(today, 'yyyy-MM-dd')}`,
    });
    count += result.count;
  }

  for (const leave of compensatoryLeaves) {
    const usedDays = leave.usages.reduce((sum, usage) => sum + usage.days, 0);
    if (usedDays >= 1) continue;
    const daysLeft = differenceInCalendarDays(leave.expiresAt, today);
    const result = await queueEmail({
      eventType: 'LEAVE_EXPIRY_REMINDER',
      recipients: [leave.user],
      subject: `代休の期限が近づいています（あと${daysLeft}日）`,
      textBody: `代休の期限が近づいています。\n期限: ${format(leave.expiresAt, 'yyyy/MM/dd')}（あと${daysLeft}日）`,
      link: '/leave-management',
      relatedType: 'CompensatoryLeave',
      relatedId: leave.id,
      idempotencyKeyBase: `comp-leave-expiry:${leave.id}:${format(today, 'yyyy-MM-dd')}`,
    });
    count += result.count;
  }

  for (const adjustment of timeAdjustments) {
    if (!adjustment.compensatoryLeave) continue;
    const daysLeft = differenceInCalendarDays(adjustment.compensatoryLeave.expiresAt, today);
    const result = await queueEmail({
      eventType: 'TIME_ADJUSTMENT_EXPIRY_REMINDER',
      recipients: [adjustment.user],
      subject: `時間調整の期限が近づいています（あと${daysLeft}日）`,
      textBody: `時間調整の期限が近づいています。\n残時間: ${adjustment.hours}時間\n期限: ${format(adjustment.compensatoryLeave.expiresAt, 'yyyy/MM/dd')}（あと${daysLeft}日）`,
      link: '/leave-management',
      relatedType: 'TimeAdjustment',
      relatedId: adjustment.id,
      idempotencyKeyBase: `time-adjustment-expiry:${adjustment.id}:${format(today, 'yyyy-MM-dd')}`,
    });
    count += result.count;
  }

  return { count };
}
