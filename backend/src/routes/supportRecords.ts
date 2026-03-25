import { Router } from 'express';
import { z } from 'zod';
import type { ParticipationType } from '@prisma/client';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const DAYS_MEMBER_TIMELINE = 30;

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function summarizeWeeklyActivitiesJson(json: unknown): string {
  if (json == null) return '';
  if (typeof json === 'string') return json.length > 400 ? `${json.slice(0, 400)}…` : json;
  if (Array.isArray(json)) {
    const text = json
      .map((x) => (typeof x === 'string' ? x : JSON.stringify(x)))
      .join(' / ');
    return text.length > 400 ? `${text.slice(0, 400)}…` : text;
  }
  if (typeof json === 'object') {
    const text = JSON.stringify(json);
    return text.length > 400 ? `${text.slice(0, 400)}…` : text;
  }
  return String(json);
}

function participationTypeLabel(t: ParticipationType): string {
  if (t === 'PARTICIPATION') return '参加';
  if (t === 'PREPARATION') return '準備';
  if (t === 'DEPARTMENT_DUTY') return '部門当番';
  return t;
}

function eventTypeLabel(eventType: string): string {
  if (eventType === 'TOWN_OFFICIAL') return '町公式';
  if (eventType === 'TEAM') return 'チーム';
  if (eventType === 'OTHER') return 'その他';
  return eventType;
}

const supportRecordSchema = z.object({
  userId: z.string().min(1),
  supportDate: z.string(),
  supportContent: z.string().min(1),
  monthlyReportId: z.string().optional(),
});

