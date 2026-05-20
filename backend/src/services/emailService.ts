import { EmailEventType, Prisma, Role } from '@prisma/client';
import prisma from '../lib/prisma';

type EmailRecipient = {
  id?: string | null;
  email: string;
  name?: string | null;
};

type QueueEmailInput = {
  eventType: EmailEventType;
  recipients: EmailRecipient[];
  actorUserId?: string | null;
  subject: string;
  textBody: string;
  htmlBody?: string | null;
  link?: string | null;
  relatedType?: string | null;
  relatedId?: string | null;
  idempotencyKeyBase?: string | null;
  scheduledAt?: Date;
};

const maxAttempts = 5;
const staleSendingMinutes = 10;
const retryBaseMinutes = 5;
const retryMaxMinutes = 60;

function appUrl(path?: string | null) {
  const raw = process.env.APP_URL || process.env.FRONTEND_URL?.split(',')[0] || '';
  const base = raw.replace(/\/$/, '');
  if (!base || !path) return path || null;
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function minutesFromNow(minutes: number) {
  return new Date(Date.now() + minutes * 60 * 1000);
}

function nextRetryAt(attempts: number) {
  const delay = Math.min(retryBaseMinutes * 2 ** Math.max(0, attempts - 1), retryMaxMinutes);
  return minutesFromNow(delay);
}

function htmlEscape(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function toBasicHtml(text: string, link?: string | null) {
  const lines = text.split('\n').map((line) => `<p>${htmlEscape(line) || '&nbsp;'}</p>`).join('');
  const url = appUrl(link);
  const button = url
    ? `<p><a href="${htmlEscape(url)}" style="display:inline-block;padding:10px 14px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">アプリで確認する</a></p>`
    : '';
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.7;color:#111827;">${lines}${button}</div>`;
}

export async function getUsersByRoles(roles: Role[]) {
  return prisma.user.findMany({
    where: { role: { in: roles } },
    select: { id: true, email: true, name: true, role: true },
    orderBy: [{ role: 'asc' }, { displayOrder: 'asc' }, { name: 'asc' }],
  });
}

export async function queueEmail(input: QueueEmailInput) {
  if (process.env.EMAIL_ENABLED !== 'true') {
    return { count: 0, skipped: true };
  }

  const seen = new Set<string>();
  const rows: Prisma.EmailJobCreateManyInput[] = [];

  for (const recipient of input.recipients) {
    const email = recipient.email?.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);

    rows.push({
      eventType: input.eventType,
      recipientUserId: recipient.id || null,
      recipientEmail: email,
      recipientName: recipient.name || null,
      actorUserId: input.actorUserId || null,
      subject: input.subject,
      textBody: input.textBody,
      htmlBody: input.htmlBody ?? toBasicHtml(input.textBody, input.link),
      link: input.link || null,
      relatedType: input.relatedType || null,
      relatedId: input.relatedId || null,
      idempotencyKey: input.idempotencyKeyBase ? `${input.idempotencyKeyBase}:${email}` : undefined,
      scheduledAt: input.scheduledAt || new Date(),
    });
  }

  if (rows.length === 0) return { count: 0 };
  return prisma.emailJob.createMany({ data: rows, skipDuplicates: true });
}

async function deliverEmail(to: string, subject: string, text: string, html?: string | null) {
  const provider = (process.env.EMAIL_PROVIDER || 'console').toLowerCase();
  const from = process.env.EMAIL_FROM || 'noreply@example.com';

  if (provider === 'console') {
    console.log('[email:console]', { to, subject, text });
    return;
  }

  if (provider === 'resend') {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('RESEND_API_KEY is not set');
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, text, html: html || undefined }),
    });
    if (!response.ok) throw new Error(`Resend failed: ${response.status} ${await response.text()}`);
    return;
  }

  if (provider === 'brevo') {
    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) throw new Error('BREVO_API_KEY is not set');
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: from },
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html || undefined,
      }),
    });
    if (!response.ok) throw new Error(`Brevo failed: ${response.status} ${await response.text()}`);
    return;
  }

  throw new Error(`Unsupported EMAIL_PROVIDER: ${provider}`);
}

export async function sendPendingEmailJobs(limit = 30) {
  if (process.env.EMAIL_ENABLED !== 'true') return { sent: 0, failed: 0, cancelled: 0, processed: 0, skipped: true };

  await prisma.emailJob.updateMany({
    where: {
      status: 'SENDING',
      updatedAt: { lt: minutesFromNow(-staleSendingMinutes) },
    },
    data: {
      status: 'FAILED',
      lastError: `送信中のまま${staleSendingMinutes}分以上経過したため再試行待ちに戻しました`,
      scheduledAt: new Date(),
    },
  });

  const jobs = await prisma.emailJob.findMany({
    where: {
      status: { in: ['PENDING', 'FAILED'] },
      attempts: { lt: maxAttempts },
      scheduledAt: { lte: new Date() },
    },
    include: {
      recipientUser: { select: { emailNotificationsEnabled: true } },
    },
    orderBy: { scheduledAt: 'asc' },
    take: limit,
  });

  let sent = 0;
  let failed = 0;
  let cancelled = 0;

  for (const job of jobs) {
    await prisma.emailJob.update({
      where: { id: job.id },
      data: { status: 'SENDING', attempts: { increment: 1 }, lastError: null },
    });

    try {
      if (job.recipientUser?.emailNotificationsEnabled === false) {
        await prisma.emailJob.update({
          where: { id: job.id },
          data: { status: 'CANCELLED', lastError: '受信者がメール通知をOFFにしています' },
        });
        cancelled += 1;
        continue;
      }
      await deliverEmail(job.recipientEmail, job.subject, job.textBody, job.htmlBody);
      await prisma.emailJob.update({
        where: { id: job.id },
        data: { status: 'SENT', sentAt: new Date(), lastError: null },
      });
      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const attempts = job.attempts + 1;
      await prisma.emailJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          lastError: message,
          scheduledAt: attempts >= maxAttempts ? job.scheduledAt : nextRetryAt(attempts),
        },
      });
      console.error('[email] delivery failed:', job.id, message);
      failed += 1;
    }
  }

  return { sent, failed, cancelled, processed: jobs.length, skipped: false };
}
