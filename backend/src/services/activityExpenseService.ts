import prisma from '../lib/prisma';

export async function getActivityExpenseSummary(userId: string, recentLimit = 100) {
  const budget = await prisma.activityExpenseBudget.findUnique({
    where: { userId },
    include: {
      updatedBy: { select: { id: true, name: true } },
    },
  });

  const entries = await prisma.activityExpenseEntry.findMany({
    where: { userId },
    orderBy: [{ spentAt: 'desc' }, { createdAt: 'desc' }],
    take: recentLimit,
    include: {
      project: { select: { id: true, projectName: true, missionId: true } },
      createdBy: { select: { id: true, name: true } },
      updatedBy: { select: { id: true, name: true } },
    },
  });

  const agg = await prisma.activityExpenseEntry.aggregate({
    where: { userId },
    _sum: { amount: true },
  });

  const totalSpent = agg._sum.amount ?? 0;
  const allocatedAmount = budget?.allocatedAmount ?? 0;

  return {
    allocatedAmount,
    totalSpent,
    remaining: allocatedAmount - totalSpent,
    memo: budget?.memo ?? null,
    budgetUpdatedAt: budget?.updatedAt?.toISOString() ?? null,
    budgetUpdatedBy: budget?.updatedBy ?? null,
    entries: entries.map((e) => ({
      id: e.id,
      userId: e.userId,
      projectId: e.projectId,
      project: e.project,
      spentAt: e.spentAt.toISOString(),
      description: e.description,
      amount: e.amount,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
      createdBy: e.createdBy,
      updatedBy: e.updatedBy,
    })),
  };
}

/** 面談 API 用（直近のみ） */
export async function getActivityExpenseSummaryLite(userId: string) {
  const full = await getActivityExpenseSummary(userId, 12);
  return {
    allocatedAmount: full.allocatedAmount,
    totalSpent: full.totalSpent,
    remaining: full.remaining,
    memo: full.memo,
    budgetUpdatedAt: full.budgetUpdatedAt,
    recentEntries: full.entries,
  };
}
