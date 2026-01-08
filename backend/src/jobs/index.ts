import cron from 'node-cron';
import { sendWeekendReminder } from './weekendReminder';

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
