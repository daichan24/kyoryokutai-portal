import prisma from '../lib/prisma';

/**
 * 日数を計算
 */
function daysBetween(startDate: Date, endDate: Date): number {
  const diff = endDate.getTime() - startDate.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * 中目標の重みを再計算
 */
export async function recalculateMidGoalWeights(
  missionId: string,
  method: 'EQUAL' | 'PERIOD'
) {
  const midGoals = await prisma.midGoal.findMany({
    where: { missionId },
    orderBy: { order: 'asc' },
  });

  if (midGoals.length === 0) return;

  let weights: Array<{ id: string; weight: number }> = [];

  if (method === 'EQUAL') {
    const weight = Math.floor((100 / midGoals.length) * 100) / 100;
    weights = midGoals.map((mg) => ({ id: mg.id, weight }));

    const remainder = 100 - weight * midGoals.length;
    if (remainder > 0 && weights.length > 0) {
      weights[0].weight += remainder;
    }
  } else if (method === 'PERIOD') {
    const totalDays = midGoals.reduce((sum, mg) => {
      if (!mg.startDate || !mg.endDate) return sum;
      return sum + daysBetween(mg.startDate, mg.endDate);
    }, 0);

    if (totalDays === 0) {
      throw new Error('中目標に期間が設定されていません');
    }

    weights = midGoals.map((mg) => {
      if (!mg.startDate || !mg.endDate) {
        return { id: mg.id, weight: 0 };
      }
      const days = daysBetween(mg.startDate, mg.endDate);
      const weight = Math.floor(((days / totalDays) * 100) * 100) / 100;
      return { id: mg.id, weight };
    });

    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    const remainder = 100 - totalWeight;
    if (remainder !== 0 && weights.length > 0) {
      weights[0].weight += remainder;
    }
  }

  for (const { id, weight } of weights) {
    await prisma.midGoal.update({
      where: { id },
      data: { weight, weightMethod: method },
    });
  }

  return weights;
}

/**
 * 小目標の重みを再計算
 */
export async function recalculateSubGoalWeights(
  midGoalId: string,
  method: 'EQUAL' | 'PERIOD'
) {
  const subGoals = await prisma.subGoal.findMany({
    where: { midGoalId },
    orderBy: { order: 'asc' },
  });

  if (subGoals.length === 0) return;

  let weights: Array<{ id: string; weight: number }> = [];

  if (method === 'EQUAL') {
    const weight = Math.floor((100 / subGoals.length) * 100) / 100;
    weights = subGoals.map((sg) => ({ id: sg.id, weight }));

    const remainder = 100 - weight * subGoals.length;
    if (remainder > 0 && weights.length > 0) {
      weights[0].weight += remainder;
    }
  } else if (method === 'PERIOD') {
    const totalDays = subGoals.reduce((sum, sg) => {
      if (!sg.startDate || !sg.endDate) return sum;
      return sum + daysBetween(sg.startDate, sg.endDate);
    }, 0);

    if (totalDays === 0) {
      throw new Error('小目標に期間が設定されていません');
    }

    weights = subGoals.map((sg) => {
      if (!sg.startDate || !sg.endDate) {
        return { id: sg.id, weight: 0 };
      }
      const days = daysBetween(sg.startDate, sg.endDate);
      const weight = Math.floor(((days / totalDays) * 100) * 100) / 100;
      return { id: sg.id, weight };
    });

    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    const remainder = 100 - totalWeight;
    if (remainder !== 0 && weights.length > 0) {
      weights[0].weight += remainder;
    }
  }

  for (const { id, weight } of weights) {
    await prisma.subGoal.update({
      where: { id },
      data: { weight, weightMethod: method },
    });
  }

  return weights;
}

/**
 * タスクの重みを再計算
 */
export async function recalculateTaskWeights(
  subGoalId: string,
  method: 'EQUAL' | 'PERIOD'
) {
  const tasks = await prisma.goalTask.findMany({
    where: { subGoalId },
    orderBy: { order: 'asc' },
  });

  if (tasks.length === 0) return;

  let weights: Array<{ id: string; weight: number }> = [];

  if (method === 'EQUAL') {
    const weight = Math.floor((100 / tasks.length) * 100) / 100;
    weights = tasks.map((t) => ({ id: t.id, weight }));

    const remainder = 100 - weight * tasks.length;
    if (remainder > 0 && weights.length > 0) {
      weights[0].weight += remainder;
    }
  } else if (method === 'PERIOD') {
    const totalDays = tasks.reduce((sum, t) => {
      if (!t.startDate || !t.endDate) return sum;
      return sum + daysBetween(t.startDate, t.endDate);
    }, 0);

    if (totalDays === 0) {
      throw new Error('タスクに期間が設定されていません');
    }

    weights = tasks.map((t) => {
      if (!t.startDate || !t.endDate) {
        return { id: t.id, weight: 0 };
      }
      const days = daysBetween(t.startDate, t.endDate);
      const weight = Math.floor(((days / totalDays) * 100) * 100) / 100;
      return { id: t.id, weight };
    });

    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    const remainder = 100 - totalWeight;
    if (remainder !== 0 && weights.length > 0) {
      weights[0].weight += remainder;
    }
  }

  for (const { id, weight } of weights) {
    await prisma.goalTask.update({
      where: { id },
      data: { weight },
    });
  }

  return weights;
}
