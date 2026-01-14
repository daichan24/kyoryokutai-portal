import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const dashboardConfigSchema = z.object({
  widgets: z.array(
    z.object({
      key: z.string(),
      enabled: z.boolean(),
      showAddButton: z.boolean().optional(),
      size: z.enum(['S', 'M', 'L']).optional(),
      order: z.number(),
    })
  ),
});

// デフォルト設定（role別）
const getDefaultConfig = (role: string) => {
  const baseWidgets = [
    { key: 'snsHistory', enabled: true, showAddButton: true, size: 'M' as const, order: 1 },
    { key: 'taskRequests', enabled: true, showAddButton: false, size: 'L' as const, order: 2 },
    { key: 'projects', enabled: false, showAddButton: false, size: 'M' as const, order: 3 },
    { key: 'goals', enabled: false, showAddButton: false, size: 'M' as const, order: 4 },
  ];

  // role別のカスタマイズ
  if (role === 'MEMBER') {
    return {
      widgets: [
        { ...baseWidgets[0], enabled: true, showAddButton: true }, // SNS
        { ...baseWidgets[1], enabled: false }, // タスク依頼（MEMBERは受ける側なので非表示）
        { ...baseWidgets[2], enabled: true }, // プロジェクト
        { ...baseWidgets[3], enabled: true }, // 目標
      ],
    };
  } else if (role === 'SUPPORT' || role === 'GOVERNMENT') {
    return {
      widgets: [
        { ...baseWidgets[0], enabled: false }, // SNS
        { ...baseWidgets[1], enabled: true, showAddButton: true }, // タスク依頼（作成可能）
        { ...baseWidgets[2], enabled: true }, // プロジェクト
        { ...baseWidgets[3], enabled: false }, // 目標
      ],
    };
  } else if (role === 'MASTER') {
    return {
      widgets: baseWidgets.map((w, i) => ({ ...w, enabled: true, order: i + 1 })),
    };
  }

  return { widgets: baseWidgets };
};

/**
 * GET /api/me/dashboard-config
 * ダッシュボード設定を取得
 */
router.get('/', async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        role: true,
        dashboardConfigJson: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 設定が無い場合はデフォルトを返す
    const config = user.dashboardConfigJson
      ? (user.dashboardConfigJson as any)
      : getDefaultConfig(user.role);

    res.json(config);
  } catch (error) {
    console.error('Get dashboard config error:', error);
    res.status(500).json({ error: 'Failed to get dashboard config' });
  }
});

/**
 * PUT /api/me/dashboard-config
 * ダッシュボード設定を保存
 */
router.put('/', async (req: AuthRequest, res) => {
  try {
    const data = dashboardConfigSchema.parse(req.body);

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        dashboardConfigJson: data,
      },
      select: {
        dashboardConfigJson: true,
      },
    });

    res.json(user.dashboardConfigJson);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid config format', details: error.errors });
    }
    console.error('Update dashboard config error:', error);
    res.status(500).json({ error: 'Failed to update dashboard config' });
  }
});

export default router;

