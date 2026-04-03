import { Router } from 'express';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

// 受付ボックスの未読数を取得
router.get('/unread-count', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;

    let count = 0;

    // メンバー：スケジュール承認リクエスト（共同作業・イベント応援）
    if (role === 'MEMBER') {
      const scheduleCount = await prisma.scheduleParticipant.count({
        where: {
          userId,
          status: 'PENDING',
        },
      });
      count += scheduleCount;
    }
    // スタッフ（行政・サポート・マスター）：受信箱系
    else if (role === 'GOVERNMENT' || role === 'SUPPORT' || role === 'MASTER') {
      // ① スケジュール承認リクエスト（共同作業・イベント応援）
      const scheduleCount = await prisma.scheduleParticipant.count({
        where: {
          schedule: {
            userId: {
              not: userId, // 自分のスケジュールは除く
            },
          },
          status: 'PENDING',
        },
      });

      // ② 相談（メンバーから届いたもの）
      const consultationCount = await prisma.consultation.count({
        where: {
          status: 'OPEN',
          OR: [
            { audience: 'ANY' },
            { audience: 'SUPPORT_ONLY', targetUserId: null },
            { audience: 'GOVERNMENT_ONLY', targetUserId: null },
            { audience: 'SPECIFIC_USER', targetUserId: userId },
          ],
        },
      });

      // ③ 活動経費承認（行政・サポートのみ）
      let expenseCount = 0;
      if (role === 'GOVERNMENT' || role === 'SUPPORT') {
        expenseCount = await prisma.activityExpenseEntry.count({
          where: {
            userId: {
              not: userId,
            },
          },
        });
      }

      // ④ 週次報告の提出（メンバーから届いたもの）
      const weeklyReportCount = await prisma.weeklyReport.count({
        where: {
          submittedAt: {
            not: null,
          },
          user: {
            role: 'MEMBER',
          },
        },
      });

      // ⑤ 復命書の提出（メンバーから届いたもの）
      const inspectionCount = await prisma.inspection.count({
        where: {
          user: {
            role: 'MEMBER',
          },
        },
      });

      // ⑥ 月次報告の提出（メンバーから届いたもの）
      const monthlyReportCount = await prisma.monthlyReport.count({
        where: {
          submittedAt: {
            not: null,
          },
          creator: {
            role: 'MEMBER',
          },
        },
      });

      count = consultationCount + expenseCount + weeklyReportCount + inspectionCount + monthlyReportCount;
    }

    res.json({ count });
  } catch (error) {
    console.error('Get reception box unread count error:', error);
    res.status(500).json({ error: '未読数の取得に失敗しました' });
  }
});

export default router;