// 隊員の直近N日の出来事（面談時の振り返り用）— 一覧より先に定義（将来 :id と衝突しないよう）
router.get('/member-timeline', authorize('SUPPORT', 'MASTER'), async (req: AuthRequest, res) => {
  try {
    const userId = typeof req.query.userId === 'string' ? req.query.userId : '';
    if (!userId) {
      return res.status(400).json({ error: 'userId が必要です' });
    }

    const target = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, role: true, avatarColor: true, avatarLetter: true },
    });

    if (!target || target.role !== 'MEMBER') {
      return res.status(404).json({ error: '隊員が見つかりません' });
    }

    if (target.name === 'さとうだいち' && target.role === 'MEMBER') {
      return res.status(404).json({ error: '隊員が見つかりません' });
    }

    const toDate = new Date();
    toDate.setHours(23, 59, 59, 999);
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - DAYS_MEMBER_TIMELINE);
    fromDate.setHours(0, 0, 0, 0);

    const fromDay = new Date(fromDate);
    fromDay.setHours(0, 0, 0, 0);
    const toDay = new Date(toDate);
    toDay.setHours(0, 0, 0, 0);

    const [
      schedules,
      participations,
      weeklyReports,
      supportRecords,
      snsPosts,
      contactHistories,
      inspections,
    ] = await Promise.all([
      prisma.schedule.findMany({
        where: {
          userId,
          startDate: { lte: toDay },
          endDate: { gte: fromDay },
          isTemplate: false,
        },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          activityDescription: true,
          locationText: true,
        },
        orderBy: { startDate: 'desc' },
      }),
      prisma.eventParticipation.findMany({
        where: {
          userId,
          status: { not: 'REJECTED' },
          event: { date: { gte: fromDay, lte: toDay } },
        },
        include: {
          event: { select: { id: true, eventName: true, date: true, eventType: true, locationText: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.weeklyReport.findMany({
        where: {
          userId,
          submittedAt: { gte: fromDate, lte: toDate },
        },
        select: {
          id: true,
          week: true,
          thisWeekActivities: true,
          submittedAt: true,
        },
        orderBy: { submittedAt: 'desc' },
      }),
      prisma.supportRecord.findMany({
        where: {
          userId,
          supportDate: { gte: fromDay, lte: toDay },
        },
        select: {
          id: true,
          supportDate: true,
          supportContent: true,
          supportBy: true,
        },
        orderBy: { supportDate: 'desc' },
      }),
      prisma.sNSPost.findMany({
        where: {
          userId,
          postedAt: { gte: fromDate, lte: toDate },
        },
        select: {
          id: true,
          postedAt: true,
          postType: true,
          theme: true,
          note: true,
        },
        orderBy: { postedAt: 'desc' },
      }),
      prisma.contactHistory.findMany({
        where: {
          userId,
          date: { gte: fromDay, lte: toDay },
        },
        include: {
          contact: { select: { name: true } },
        },
        orderBy: { date: 'desc' },
      }),
      prisma.inspection.findMany({
        where: {
          userId,
          date: { gte: fromDay, lte: toDay },
        },
        select: {
          id: true,
          date: true,
          destination: true,
          purpose: true,
        },
        orderBy: { date: 'desc' },
      }),
    ]);

    type TimelineItem = {
      kind: string;
      occurredAt: string;
      title: string;
      detail: string;
      link?: string;
    };

    const items: TimelineItem[] = [];

    for (const s of schedules) {
      const day = s.startDate;
      const desc = s.activityDescription?.trim() || '';
      const loc = s.locationText?.trim();
      const headline = desc.split(/[。\n]/)[0]?.trim().slice(0, 80) || '';
      const title = headline || 'スケジュール';
      const detailParts = [desc, loc].filter(Boolean);
      items.push({
        kind: 'SCHEDULE',
        occurredAt: day.toISOString(),
        title,
        detail: detailParts.join(' — ') || '（内容なし）',
        link: '/schedule',
      });
    }

    for (const p of participations) {
      const ev = p.event;
      const typePart = `${eventTypeLabel(ev.eventType)}・${participationTypeLabel(p.participationType)}`;
      const loc = ev.locationText?.trim();
      items.push({
        kind: 'EVENT',
        occurredAt: ev.date.toISOString(),
        title: ev.eventName,
        detail: [typePart, loc].filter(Boolean).join(' — '),
        link: `/events/${ev.id}`,
      });
    }

    for (const w of weeklyReports) {
      const at = w.submittedAt ?? fromDate;
      items.push({
        kind: 'WEEKLY_REPORT',
        occurredAt: at.toISOString(),
        title: `週次報告（${w.week}）`,
        detail: summarizeWeeklyActivitiesJson(w.thisWeekActivities) || '（本文なし）',
        link: '/reports/weekly',
      });
    }

    for (const r of supportRecords) {
      const plain = stripHtml(r.supportContent);
      items.push({
        kind: 'SUPPORT_RECORD',
        occurredAt: r.supportDate.toISOString(),
        title: '支援記録',
        detail: [plain || '（内容なし）', r.supportBy ? `記録: ${r.supportBy}` : ''].filter(Boolean).join(' — '),
      });
    }

    for (const post of snsPosts) {
      const title = post.theme?.trim() || `SNS投稿（${post.postType}）`;
      const detail = post.note?.trim() || '';
      items.push({
        kind: 'SNS_POST',
        occurredAt: post.postedAt.toISOString(),
        title,
        detail: detail || '（備考なし）',
        link: '/sns-posts',
      });
    }

    for (const h of contactHistories) {
      const name = h.contact?.name?.trim() || '（無名）';
      const plain = stripHtml(h.content);
      items.push({
        kind: 'CONTACT_HISTORY',
        occurredAt: h.date.toISOString(),
        title: `町民データベース: ${name}`,
        detail: plain || '（内容なし）',
        link: '/contacts',
      });
    }

    for (const ins of inspections) {
      items.push({
        kind: 'INSPECTION',
        occurredAt: ins.date.toISOString(),
        title: `視察: ${ins.destination}`,
        detail: ins.purpose?.replace(/\s+/g, ' ').trim() || '（目的なし）',
        link: '/inspections',
      });
    }

    items.sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());

    res.json({
      user: {
        id: target.id,
        name: target.name,
        avatarColor: target.avatarColor,
        avatarLetter: target.avatarLetter,
      },
      range: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        days: DAYS_MEMBER_TIMELINE,
      },
      items,
    });
  } catch (error) {
    console.error('Member timeline error:', error);
    res.status(500).json({ error: '出来事の取得に失敗しました' });
  }
});

