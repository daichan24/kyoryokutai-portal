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
      displayMode: z.enum(['view-only', 'view-with-add', 'add-only']).optional(),
      size: z.enum(['S', 'M', 'L']).optional(),
      columnSpan: z.union([z.literal(1), z.literal(2)]).optional(),
      contactCount: z.number().int().min(1).max(3).optional(), // 町民データベースの表示人数
      order: z.number(),
    })
  ),
});

// 全ウィジェットのテンプレート（カスタマイズ画面に必ず表示するため）
const FULL_WIDGET_TEMPLATE = [
  { key: 'snsHistory', enabled: true, displayMode: 'view-with-add' as const, showAddButton: true, size: 'M' as const, columnSpan: 2 as const, order: 1 },
  { key: 'taskRequests', enabled: true, displayMode: 'view-only' as const, showAddButton: false, size: 'L' as const, columnSpan: 2 as const, order: 2 },
  { key: 'projects', enabled: false, displayMode: 'view-only' as const, showAddButton: false, size: 'M' as const, columnSpan: 2 as const, order: 3 },
  { key: 'goals', enabled: false, displayMode: 'view-only' as const, showAddButton: false, size: 'M' as const, columnSpan: 1 as const, order: 4 },
  { key: 'tasks', enabled: false, displayMode: 'view-with-add' as const, showAddButton: true, size: 'M' as const, columnSpan: 2 as const, order: 5 },
  { key: 'events', enabled: false, displayMode: 'view-with-add' as const, showAddButton: true, size: 'M' as const, columnSpan: 2 as const, order: 6 },
  { key: 'contacts', enabled: false, displayMode: 'add-only' as const, showAddButton: false, size: 'M' as const, columnSpan: 2 as const, order: 7 },
  { key: 'eventParticipation', enabled: false, displayMode: 'view-only' as const, showAddButton: false, size: 'L' as const, columnSpan: 1 as const, order: 8 },
];

// デフォルト設定（role別）
const getDefaultConfig = (role: string) => {
  const base = FULL_WIDGET_TEMPLATE.map((w, i) => ({ ...w, order: i + 1 }));

  if (role === 'MEMBER') {
    return {
      widgets: [
        { ...base[0], enabled: true },
        { ...base[1], enabled: false },
        { ...base[2], enabled: true },
        { ...base[3], enabled: true },
        { ...base[4], enabled: true },
        { ...base[5], enabled: true },
      ],
    };
  } else if (role === 'SUPPORT' || role === 'GOVERNMENT') {
    return {
      widgets: [
        { ...base[0], enabled: false },
        { ...base[1], enabled: true },
        { ...base[2], enabled: true },
        { ...base[3], enabled: false },
        { ...base[4], enabled: true },
        { ...base[5], enabled: true },
        { ...base[6], enabled: true },
        { ...base[7], enabled: true },
      ],
    };
  } else if (role === 'MASTER') {
    return { widgets: base.map((w, i) => ({ ...w, enabled: true, order: i + 1 })) };
  }

  return { widgets: base };
};

// 保存済み設定とテンプレートをマージし、常に全8件を返す
function mergeWithTemplate(saved: { widgets: any[] } | null, role: string): { widgets: any[] } {
  const defaults = getDefaultConfig(role);
  if (!saved?.widgets?.length) return defaults;

  const byKey = new Map<string, any>();
  for (const w of saved.widgets) byKey.set(w.key, w);

  const merged = FULL_WIDGET_TEMPLATE.map((t, i) => {
    const savedW = byKey.get(t.key);
    if (savedW) {
      return {
        ...t,
        ...savedW,
        key: t.key,
        order: savedW.order ?? i + 1,
      };
    }
    return { ...t, order: i + 1 };
  });

  return { widgets: merged.sort((a, b) => a.order - b.order) };
}

/**
 * GET /api/me/dashboard-config
 * ダッシュボード設定を取得
 */
router.get('/', async (req: AuthRequest, res) => {
  try {
    console.log('[API] GET /api/me/dashboard-config user:', req.user?.id, req.user?.role);
    
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: {
        role: true,
        dashboardConfigJson: true,
      },
    });

    if (!user) {
      console.error('[API] User not found:', req.user?.id);
      return res.status(404).json({ error: 'User not found' });
    }

    // 保存済みがあればテンプレートとマージして常に全8ウィジェット返す（不足分を補完）
    const config = mergeWithTemplate(
      user.dashboardConfigJson as any,
      user.role
    );

    console.log('[API] Returning config for role:', user.role, 'hasCustomConfig:', !!user.dashboardConfigJson);
    res.json(config);
  } catch (error) {
    console.error('[API] Get dashboard config error:', error);
    // エラー時もデフォルト設定を返す（500ではなく200で返す）
    const defaultConfig = getDefaultConfig(req.user?.role || 'MEMBER');
    res.json(defaultConfig);
  }
});

/**
 * PUT /api/me/dashboard-config
 * ダッシュボード設定を保存
 */
router.put('/', async (req: AuthRequest, res) => {
  try {
    console.log('[API] PUT /api/me/dashboard-config user:', req.user?.id, req.user?.role);
    
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

    console.log('[API] Dashboard config saved successfully');
    res.json(user.dashboardConfigJson);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('[API] Validation error:', error.errors);
      return res.status(400).json({ error: 'Invalid config format', details: error.errors });
    }
    console.error('[API] Update dashboard config error:', error);
    res.status(500).json({ error: 'Failed to update dashboard config' });
  }
});

export default router;

