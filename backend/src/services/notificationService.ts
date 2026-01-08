import prisma from '../lib/prisma';

type NotificationType =
  | 'SCHEDULE_SUGGESTION'
  | 'TASK_REQUEST'
  | 'PROJECT_APPROVED'
  | 'PROJECT_REJECTED'
  | 'WEEKLY_REMINDER'
  | 'SNS_REMINDER'
  | 'PENDING_SCHEDULE'
  | 'EVENT_REMINDER';

/**
 * 通知作成
 */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string
) {
  return await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      link,
    },
  });
}

/**
 * タスク依頼通知を作成
 */
export async function notifyTaskRequest(
  requestedToUserId: string,
  requesterName: string,
  taskTitle: string,
  requestId: string
) {
  return await createNotification(
    requestedToUserId,
    'TASK_REQUEST',
    '新しいタスク依頼',
    `${requesterName}さんから「${taskTitle}」の依頼が届きました`,
    `/task-requests/${requestId}`
  );
}

/**
 * プロジェクト承認通知を作成
 */
export async function notifyProjectApproval(
  userId: string,
  projectName: string,
  projectId: string,
  isApproved: boolean
) {
  return await createNotification(
    userId,
    isApproved ? 'PROJECT_APPROVED' : 'PROJECT_REJECTED',
    isApproved ? 'プロジェクトが承認されました' : 'プロジェクトが差し戻されました',
    `「${projectName}」が${isApproved ? '承認' : '差し戻し'}されました`,
    `/projects/${projectId}`
  );
}

/**
 * スケジュール提案通知を作成
 */
export async function notifyScheduleSuggestion(
  suggestedToUserId: string,
  suggesterName: string,
  suggestionId: string
) {
  return await createNotification(
    suggestedToUserId,
    'SCHEDULE_SUGGESTION',
    '新しい予定提案',
    `${suggesterName}さんから予定の提案が届きました`,
    `/schedule-suggestions/${suggestionId}`
  );
}

/**
 * 週次報告リマインド通知を作成
 */
export async function notifyWeeklyReportReminder(userId: string) {
  return await createNotification(
    userId,
    'WEEKLY_REMINDER',
    '週次報告の提出をお願いします',
    '今週の週次報告が未提出です。提出期限までに提出してください。',
    '/weekly-reports'
  );
}

/**
 * 進捗未更新通知を作成
 */
export async function notifyPendingSchedules(userId: string, count: number) {
  return await createNotification(
    userId,
    'PENDING_SCHEDULE',
    '進捗未更新のスケジュールがあります',
    `${count}件のスケジュールの進捗が未更新です。進捗を更新してください。`,
    '/schedules'
  );
}
