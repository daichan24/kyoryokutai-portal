import prisma from '../lib/prisma';
import { startOfWeek, endOfWeek, addWeeks } from 'date-fns';

/**
 * 週末リマインダー
 * 毎週金曜20時に実行
 */
export async function sendWeekendReminder() {
  console.log('🔔 Starting weekend reminder job...');

  const users = await prisma.user.findMany({
    where: { role: 'MEMBER' },
  });

  for (const user of users) {
    const reminders: string[] = [];

    // 1. 保留中のスケジュールをチェック
    const pendingCount = await prisma.schedule.count({
      where: {
        userId: user.id,
        isPending: true,
        date: {
          lt: new Date(),
        },
      },
    });

    if (pendingCount > 0) {
      reminders.push(`進捗未更新のスケジュール: ${pendingCount}件`);
    }

    // 2. 次週のスケジュール入力チェック
    const nextWeekStart = startOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 });
    const nextWeekEnd = endOfWeek(addWeeks(new Date(), 1), { weekStartsOn: 1 });

    const nextWeekSchedulesCount = await prisma.schedule.count({
      where: {
        userId: user.id,
        date: {
          gte: nextWeekStart,
          lte: nextWeekEnd,
        },
      },
    });

    if (nextWeekSchedulesCount === 0) {
      reminders.push('次週のスケジュールが未入力です');
    }

    // 3. 週次報告の提出チェック
    const thisWeek = getWeekString(new Date());
    const weeklyReport = await prisma.weeklyReport.findUnique({
      where: {
        userId_week: {
          userId: user.id,
          week: thisWeek,
        },
      },
    });

    if (!weeklyReport || !weeklyReport.submittedAt) {
      reminders.push('今週の週次報告が未提出です');
    }

    // 4. SNS投稿チェック
    // 暫定回避: week フィールドの型不一致を回避するため、findFirst を使用
    const snsPost = await prisma.sNSPost.findFirst({
      where: {
        userId: user.id,
        week: thisWeek,
      },
    });

    if (!snsPost || !snsPost.isPosted) {
      reminders.push('今週のSNS投稿が未完了です');
    }

    // リマインダーがある場合はログ出力（将来的には通知送信）
    if (reminders.length > 0) {
      console.log(`📧 ${user.name}さんへのリマインダー:`);
      reminders.forEach((reminder) => {
        console.log(`  - ${reminder}`);
      });

      // TODO: ここで実際の通知を送信
      // - メール送信
      // - Slack通知
      // - アプリ内通知
    }
  }

  console.log('✅ Weekend reminder job completed');
}

/**
 * 週文字列を取得（YYYY-WW形式）
 */
function getWeekString(date: Date): string {
  const year = date.getFullYear();
  const week = getWeekNumber(date);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

/**
 * 週番号を取得
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}
