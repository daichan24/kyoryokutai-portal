import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
  buildGoogleAuthUrl,
  disconnectGoogleCalendar,
  enqueueGoogleCalendarSyncJob,
  getGoogleCalendarStatus,
  handleGoogleCalendarWebhook,
  handleGoogleOAuthCallback,
  processGoogleCalendarSyncJobs,
} from '../services/googleCalendarService';

const router = Router();

router.post('/webhook/google-calendar', async (req, res) => {
  try {
    await handleGoogleCalendarWebhook(req.headers);
    res.status(204).send();
  } catch (error) {
    console.error('Google Calendar webhook error:', error);
    res.status(204).send();
  }
});

router.get('/oauth/callback', async (req, res) => {
  try {
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    if (!code || !state) {
      return res.status(400).send('Missing Google OAuth code or state');
    }
    const redirectTo = await handleGoogleOAuthCallback(code, state);
    res.redirect(redirectTo);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    const frontendUrl = (process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173')
      .split(',')[0]
      .trim()
      .replace(/\/$/, '');
    res.redirect(`${frontendUrl}/settings/google-calendar?googleCalendar=error`);
  }
});

router.use(authenticate);

router.get('/status', async (req: AuthRequest, res) => {
  try {
    res.json(await getGoogleCalendarStatus(req.user!.id));
  } catch (error) {
    console.error('Google Calendar status error:', error);
    res.status(500).json({ error: 'Googleカレンダー連携状態の取得に失敗しました' });
  }
});

router.get('/auth-url', async (req: AuthRequest, res) => {
  try {
    res.json({ url: buildGoogleAuthUrl(req.user!.id) });
  } catch (error) {
    console.error('Google Calendar auth-url error:', error);
    res.status(500).json({
      error: 'Googleカレンダー連携URLの作成に失敗しました',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/sync', async (req: AuthRequest, res) => {
  try {
    const connection = await prisma.googleCalendarConnection.findUnique({ where: { userId: req.user!.id } });
    if (!connection || !['ACTIVE', 'ERROR'].includes(connection.status)) {
      return res.status(400).json({ error: 'Googleカレンダーが連携されていません' });
    }
    const job = await enqueueGoogleCalendarSyncJob(connection.id, 'MANUAL');
    await processGoogleCalendarSyncJobs(1);
    res.json({ message: '同期を実行しました', jobId: job.id, status: await getGoogleCalendarStatus(req.user!.id) });
  } catch (error) {
    console.error('Google Calendar manual sync error:', error);
    res.status(500).json({
      error: 'Googleカレンダー同期に失敗しました',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/disconnect', async (req: AuthRequest, res) => {
  try {
    await disconnectGoogleCalendar(req.user!.id);
    res.json({ message: 'Googleカレンダー連携を解除しました' });
  } catch (error) {
    console.error('Google Calendar disconnect error:', error);
    res.status(500).json({ error: 'Googleカレンダー連携解除に失敗しました' });
  }
});

export default router;
