import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const accountSchema = z.object({
  platform: z.string().min(1).max(50),
  accountName: z.string().min(1).max(200),
  displayName: z.string().max(200).optional().nullable(),
  url: z.string().url().optional().nullable().or(z.literal('')),
  isDefault: z.boolean().optional().default(false),
});

// 自分のSNSアカウント一覧取得
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.query.userId as string | undefined;
    const isStaff = ['MASTER', 'SUPPORT', 'GOVERNMENT'].includes(req.user!.role);

    // スタッフは他ユーザーのアカウントも取得可能
    const targetUserId = (isStaff && userId) ? userId : req.user!.id;

    const accounts = await prisma.sNSAccount.findMany({
      where: { userId: targetUserId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    res.json(accounts);
  } catch (e: any) {
    console.error('Get SNS accounts error:', e);
    res.status(500).json({ error: 'SNSアカウントの取得に失敗しました' });
  }
});

// 全メンバーのSNSアカウント一覧（スタッフ用）
router.get('/all', async (req: AuthRequest, res) => {
  try {
    const isStaff = ['MASTER', 'SUPPORT', 'GOVERNMENT'].includes(req.user!.role);
    if (!isStaff) return res.status(403).json({ error: '権限がありません' });

    const accounts = await prisma.sNSAccount.findMany({
      include: { user: { select: { id: true, name: true, avatarColor: true } } },
      orderBy: [{ userId: 'asc' }, { isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    res.json(accounts);
  } catch (e: any) {
    console.error('Get all SNS accounts error:', e);
    res.status(500).json({ error: 'SNSアカウントの取得に失敗しました' });
  }
});

// SNSアカウント作成
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = accountSchema.parse(req.body);

    // isDefaultがtrueの場合、他のアカウントのisDefaultをfalseに
    if (data.isDefault) {
      await prisma.sNSAccount.updateMany({
        where: { userId: req.user!.id },
        data: { isDefault: false },
      });
    }

    // 最初のアカウントは自動的にデフォルト
    const existingCount = await prisma.sNSAccount.count({ where: { userId: req.user!.id } });
    const isDefault = existingCount === 0 ? true : (data.isDefault ?? false);

    const account = await prisma.sNSAccount.create({
      data: {
        userId: req.user!.id,
        platform: data.platform,
        accountName: data.accountName,
        displayName: data.displayName || null,
        url: data.url || null,
        isDefault,
      },
    });
    res.status(201).json(account);
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
    console.error('Create SNS account error:', e);
    res.status(500).json({ error: 'SNSアカウントの作成に失敗しました' });
  }
});

// SNSアカウント更新
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.sNSAccount.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: '見つかりません' });
    if (existing.userId !== req.user!.id && req.user!.role !== 'MASTER') {
      return res.status(403).json({ error: '権限がありません' });
    }

    const data = accountSchema.partial().parse(req.body);

    if (data.isDefault) {
      await prisma.sNSAccount.updateMany({
        where: { userId: existing.userId },
        data: { isDefault: false },
      });
    }

    const account = await prisma.sNSAccount.update({
      where: { id: req.params.id },
      data: {
        ...(data.platform !== undefined ? { platform: data.platform } : {}),
        ...(data.accountName !== undefined ? { accountName: data.accountName } : {}),
        ...(data.displayName !== undefined ? { displayName: data.displayName || null } : {}),
        ...(data.url !== undefined ? { url: data.url || null } : {}),
        ...(data.isDefault !== undefined ? { isDefault: data.isDefault } : {}),
      },
    });
    res.json(account);
  } catch (e: any) {
    if (e instanceof z.ZodError) return res.status(400).json({ error: e.errors });
    console.error('Update SNS account error:', e);
    res.status(500).json({ error: 'SNSアカウントの更新に失敗しました' });
  }
});

// SNSアカウント削除
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.sNSAccount.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: '見つかりません' });
    if (existing.userId !== req.user!.id && req.user!.role !== 'MASTER') {
      return res.status(403).json({ error: '権限がありません' });
    }
    await prisma.sNSAccount.delete({ where: { id: req.params.id } });
    res.json({ message: '削除しました' });
  } catch (e: any) {
    console.error('Delete SNS account error:', e);
    res.status(500).json({ error: 'SNSアカウントの削除に失敗しました' });
  }
});

export default router;
