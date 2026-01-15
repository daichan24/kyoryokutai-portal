import prisma from '../lib/prisma';

/**
 * 目標タスクの進捗を更新し、親階層の進捗を再計算
 */
export async function updateGoalTaskProgress(taskId: string, newProgress: number) {
  const task = await prisma.goalTask.update({
    where: { id: taskId },
    data: { progress: newProgress },
    include: {
      subGoal: {
        include: {
          midGoal: {
            include: {
              mission: true,
            },
          },
        },
      },
    },
  });

  if (!task) throw new Error('Task not found');

  await calculateSubGoalProgress(task.subGoal.id);
  await calculateMidGoalProgress(task.subGoal.midGoal.id);
  const missionProgress = await calculateMissionProgress(task.subGoal.midGoal.mission.id);

  return missionProgress;
}

/**
 * サブゴールの進捗を計算
 */
export async function calculateSubGoalProgress(subGoalId: string): Promise<number> {
  const tasks = await prisma.goalTask.findMany({
    where: { subGoalId },
  });

  if (tasks.length === 0) return 0;

  const totalWeight = tasks.reduce((sum, t) => sum + t.weight, 0);
  if (totalWeight === 0) return 0;

  const weightedProgress = tasks.reduce(
    (sum, t) => sum + (t.progress * t.weight) / 100,
    0
  );

  return (weightedProgress / totalWeight) * 100;
}

/**
 * 中目標の進捗を計算
 */
export async function calculateMidGoalProgress(midGoalId: string): Promise<number> {
  const subGoals = await prisma.subGoal.findMany({
    where: { midGoalId },
    include: { tasks: true },
  });

  if (subGoals.length === 0) return 0;

  const totalWeight = subGoals.reduce((sum, sg) => sum + sg.weight, 0);
  if (totalWeight === 0) return 0;

  let weightedProgress = 0;
  for (const subGoal of subGoals) {
    const subGoalProgress = await calculateSubGoalProgress(subGoal.id);
    weightedProgress += (subGoalProgress * subGoal.weight) / 100;
  }

  return (weightedProgress / totalWeight) * 100;
}

/**
 * ミッション全体の進捗を計算（旧：目標全体の進捗）
 */
export async function calculateMissionProgress(missionId: string): Promise<number> {
  const midGoals = await prisma.midGoal.findMany({
    where: { missionId },
    include: { subGoals: { include: { tasks: true } } },
  });

  if (midGoals.length === 0) return 0;

  const totalWeight = midGoals.reduce((sum, mg) => sum + mg.weight, 0);
  if (totalWeight === 0) return 0;

  let weightedProgress = 0;
  for (const midGoal of midGoals) {
    const midGoalProgress = await calculateMidGoalProgress(midGoal.id);
    weightedProgress += (midGoalProgress * midGoal.weight) / 100;
  }

  return (weightedProgress / totalWeight) * 100;
}

/**
 * 目標全体の進捗を計算（後方互換性のため残す）
 * @deprecated calculateMissionProgress を使用してください
 */
export async function calculateGoalProgress(goalId: string): Promise<number> {
  return calculateMissionProgress(goalId);
}

/**
 * プロジェクトタスクの進捗を更新
 */
export async function updateProjectTaskProgress(taskId: string, newProgress: number) {
  await prisma.projectTask.update({
    where: { id: taskId },
    data: { progress: newProgress },
  });

  return await calculateProjectProgress(taskId);
}

/**
 * プロジェクトの全体進捗を計算
 */
export async function calculateProjectProgress(projectId: string): Promise<number> {
  const tasks = await prisma.projectTask.findMany({
    where: { projectId },
  });

  if (tasks.length === 0) return 0;

  const totalProgress = tasks.reduce((sum, t) => sum + t.progress, 0);
  return totalProgress / tasks.length;
}

/**
 * ミッションの完全な進捗データを取得（旧：目標の完全な進捗データ）
 */
export async function getMissionProgressData(missionId: string) {
  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
    include: {
      midGoals: {
        include: {
          subGoals: {
            include: {
              tasks: true,
            },
          },
        },
        orderBy: { order: 'asc' },
      },
    },
  });

  if (!mission) throw new Error('Mission not found');

  const missionProgress = await calculateMissionProgress(missionId);

  const midGoalsWithProgress = await Promise.all(
    mission.midGoals.map(async (midGoal) => {
      const midGoalProgress = await calculateMidGoalProgress(midGoal.id);
      const subGoalsWithProgress = await Promise.all(
        midGoal.subGoals.map(async (subGoal) => {
          const subGoalProgress = await calculateSubGoalProgress(subGoal.id);
          return {
            ...subGoal,
            progress: Math.round(subGoalProgress * 100) / 100,
          };
        })
      );

      return {
        ...midGoal,
        progress: Math.round(midGoalProgress * 100) / 100,
        subGoals: subGoalsWithProgress,
      };
    })
  );

  return {
    ...mission,
    progress: Math.round(missionProgress * 100) / 100,
    midGoals: midGoalsWithProgress,
  };
}

/**
 * 目標の完全な進捗データを取得（後方互換性のため残す）
 * @deprecated getMissionProgressData を使用してください
 */
export async function getGoalProgressData(goalId: string) {
  return getMissionProgressData(goalId);
}
