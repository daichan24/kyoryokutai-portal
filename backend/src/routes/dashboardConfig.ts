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
  weeklyScheduleCount: z.union([z.literal(3), z.literal(5), z.literal(10)]).optional(), // 今週のスケジュールの表示数
});

// 全ウィジェットのテンプレート（カスタマイズ画面に必ず表示するため）
// メンバー以外の場合はgoals-personalとgoals-viewを分離
const getFullWidgetTemplate = (role: string) => {
  const base = [
    { key: 'snsHistory', enabled: true, displayMode: 'view-with-add' as const, showAddButton: true, size: 'M' as const, columnSpan: 2 as const, order: 1 },
    { key: 'taskRequests', enabled: true, displayMode: 'view-only' as const, showAddButton: false, size: 'L' as const, columnSpan: 2 as const, order: 2 },
    { key: 'projects', enabled: false, displayMode: 'view-only' as const, showAddButton: false, size: 'M' as const, columnSpan: 2 as const, order: 3 },
    { key: 'tasks', enabled: false, displayMode: 'view-with-add' as const, showAddButton: true, size: 'M' as const, columnSpan: 2 as const, order: 5 },
    { key: 'events', enabled: false, displayMode: 'view-with-add' as const, showAddButton: true, size: 'M' as const, columnSpan: 2 as const, order: 6 },
    { key: 'contacts', enabled: false, displayMode: 'add-only' as const, showAddButton: false, size: 'M' as const, columnSpan: 2 as const, order: 7 },
    { key: 'eventParticipation', enabled: false, displayMode: 'view-only' as const, showAddButton: false, size: 'L' as const, columnSpan: 1 as const, order: 8 },
    { key: 'nextWish', enabled: false, displayMode: 'view-only' as const, showAddButton: false, size: 'M' as const, columnSpan: 2 as const, order: 9 },
  ];
  
  // メンバー以外の場合はgoals-personalとgoals-viewを追加
  if (role !== 'MEMBER') {
    return [
      ...base.slice(0, 3),
      { key: 'goals-personal', enabled: false, displayMode: 'view-only' as const, showAddButton: false, size: 'M' as const, columnSpan: 1 as const, order: 4 },
      { key: 'goals-view', enabled: false, displayMode: 'view-only' as const, showAddButton: false, size: 'M' as const, columnSpan: 1 as const, order: 4.5 },
      ...base.slice(3),
    ];
  }
  
  // メンバーの場合は従来通りgoalsのみ
  return [
    ...base.slice(0, 3),
    { key: 'goals', enabled: false, displayMode: 'view-only' as const, showAddButton: false, size: 'M' as const, columnSpan: 1 as const, order: 4 },
    ...base.slice(3),
  ];
};

// 後方互換性のため、MEMBER用のテンプレートを保持
const FULL_WIDGET_TEMPLATE = getFullWidgetTemplate('MEMBER');

// デフォルト設定（role別）
const getDefaultConfig = (role: string) => {
  const template = getFullWidgetTemplate(role);
  const base = template.map((w, i) => ({ ...w, order: i + 1 }));

  if (role === 'MEMBER') {
    return {
      widgets: [
        { ...base[0], enabled: true },
        { ...base[1], enabled: false },
        { ...base[2], enabled: true },
        { ...base[3], enabled: true },
        { ...base[4], enabled: true },
        { ...base[5], enabled: true },
        { ...base[6], enabled: false },
        { ...base[7], enabled: false },
        { ...base[8], enabled: false },
      ],
    };
  } else if (role === 'SUPPORT' || role === 'GOVERNMENT') {
    return {
      widgets: [
        { ...base[0], enabled: false },
        { ...base[1], enabled: true },
        { ...base[2], enabled: true },
        { ...base[3], enabled: false }, // goals-personal
        { ...base[4], enabled: false }, // goals-view
        { ...base[5], enabled: true },
        { ...base[6], enabled: true },
        { ...base[7], enabled: true },
        { ...base[8], enabled: true },
        { ...base[9], enabled: false }, // nextWish
      ],
    };
  } else if (role === 'MASTER') {
    return { widgets: base.map((w, i) => ({ ...w, enabled: true, order: i + 1 })) };
  }

  return { widgets: base };
};

// 保存済み設定とテンプレートをマージし、常に全ウィジェットを返す
function mergeWithTemplate(saved: { widgets: any[]; weeklyScheduleCount?: 3 | 5 | 10 } | null, role: string): { widgets: any[]; weeklyScheduleCount?: 3 | 5 | 10 } {
  const defaults = getDefaultConfig(role);
  if (!saved?.widgets?.length) {
    return {
      ...defaults,
      weeklyScheduleCount: saved?.weeklyScheduleCount || 5,
    };
  }

  const byKey = new Map<string, any>();
  for (const w of saved.widgets) byKey.set(w.key, w);

  // 古いgoalsウィジェットをgoals-personalとgoals-viewに変換（メンバー以外の場合）
  if (role !== 'MEMBER' && byKey.has('goals') && !byKey.has('goals-personal') && !byKey.has('goals-view')) {
    const oldGoals = byKey.get('goals');
    byKey.set('goals-personal', { ...oldGoals, key: 'goals-personal', order: oldGoals.order });
    byKey.set('goals-view', { ...oldGoals, key: 'goals-view', order: (oldGoals.order || 0) + 0.5, enabled: false });
    byKey.delete('goals');
  }

  const template = getFullWidgetTemplate(role);
  const merged = template.map((t, i) => {
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

  return {
    widgets: merged.sort((a, b) => a.order - b.order),
    weeklyScheduleCount: saved.weeklyScheduleCount || 5,
  };
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

