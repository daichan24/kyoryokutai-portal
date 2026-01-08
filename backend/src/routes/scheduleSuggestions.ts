import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import {
  createScheduleWithSuggestions,
  respondToSuggestion,
  getPendingSuggestions,
} from '../services/scheduleService';

const router = Router();
router.use(authenticate);

// バリデーションスキーマ
const createWithSuggestionsSchema = z.object({
  schedule: z.object({
    date: z.string(),
    startTime: z.string(),
    endTime: z.string(),
    activityType: z.enum([
      'STARTUP_PREP',
      'TOWN_HALL_WORK',
      'REGIONAL_SUPPORT',
      'EVENT',
      'SNS_PROMOTION',
      'STUDY',
      'OTHER',
    ]),
    description: z.string(),
    locationId: z.string().optional(),
    projectId: z.string().optional(),
    isPending: z.boolean().optional(),
  }),
  suggestToUserIds: z.array(z.string()).min(1),
});

const respondSchema = z.object({
  response: z.enum(['ACCEPTED', 'DECLINED', 'IGNORED']),
});

// 提案付き予定作成
router.post('/with-suggestions', async (req: AuthRequest, res) => {
  try {
    const data = createWithSuggestionsSchema.parse(req.body);

    const result = await createScheduleWithSuggestions(
      {
        ...data.schedule,
        date: new Date(data.schedule.date),
        userId: req.user!.id,
      },
      data.suggestToUserIds
    );

    res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create schedule with suggestions error:', error);
    res.status(500).json({ error: 'Failed to create schedule with suggestions' });
  }
});

// 自分への提案一覧取得
router.get('/pending', async (req: AuthRequest, res) => {
  try {
    const suggestions = await getPendingSuggestions(req.user!.id);
    res.json(suggestions);
  } catch (error) {
    console.error('Get pending suggestions error:', error);
    res.status(500).json({ error: 'Failed to get pending suggestions' });
  }
});

// 提案への応答
router.post('/:id/respond', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const data = respondSchema.parse(req.body);

    // 提案が自分宛かチェック
    const suggestion = await prisma.scheduleSuggestion.findUnique({
      where: { id },
    });

    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    if (suggestion.suggestedTo !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const result = await respondToSuggestion(id, data.response as any);

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Respond to suggestion error:', error);
    res.status(500).json({ error: 'Failed to respond to suggestion' });
  }
});

// 提案の削除（主催者のみ）
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    const suggestion = await prisma.scheduleSuggestion.findUnique({
      where: { id },
      include: {
        schedule: true,
      },
    });

    if (!suggestion) {
      return res.status(404).json({ error: 'Suggestion not found' });
    }

    // 主催者のみ削除可能
    if (suggestion.schedule.userId !== req.user!.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await prisma.scheduleSuggestion.delete({
      where: { id },
    });

    res.json({ message: 'Suggestion deleted successfully' });
  } catch (error) {
    console.error('Delete suggestion error:', error);
    res.status(500).json({ error: 'Failed to delete suggestion' });
  }
});

export default router;
