// @ts-nocheck
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import scheduleRoutes from './routes/schedules';
import locationRoutes from './routes/locations';
import weeklyReportRoutes from './routes/weeklyReports';
import goalsRoutes from './routes/goals';
import scheduleSuggestionsRoutes from './routes/scheduleSuggestions';
import taskRequestsRoutes from './routes/taskRequests';
import inspectionsRoutes from './routes/inspections';
import personalRoutes from './routes/personal';
import notificationsRoutes from './routes/notifications';
import projectsRoutes from './routes/projects';
import eventsRoutes from './routes/events';
import snsPostsRoutes from './routes/snsPosts';
import contactsRoutes from './routes/contacts';
import { errorHandler } from './middleware/errorHandler';
import { startCronJobs } from './jobs';

dotenv.config();

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
app.use('/api/goals', goalsRoutes);
app.use('/api/schedule-suggestions', scheduleSuggestionsRoutes);
app.use('/api/task-requests', taskRequestsRoutes);
app.use('/api/inspections', inspectionsRoutes);
app.use('/api/personal', personalRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/sns-posts', snsPostsRoutes);
app.use('/api/contacts', contactsRoutes);

// Error handler
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);

  // Start cron jobs
  startCronJobs();
});
