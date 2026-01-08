import prisma from '../lib/prisma';

/**
 * 予定を作成し、複数ユーザーに提案を送る
 */
export async function createScheduleWithSuggestions(
  scheduleData: any,
  suggestToUserIds: string[]
) {
  // 1. 予定作成
  const schedule = await prisma.schedule.create({
    data: scheduleData,
  });

  // 2. 各ユーザーに提案作成
  for (const userId of suggestToUserIds) {
    // 衝突チェック
    const conflicts = await checkScheduleConflicts(
      userId,
      scheduleData.date,
      scheduleData.startTime,
      scheduleData.endTime
    );

    await prisma.scheduleSuggestion.create({
      data: {
        scheduleId: schedule.id,
        suggestedTo: userId,
        conflictingSchedules: conflicts.length > 0 ? conflicts.map((c) => c.id) : null,
      },
    });
  }

  return schedule;
}

/**
 * スケジュールの衝突をチェック
 */
export async function checkScheduleConflicts(
  userId: string,
  date: Date,
  startTime: string,
  endTime: string
) {
  return await prisma.schedule.findMany({
    where: {
      userId,
      date,
      OR: [
        // 新しい予定の開始時刻が既存予定の範囲内
        {
          startTime: { lte: startTime },
          endTime: { gt: startTime },
        },
        // 新しい予定の終了時刻が既存予定の範囲内
        {
          startTime: { lt: endTime },
          endTime: { gte: endTime },
        },
        // 新しい予定が既存予定を完全に含む
        {
          startTime: { gte: startTime },
          endTime: { lte: endTime },
        },
      ],
    },
  });
}

/**
 * 提案に応答（承認/拒否）
 */
export async function respondToSuggestion(
  suggestionId: string,
  status: 'ACCEPTED' | 'DECLINED'
) {
  const suggestion = await prisma.scheduleSuggestion.update({
    where: { id: suggestionId },
    data: {
      status,
      respondedAt: new Date(),
    },
    include: { schedule: true },
  });

  // ACCEPTEDの場合、予定をコピー
  if (status === 'ACCEPTED') {
    const { id, createdAt, updatedAt, userId, ...scheduleData } = suggestion.schedule;

    await prisma.schedule.create({
      data: {
        ...scheduleData,
        userId: suggestion.suggestedTo,
        createdBy: 'MANUAL',
      },
    });
  }

  return suggestion;
}

/**
 * 保留中のスケジュールを取得
 */
export async function getPendingSchedules(userId: string) {
  return await prisma.schedule.findMany({
    where: {
      userId,
      isPending: true,
      date: {
        lt: new Date(),
      },
    },
    include: {
      project: {
        select: {
          id: true,
          projectName: true,
        },
      },
    },
    orderBy: {
      date: 'desc',
    },
  });
}

/**
 * 保留を解除（進捗更新）
 */
export async function resolvePendingSchedule(
  scheduleId: string,
  progressUpdates?: Array<{ taskId: string; progress: number }>
) {
  // スケジュールの保留を解除
  const schedule = await prisma.schedule.update({
    where: { id: scheduleId },
    data: { isPending: false },
  });

  // 進捗更新がある場合
  if (progressUpdates && progressUpdates.length > 0) {
    for (const update of progressUpdates) {
      // GoalTaskの場合
      const goalTask = await prisma.goalTask.findUnique({
        where: { id: update.taskId },
      });

      if (goalTask) {
        await prisma.goalTask.update({
          where: { id: update.taskId },
          data: { progress: update.progress },
        });

        await prisma.scheduleProgress.create({
          data: {
            scheduleId,
            goalTaskId: update.taskId,
            progressBefore: goalTask.progress,
            progressAfter: update.progress,
          },
        });
      }

      // ProjectTaskの場合
      const projectTask = await prisma.projectTask.findUnique({
        where: { id: update.taskId },
      });

      if (projectTask) {
        await prisma.projectTask.update({
          where: { id: update.taskId },
          data: { progress: update.progress },
        });

        await prisma.scheduleProgress.create({
          data: {
            scheduleId,
            projectTaskId: update.taskId,
            progressBefore: projectTask.progress,
            progressAfter: update.progress,
          },
        });
      }
    }
  }

  return schedule;
}
