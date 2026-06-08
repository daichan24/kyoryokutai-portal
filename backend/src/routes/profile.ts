import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const updateProfileSchema = z.object({
  avatarColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/i).optional(),
  avatarLetter: z.union([z.string().max(1), z.null(), z.literal('')]).optional(),
  darkMode: z.boolean().optional(),
  department: z.string().optional().nullable(),
  missionType: z.enum(['FREE', 'MISSION']).optional().nullable(),
  wishesEnabled: z.boolean().optional(),
  notepadEnabled: z.boolean().optional(),
  contactsSidebarEnabled: z.boolean().optional(),
  emailNotificationsEnabled: z.boolean().optional(),
  scheduleWeekStartsOn: z.union([z.literal(0), z.literal(1)]).optional(),
  scheduleHiddenLocationIds: z.array(z.string()).optional(),
});

/**
 * PUT /api/me/profile
 * プロフィールの表示設定（アイコン色・1文字・ダークモード）を更新
 */
router.put('/', async (req: AuthRequest, res) => {
  try {
    console.log('[API] PUT /api/me/profile - Request body:', req.body);
    
    const raw = updateProfileSchema.safeParse(req.body);
    if (!raw.success) {
      console.error('[API] Validation error:', raw.error.errors);
      return res.status(400).json({ error: 'Invalid input', details: raw.error.errors });
    }
    const data = raw.data;

    const updateData: { avatarColor?: string; avatarLetter?: string | null; darkMode?: boolean; department?: string | null; missionType?: 'FREE' | 'MISSION' | null; wishesEnabled?: boolean; notepadEnabled?: boolean; contactsSidebarEnabled?: boolean; emailNotificationsEnabled?: boolean; scheduleWeekStartsOn?: 0 | 1; scheduleHiddenLocationIds?: string[] } = {};
    if (data.avatarColor !== undefined) updateData.avatarColor = data.avatarColor;
    if (data.avatarLetter !== undefined) {
      updateData.avatarLetter = (data.avatarLetter === '' || data.avatarLetter === null || data.avatarLetter === undefined) ? null : String(data.avatarLetter).slice(0, 1);
    }
    if (data.darkMode !== undefined) updateData.darkMode = data.darkMode;
    if (data.department !== undefined) updateData.department = data.department === '' ? null : data.department;
    if (data.missionType !== undefined) updateData.missionType = data.missionType;
    if (data.wishesEnabled !== undefined) updateData.wishesEnabled = data.wishesEnabled;
    if (data.notepadEnabled !== undefined) updateData.notepadEnabled = data.notepadEnabled;
    if (data.contactsSidebarEnabled !== undefined) updateData.contactsSidebarEnabled = data.contactsSidebarEnabled;
    if (data.emailNotificationsEnabled !== undefined) updateData.emailNotificationsEnabled = data.emailNotificationsEnabled;
    if (data.scheduleWeekStartsOn !== undefined) updateData.scheduleWeekStartsOn = data.scheduleWeekStartsOn;
    if (data.scheduleHiddenLocationIds !== undefined) updateData.scheduleHiddenLocationIds = [...new Set(data.scheduleHiddenLocationIds)];

    console.log('[API] Update data:', updateData);

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: updateData,
      select: {
        avatarColor: true,
        avatarLetter: true,
        darkMode: true,
        department: true,
        missionType: true,
        wishesEnabled: true,
        notepadEnabled: true,
        contactsSidebarEnabled: true,
        emailNotificationsEnabled: true,
        scheduleWeekStartsOn: true,
        scheduleHiddenLocationIds: true,
      },
    });

    console.log('[API] Profile updated successfully:', user);
    res.json(user);
  } catch (error) {
    console.error('[API] Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile', message: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
