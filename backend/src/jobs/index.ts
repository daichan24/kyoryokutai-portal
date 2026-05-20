import cron from 'node-cron';
import { sendWeekendReminder } from './weekendReminder';
import { sendPendingEmailJobs } from '../services/emailService';
import { queueLeaveExpiryReminderEmails, queueSnsWeeklySummaryEmail } from '../services/reminderEmailService';
import { enqueuePollAndWatchRenewalJobs, processGoogleCalendarSyncJobs } from '../services/googleCalendarService';

/**
 * バッチジョブスケジューラ
 */
export function startCronJobs() {
  console.log('🕐 Starting cron jobs...');

  // 週末リマインダー: 毎週金曜20時
  cron.schedule('0 20 * * 5', async () => {
    console.log('Running weekend reminder job...');
    try {
      await sendWeekendReminder();
    } catch (error) {
      console.error('Weekend reminder job failed:', error);
    }
  });

  // メール送信キュー: 1分ごと
  cron.schedule('* * * * *', async () => {
    try {
      await sendPendingEmailJobs();
      await processGoogleCalendarSyncJobs();
    } catch (error) {
      console.error('Queue job failed:', error);
    }
  });

  // Googleカレンダー差分同期・watch更新: 15分ごと
  cron.schedule('*/15 * * * *', async () => {
    try {
      await enqueuePollAndWatchRenewalJobs();
    } catch (error) {
      console.error('Google Calendar poll/watch renewal enqueue failed:', error);
    }
  });

  // SNS投稿状況まとめ: 毎週金曜17時
  cron.schedule('0 17 * * 5', async () => {
    try {
      await queueSnsWeeklySummaryEmail();
    } catch (error) {
      console.error('SNS weekly summary email job failed:', error);
    }
  });

  // 有給・代休・時間調整期限リマインド: 毎日9時
  cron.schedule('0 9 * * *', async () => {
    try {
      await queueLeaveExpiryReminderEmails();
    } catch (error) {
      console.error('Leave expiry reminder email job failed:', error);
    }
  });

  // 役場業務テンプレート生成: 毎日0時（将来実装）
  // cron.schedule('0 0 * * *', async () => {
  //   console.log('Running default schedules generation job...');
  //   try {
  //     await generateDefaultSchedules();
  //   } catch (error) {
  //     console.error('Default schedules generation job failed:', error);
  //   }
  // });

  // SNS投稿レコード生成: 毎週日曜0時（将来実装）
  // cron.schedule('0 0 * * 0', async () => {
  //   console.log('Running weekly SNS posts generation job...');
  //   try {
  //     await generateWeeklySNSPosts();
  //   } catch (error) {
  //     console.error('Weekly SNS posts generation job failed:', error);
  //   }
  // });

  console.log('✅ Cron jobs started successfully');
}