// 支援記録一覧取得（SUPPORTのみ）
router.get('/', authorize('SUPPORT', 'MASTER'), async (req: AuthRequest, res) => {
  try {
    const records = await prisma.supportRecord.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarColor: true,
          },
        },
        monthlyReport: {
          select: {
            id: true,
            month: true,
          },
        },
      },
      orderBy: { supportDate: 'desc' },
    });

    res.json(records);
  } catch (error) {
    console.error('Get support records error:', error);
    res.status(500).json({ error: '支援記録の取得に失敗しました' });
  }
});

// 支援記録作成（SUPPORT/MASTERのみ）
router.post('/', authorize('SUPPORT', 'MASTER'), async (req: AuthRequest, res) => {
  try {
    const data = supportRecordSchema.parse(req.body);

    // 現在のユーザー情報を取得
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { name: true },
    });

    // 支援対象者がメンバーか確認
    const targetUser = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { role: true, name: true },
    });

    if (!targetUser || targetUser.role !== 'MEMBER') {
      return res.status(400).json({ error: '支援対象者はメンバーのみです' });
    }

    // テスト用メンバー（さとうだいち）を除外
    if (targetUser.name === 'さとうだいち' && targetUser.role === 'MEMBER') {
      return res.status(400).json({ error: 'このユーザーは選択できません' });
    }

    // 支援記録を作成
    const record = await prisma.supportRecord.create({
      data: {
        userId: data.userId,
        supportDate: new Date(data.supportDate),
        supportContent: data.supportContent,
        supportBy: currentUser?.name || req.user!.email, // 現在のユーザー名を自動設定
        monthlyReportId: data.monthlyReportId || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarColor: true,
          },
        },
        monthlyReport: {
          select: {
            id: true,
            month: true,
          },
        },
      },
    });

    res.status(201).json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create support record error:', error);
    res.status(500).json({ error: '支援記録の作成に失敗しました' });
  }
});

// 支援記録更新（SUPPORT/MASTERのみ）
router.put('/:id', authorize('SUPPORT', 'MASTER'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = supportRecordSchema.parse(req.body);

    // 現在のユーザー情報を取得
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { name: true },
    });

    // 支援対象者がメンバーか確認
    const targetUser = await prisma.user.findUnique({
      where: { id: data.userId },
      select: { role: true, name: true },
    });

    if (!targetUser || targetUser.role !== 'MEMBER') {
      return res.status(400).json({ error: '支援対象者はメンバーのみです' });
    }

    // テスト用メンバー（さとうだいち）を除外
    if (targetUser.name === 'さとうだいち' && targetUser.role === 'MEMBER') {
      return res.status(400).json({ error: 'このユーザーは選択できません' });
    }

    // 既存のレコードを取得
    const existingRecord = await prisma.supportRecord.findUnique({
      where: { id },
    });

    const record = await prisma.supportRecord.update({
      where: { id },
      data: {
        userId: data.userId,
        supportDate: new Date(data.supportDate),
        supportContent: data.supportContent,
        supportBy: currentUser?.name || req.user!.email, // 現在のユーザー名を自動設定
        monthlyReportId: data.monthlyReportId !== undefined ? data.monthlyReportId : existingRecord?.monthlyReportId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarColor: true,
          },
        },
        monthlyReport: {
          select: {
            id: true,
            month: true,
          },
        },
      },
    });

    res.json(record);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update support record error:', error);
    res.status(500).json({ error: '支援記録の更新に失敗しました' });
  }
});

// 支援記録削除（SUPPORTのみ）
router.delete('/:id', authorize('SUPPORT', 'MASTER'), async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    await prisma.supportRecord.delete({
      where: { id },
    });

    res.json({ message: '支援記録を削除しました' });
  } catch (error) {
    console.error('Delete support record error:', error);
    res.status(500).json({ error: '支援記録の削除に失敗しました' });
  }
});

export default router;

