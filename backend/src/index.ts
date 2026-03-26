// @ts-nocheck
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import scheduleRoutes from './routes/schedules';
import locationRoutes from './routes/locations';
import weeklyReportRoutes from './routes/weeklyReports';
import missionsRoutes from './routes/missions';
import scheduleSuggestionsRoutes from './routes/scheduleSuggestions';
import requestsRoutes from './routes/requests';
import inspectionsRoutes from './routes/inspections';
import personalRoutes from './routes/personal';
import notificationsRoutes from './routes/notifications';
import projectsRoutes from './routes/projects';
import tasksRoutes from './routes/tasks';
import eventsRoutes from './routes/events';
import snsPostsRoutes from './routes/snsPosts';
import contactsRoutes from './routes/contacts';
import citizensRoutes from './routes/citizens';
import monthlyReportsRoutes from './routes/monthlyReports';
import adminRoutes from './routes/admin';
import inboxRoutes from './routes/inbox';
import dashboardConfigRoutes from './routes/dashboardConfig';
import snsLinksRoutes from './routes/snsLinks';
import profileRoutes from './routes/profile';
import nudgesRoutes from './routes/nudges';
import supportRecordsRoutes from './routes/supportRecords';
import documentTemplatesRoutes from './routes/documentTemplates';
import wishesRoutes from './routes/wishes';
import driveLinksRoutes from './routes/driveLinks';
import consultationsRoutes from './routes/consultations';
import activityExpensesRoutes from './routes/activityExpenses';
import announcementsRoutes from './routes/announcements';
import { errorHandler } from './middleware/errorHandler';
import { startCronJobs } from './jobs';

dotenv.config();

// DATABASE_URLの情報をログ出力（資格情報は出さない）
const dbUrl = process.env.DATABASE_URL || '';
const dbHostDb = dbUrl.split('@')[1]?.split('?')[0] || 'N/A';
console.log('🔵 [STARTUP] DB_URL_HOST_DB:', dbHostDb);

if (dbUrl) {
  try {
    const url = new URL(dbUrl);
    console.log('🔵 [DB] Database Host:', url.hostname);
    console.log('🔵 [DB] Database Name:', url.pathname.replace('/', '') || 'default');
    console.log('🔵 [DB] Database Port:', url.port || '5432 (default)');
  } catch (error) {
    console.log('⚠️ [DB] Failed to parse DATABASE_URL');
  }
} else {
  console.log('⚠️ [DB] DATABASE_URL is not set');
}

const app = express();
const PORT = process.env.PORT || 3001;

// CORS設定（本番環境対応）
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : ['http://localhost:5173'];

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // オリジンがない場合（Postman等の直接リクエスト）は許可
    if (!origin) return callback(null, true);
    
    // 許可されたオリジンかチェック
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/weekly-reports', weeklyReportRoutes);
app.use('/api/missions', missionsRoutes);
app.use('/api/schedule-suggestions', scheduleSuggestionsRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/inspections', inspectionsRoutes);
app.use('/api/personal', personalRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api', tasksRoutes); // /api/missions/:missionId/tasks のルート
app.use('/api/events', eventsRoutes);
app.use('/api/sns-posts', snsPostsRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/citizens', citizensRoutes); // 町民（協力隊メンバー）データベース用API
app.use('/api/monthly-reports', monthlyReportsRoutes);
app.use('/api/admin', adminRoutes); // 管理者用API
app.use('/api/inbox', inboxRoutes); // 受信箱API
app.use('/api/me/dashboard-config', dashboardConfigRoutes); // ダッシュボード設定API
app.use('/api/me/sns-links', snsLinksRoutes); // SNSリンクAPI
app.use('/api/me/profile', profileRoutes); // プロフィール表示設定（アイコン・ダークモード）
app.use('/api/nudges', nudgesRoutes); // 協力隊催促API
app.use('/api/support-records', supportRecordsRoutes); // 支援記録API
app.use('/api/document-templates', documentTemplatesRoutes); // テンプレート設定API
app.use('/api/wishes', wishesRoutes); // やりたいこと100 API
app.use('/api/drive-links', driveLinksRoutes); // Googleドライブリンク管理API
app.use('/api/consultations', consultationsRoutes);
app.use('/api/activity-expenses', activityExpensesRoutes);
app.use('/api/announcements', announcementsRoutes);

// ルート登録確認ログ
console.log('✅ [ROUTES] Registered routes:');
console.log('  - /api/me/dashboard-config (GET, PUT)');
console.log('  - /api/me/sns-links (GET, PUT)');
console.log('  - /api/nudges (GET, PUT), /api/nudges/revisions (GET)');

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // Start cron jobs
  startCronJobs();
});
