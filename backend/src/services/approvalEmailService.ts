import { ApprovalStatus, EmailEventType, ExpenseStatus, Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { getUsersByRoles, queueEmail } from './emailService';

const staffRoles: Role[] = ['MASTER', 'SUPPORT', 'GOVERNMENT'];

function approvalStatusJa(status: ApprovalStatus | ExpenseStatus) {
  if (status === 'APPROVED') return '承認';
  if (status === 'REJECTED') return '差し戻し';
  return '承認待ち';
}

function formatDateJa(value: Date) {
  return value.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' });
}

async function notifyRoles(args: {
  roles: Role[];
  eventType: EmailEventType;
  actorUserId?: string | null;
  subject: string;
  textBody: string;
  link: string;
  relatedType: string;
  relatedId: string;
  idempotencyKeyBase: string;
}) {
  const users = await getUsersByRoles(args.roles);
  return queueEmail({
    eventType: args.eventType,
    recipients: users,
    actorUserId: args.actorUserId,
    subject: args.subject,
    textBody: args.textBody,
    link: args.link,
    relatedType: args.relatedType,
    relatedId: args.relatedId,
    idempotencyKeyBase: args.idempotencyKeyBase,
  });
}

async function notifyUser(args: {
  userId: string;
  eventType: EmailEventType;
  actorUserId?: string | null;
  subject: string;
  textBody: string;
  link: string;
  relatedType: string;
  relatedId: string;
  idempotencyKeyBase: string;
}) {
  const user = await prisma.user.findUnique({
    where: { id: args.userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) return { count: 0 };
  return queueEmail({
    eventType: args.eventType,
    recipients: [user],
    actorUserId: args.actorUserId,
    subject: args.subject,
    textBody: args.textBody,
    link: args.link,
    relatedType: args.relatedType,
    relatedId: args.relatedId,
    idempotencyKeyBase: args.idempotencyKeyBase,
  });
}

export async function notifyWeeklyReportSubmitted(reportId: string) {
  const report = await prisma.weeklyReport.findUnique({
    where: { id: reportId },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!report?.submittedAt) return { count: 0 };

  return notifyRoles({
    roles: staffRoles,
    eventType: 'WEEKLY_REPORT_SUBMITTED',
    actorUserId: report.userId,
    subject: `週次報告の承認依頼: ${report.user.name}さん ${report.week}`,
    textBody: `${report.user.name}さんから週次報告が提出されました。\n対象週: ${report.week}\n受付ボックスから内容を確認してください。`,
    link: `/reports/weekly?week=${encodeURIComponent(report.week)}&userId=${encodeURIComponent(report.userId)}`,
    relatedType: 'WeeklyReport',
    relatedId: report.id,
    idempotencyKeyBase: `weekly-submitted:${report.id}:${report.submittedAt.toISOString()}`,
  });
}

export async function notifyWeeklyReportResult(reportId: string) {
  const report = await prisma.weeklyReport.findUnique({
    where: { id: reportId },
    include: { approver: { select: { id: true, name: true } } },
  });
  if (!report || !report.approvalStatus || report.approvalStatus === 'PENDING' || report.approvalStatus === 'DRAFT') {
    return { count: 0 };
  }

  const statusText = approvalStatusJa(report.approvalStatus);
  return notifyUser({
    userId: report.userId,
    eventType: report.approvalStatus === 'APPROVED' ? 'WEEKLY_REPORT_APPROVED' : 'WEEKLY_REPORT_REJECTED',
    actorUserId: report.approvedBy,
    subject: `週次報告が${statusText}されました: ${report.week}`,
    textBody: `週次報告（${report.week}）が${statusText}されました。\n対応者: ${report.approver?.name || '不明'}${report.approvalComment ? `\nコメント: ${report.approvalComment}` : ''}`,
    link: `/reports/weekly?week=${encodeURIComponent(report.week)}`,
    relatedType: 'WeeklyReport',
    relatedId: report.id,
    idempotencyKeyBase: `weekly-result:${report.id}:${report.approvalStatus}:${report.approvedAt?.toISOString() || ''}`,
  });
}

export async function notifyInspectionSubmitted(inspectionId: string) {
  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!inspection || inspection.approvalStatus !== 'PENDING') return { count: 0 };

  return notifyRoles({
    roles: staffRoles,
    eventType: 'INSPECTION_SUBMITTED',
    actorUserId: inspection.userId,
    subject: `復命書の承認依頼: ${inspection.user.name}さん`,
    textBody: `${inspection.user.name}さんから復命書が提出されました。\n行き先: ${inspection.destination}\n受付ボックスから内容を確認してください。`,
    link: '/reception-box',
    relatedType: 'Inspection',
    relatedId: inspection.id,
    idempotencyKeyBase: `inspection-submitted:${inspection.id}:${inspection.updatedAt.toISOString()}`,
  });
}

export async function notifyInspectionResult(inspectionId: string) {
  const inspection = await prisma.inspection.findUnique({
    where: { id: inspectionId },
    include: { approver: { select: { id: true, name: true } } },
  });
  if (!inspection || inspection.approvalStatus === 'PENDING') return { count: 0 };

  const statusText = approvalStatusJa(inspection.approvalStatus);
  return notifyUser({
    userId: inspection.userId,
    eventType: inspection.approvalStatus === 'APPROVED' ? 'INSPECTION_APPROVED' : 'INSPECTION_REJECTED',
    actorUserId: inspection.approvedBy,
    subject: `復命書が${statusText}されました`,
    textBody: `復命書「${inspection.destination}」が${statusText}されました。\n対応者: ${inspection.approver?.name || '不明'}${inspection.approvalComment ? `\nコメント: ${inspection.approvalComment}` : ''}`,
    link: '/inspections',
    relatedType: 'Inspection',
    relatedId: inspection.id,
    idempotencyKeyBase: `inspection-result:${inspection.id}:${inspection.approvalStatus}:${inspection.approvedAt?.toISOString() || ''}`,
  });
}

export async function notifyExpenseSubmitted(entryId: string) {
  const entry = await prisma.activityExpenseEntry.findUnique({
    where: { id: entryId },
    include: { user: { select: { id: true, name: true } }, project: { select: { projectName: true } } },
  });
  if (!entry || entry.status !== 'PENDING') return { count: 0 };

  return notifyRoles({
    roles: staffRoles,
    eventType: 'ACTIVITY_EXPENSE_SUBMITTED',
    actorUserId: entry.createdById,
    subject: `活動経費の承認依頼: ${entry.user.name}さん ${entry.amount.toLocaleString()}円`,
    textBody: `${entry.user.name}さんから活動経費が申請されました。\n内容: ${entry.description}\n金額: ${entry.amount.toLocaleString()}円\nプロジェクト: ${entry.project?.projectName || '未設定'}\n受付ボックスから確認してください。`,
    link: '/reception-box',
    relatedType: 'ActivityExpenseEntry',
    relatedId: entry.id,
    idempotencyKeyBase: `expense-submitted:${entry.id}:${entry.updatedAt.toISOString()}`,
  });
}

export async function notifyExpenseResult(entryId: string) {
  const entry = await prisma.activityExpenseEntry.findUnique({
    where: { id: entryId },
    include: { updatedBy: { select: { id: true, name: true } } },
  });
  if (!entry || entry.status === 'PENDING') return { count: 0 };

  const statusText = approvalStatusJa(entry.status);
  return notifyUser({
    userId: entry.userId,
    eventType: entry.status === 'APPROVED' ? 'ACTIVITY_EXPENSE_APPROVED' : 'ACTIVITY_EXPENSE_REJECTED',
    actorUserId: entry.updatedById,
    subject: `活動経費が${statusText}されました`,
    textBody: `活動経費「${entry.description}」（${entry.amount.toLocaleString()}円）が${statusText}されました。\n対応者: ${entry.updatedBy?.name || '不明'}${entry.rejectionReason ? `\n理由: ${entry.rejectionReason}` : ''}`,
    link: '/activity-expenses',
    relatedType: 'ActivityExpenseEntry',
    relatedId: entry.id,
    idempotencyKeyBase: `expense-result:${entry.id}:${entry.status}:${entry.updatedAt.toISOString()}`,
  });
}

export async function notifyMonthlyReportSubmitted(reportId: string) {
  const report = await prisma.monthlyReport.findUnique({
    where: { id: reportId },
    include: { creator: { select: { id: true, name: true } } },
  });
  if (!report?.submittedAt) return { count: 0 };

  return notifyRoles({
    roles: ['GOVERNMENT'],
    eventType: 'MONTHLY_REPORT_SUBMITTED',
    actorUserId: report.createdBy,
    subject: `月次報告が提出されました: ${report.month}`,
    textBody: `${report.creator.name}さんから月次報告（${report.month}）が提出されました。\n受付ボックスから内容を確認してください。`,
    link: '/reception-box',
    relatedType: 'MonthlyReport',
    relatedId: report.id,
    idempotencyKeyBase: `monthly-submitted:${report.id}:${report.submittedAt.toISOString()}`,
  });
}

export async function notifyMonthlyReportResult(reportId: string) {
  const report = await prisma.monthlyReport.findUnique({
    where: { id: reportId },
    include: { approver: { select: { id: true, name: true } } },
  });
  if (!report || report.approvalStatus === 'PENDING' || report.approvalStatus === 'DRAFT') return { count: 0 };

  const statusText = approvalStatusJa(report.approvalStatus);
  return notifyUser({
    userId: report.createdBy,
    eventType: report.approvalStatus === 'APPROVED' ? 'MONTHLY_REPORT_APPROVED' : 'MONTHLY_REPORT_REJECTED',
    actorUserId: report.approvedBy,
    subject: `月次報告が${statusText}されました: ${report.month}`,
    textBody: `月次報告（${report.month}）が${statusText}されました。\n対応者: ${report.approver?.name || '不明'}${report.approvalComment ? `\nコメント: ${report.approvalComment}` : ''}`,
    link: '/reports/monthly',
    relatedType: 'MonthlyReport',
    relatedId: report.id,
    idempotencyKeyBase: `monthly-result:${report.id}:${report.approvalStatus}:${report.approvedAt?.toISOString() || ''}`,
  });
}

export async function notifyConsultationCreated(consultationId: string) {
  const consultation = await prisma.consultation.findUnique({
    where: { id: consultationId },
    include: {
      member: { select: { id: true, name: true } },
      assignedUsers: { select: { id: true, email: true, name: true } },
    },
  });
  if (!consultation?.emailRequested) return { count: 0 };

  let recipients = consultation.assignedUsers;
  if (consultation.audience !== 'SPECIFIC_USER') {
    const roles: Role[] =
      consultation.audience === 'SUPPORT_ONLY'
        ? ['MASTER', 'SUPPORT']
        : consultation.audience === 'GOVERNMENT_ONLY'
          ? ['MASTER', 'GOVERNMENT']
          : staffRoles;
    recipients = await getUsersByRoles(roles);
  }

  return queueEmail({
    eventType: 'CONSULTATION_CREATED',
    recipients,
    actorUserId: consultation.memberId,
    subject: `相談が届きました: ${consultation.subject || '件名なし'}`,
    textBody: `${consultation.member.name}さんから相談が届きました。\n件名: ${consultation.subject || '件名なし'}\n\n${consultation.body}`,
    link: '/consultations',
    relatedType: 'Consultation',
    relatedId: consultation.id,
    idempotencyKeyBase: `consultation-created:${consultation.id}`,
  });
}

export async function notifyConsultationResolved(consultationId: string) {
  const consultation = await prisma.consultation.findUnique({
    where: { id: consultationId },
    include: { resolvedBy: { select: { id: true, name: true } } },
  });
  if (!consultation?.emailRequested || consultation.status !== 'RESOLVED') return { count: 0 };

  return notifyUser({
    userId: consultation.memberId,
    eventType: 'CONSULTATION_RESOLVED',
    actorUserId: consultation.resolvedById,
    subject: `相談が対応済みになりました: ${consultation.subject || '件名なし'}`,
    textBody: `相談「${consultation.subject || '件名なし'}」が対応済みになりました。\n対応者: ${consultation.resolvedBy?.name || '不明'}\n\n${consultation.resolutionNote || ''}`,
    link: '/consultations',
    relatedType: 'Consultation',
    relatedId: consultation.id,
    idempotencyKeyBase: `consultation-resolved:${consultation.id}:${consultation.resolvedAt?.toISOString() || ''}`,
  });
}

export async function notifyCompensatoryLeaveSubmitted(leaveId: string) {
  const leave = await prisma.compensatoryLeave.findUnique({
    where: { id: leaveId },
    include: {
      user: { select: { id: true, name: true } },
      schedule: { select: { title: true, activityDescription: true } },
    },
  });
  if (!leave || leave.confirmedAt) return { count: 0 };

  const typeText = leave.leaveType === 'TIME_ADJUST' ? '時間調整元' : leave.leaveType === 'HALF_DAY' ? '半休' : '代休';
  return notifyRoles({
    roles: staffRoles,
    eventType: 'COMPENSATORY_LEAVE_SUBMITTED',
    actorUserId: leave.userId,
    subject: `${typeText}の確認依頼: ${leave.user.name}さん`,
    textBody: `${leave.user.name}さんから${typeText}の確認依頼が届きました。\n発生日: ${formatDateJa(leave.grantedAt)}\n有効期限: ${formatDateJa(leave.expiresAt)}${leave.totalHours ? `\n時間: ${leave.totalHours}時間` : ''}${leave.schedule ? `\n関連予定: ${leave.schedule.title || leave.schedule.activityDescription || '未設定'}` : ''}${leave.note ? `\nメモ: ${leave.note}` : ''}`,
    link: '/leave-management',
    relatedType: 'CompensatoryLeave',
    relatedId: leave.id,
    idempotencyKeyBase: `comp-leave-submitted:${leave.id}:${leave.updatedAt.toISOString()}`,
  });
}

export async function notifyCompensatoryLeaveConfirmed(leaveId: string) {
  const leave = await prisma.compensatoryLeave.findUnique({
    where: { id: leaveId },
    include: { confirmedBy: { select: { id: true, name: true } } },
  });
  if (!leave?.confirmedAt) return { count: 0 };

  const typeText = leave.leaveType === 'TIME_ADJUST' ? '時間調整元' : leave.leaveType === 'HALF_DAY' ? '半休' : '代休';
  return notifyUser({
    userId: leave.userId,
    eventType: 'COMPENSATORY_LEAVE_CONFIRMED',
    actorUserId: leave.confirmedById,
    subject: `${typeText}が確認されました`,
    textBody: `${typeText}が確認されました。\n発生日: ${formatDateJa(leave.grantedAt)}\n有効期限: ${formatDateJa(leave.expiresAt)}\n対応者: ${leave.confirmedBy?.name || '不明'}`,
    link: '/leave-management',
    relatedType: 'CompensatoryLeave',
    relatedId: leave.id,
    idempotencyKeyBase: `comp-leave-confirmed:${leave.id}:${leave.confirmedAt.toISOString()}`,
  });
}

export async function notifyTimeAdjustmentSubmitted(adjustmentId: string) {
  const adjustment = await prisma.timeAdjustment.findUnique({
    where: { id: adjustmentId },
    include: {
      user: { select: { id: true, name: true } },
      sourceSchedule: { select: { title: true, activityDescription: true } },
      compensatoryLeave: { select: { expiresAt: true } },
    },
  });
  if (!adjustment || adjustment.confirmedAt) return { count: 0 };

  return notifyRoles({
    roles: staffRoles,
    eventType: 'TIME_ADJUSTMENT_SUBMITTED',
    actorUserId: adjustment.userId,
    subject: `時間調整の確認依頼: ${adjustment.user.name}さん ${adjustment.hours}時間`,
    textBody: `${adjustment.user.name}さんから時間調整の確認依頼が届きました。\n発生日: ${formatDateJa(adjustment.adjustedAt)}\n時間: ${adjustment.hours}時間${adjustment.compensatoryLeave ? `\n有効期限: ${formatDateJa(adjustment.compensatoryLeave.expiresAt)}` : ''}${adjustment.sourceSchedule ? `\n関連予定: ${adjustment.sourceSchedule.title || adjustment.sourceSchedule.activityDescription || '未設定'}` : ''}${adjustment.note ? `\nメモ: ${adjustment.note}` : ''}`,
    link: '/leave-management',
    relatedType: 'TimeAdjustment',
    relatedId: adjustment.id,
    idempotencyKeyBase: `time-adjustment-submitted:${adjustment.id}:${adjustment.updatedAt.toISOString()}`,
  });
}

export async function notifyTimeAdjustmentConfirmed(adjustmentId: string) {
  const adjustment = await prisma.timeAdjustment.findUnique({
    where: { id: adjustmentId },
    include: { confirmedBy: { select: { id: true, name: true } } },
  });
  if (!adjustment?.confirmedAt) return { count: 0 };

  return notifyUser({
    userId: adjustment.userId,
    eventType: 'TIME_ADJUSTMENT_CONFIRMED',
    actorUserId: adjustment.confirmedById,
    subject: '時間調整が確認されました',
    textBody: `時間調整が確認されました。\n発生日: ${formatDateJa(adjustment.adjustedAt)}\n時間: ${adjustment.hours}時間\n対応者: ${adjustment.confirmedBy?.name || '不明'}`,
    link: '/leave-management',
    relatedType: 'TimeAdjustment',
    relatedId: adjustment.id,
    idempotencyKeyBase: `time-adjustment-confirmed:${adjustment.id}:${adjustment.confirmedAt.toISOString()}`,
  });
}

export async function notifyMissionResult(missionId: string) {
  const mission = await prisma.mission.findUnique({
    where: { id: missionId },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!mission || mission.approvalStatus === 'PENDING' || mission.approvalStatus === 'DRAFT') return { count: 0 };

  const statusText = approvalStatusJa(mission.approvalStatus);
  return notifyUser({
    userId: mission.userId,
    eventType: mission.approvalStatus === 'APPROVED' ? 'MISSION_APPROVED' : 'MISSION_REJECTED',
    actorUserId: mission.approvedBy,
    subject: `ミッションが${statusText}されました`,
    textBody: `ミッション「${mission.missionName}」が${statusText}されました。${mission.approvalComment ? `\nコメント: ${mission.approvalComment}` : ''}`,
    link: '/goals',
    relatedType: 'Mission',
    relatedId: mission.id,
    idempotencyKeyBase: `mission-result:${mission.id}:${mission.approvalStatus}:${mission.approvedAt?.toISOString() || mission.updatedAt.toISOString()}`,
  });
}

export async function notifyProjectResult(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { mission: { select: { missionName: true } } },
  });
  if (!project || project.approvalStatus === 'PENDING' || project.approvalStatus === 'DRAFT') return { count: 0 };

  const statusText = approvalStatusJa(project.approvalStatus);
  return notifyUser({
    userId: project.userId,
    eventType: project.approvalStatus === 'APPROVED' ? 'PROJECT_APPROVED' : 'PROJECT_REJECTED',
    actorUserId: project.approvedBy,
    subject: `プロジェクトが${statusText}されました`,
    textBody: `プロジェクト「${project.projectName}」が${statusText}されました。${project.mission ? `\nミッション: ${project.mission.missionName}` : ''}${project.approvalComment ? `\nコメント: ${project.approvalComment}` : ''}`,
    link: '/projects',
    relatedType: 'Project',
    relatedId: project.id,
    idempotencyKeyBase: `project-result:${project.id}:${project.approvalStatus}:${project.approvedAt?.toISOString() || project.updatedAt.toISOString()}`,
  });
}
