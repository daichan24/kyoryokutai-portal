import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const citizenSchema = z.object({
  name: z.string().min(1, '氏名は必須です'),
  organization: z.string().optional(),
  category: z.string().optional(),
  relatedMembers: z.array(z.string()).default([]),
  relationshipType: z.enum(['協力的', '要注意', '未知', '未登録']).optional(),
  memo: z.string().optional(),
  role: z.enum(['現役', 'OB', 'サポート', '役場']).optional(),
  startYear: z.number().int().min(2000).max(2100).optional(),
  endYear: z.number().int().min(2000).max(2100).optional(),
  tags: z.array(z.string()).default([]),
  instagramUrl: z.string().optional(),
});

function addStatus(contact: any) {
  let status = '在籍中';
  if (contact.endYear && new Date().getFullYear() > contact.endYear) status = '任期終了';
  return { ...contact, status };
}

// 一覧取得
router.get('/', async (req: AuthRequest, res) => {
  try {
    const orderBy = (req.query.orderBy as string) || 'createdAt';
    const limitParam = req.query.limit;
    const limit = limitParam != null ? Math.min(Math.max(parseInt(String(limitParam), 10) || 0, 1), 100) : undefined;

    const contacts = await prisma.contact.findMany({
      include: {
        creator: { select: { id: true, name: true } },
        histories: { take: 3, orderBy: { date: 'desc' } },
      },
      orderBy: orderBy === 'updatedAt' ? { updatedAt: 'desc' } : { createdAt: 'desc' },
      ...(limit != null && limit > 0 ? { take: limit } : {}),
    });

    res.json(contacts.map(addStatus));
  } catch (error: any) {
    console.error('Get citizens error:', error);
    res.status(500).json({ error: '町民情報の取得に失敗しました', details: error?.message });
  }
});

// 詳細取得
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: req.params.id },
      include: {
        creator: { select: { id: true, name: true } },
        histories: {
          include: {
            user: { select: { id: true, name: true } },
            project: { select: { id: true, projectName: true } },
          },
          orderBy: { date: 'desc' },
        },
      },
    });
    if (!contact) return res.status(404).json({ error: '町民情報が見つかりません' });
    res.json(addStatus(contact));
  } catch (error: any) {
    console.error('Get citizen error:', error);
    res.status(500).json({ error: '町民情報の取得に失敗しました', details: error?.message });
  }
});

// 新規作成
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = citizenSchema.parse(req.body);
    const contact = await prisma.contact.create({
      data: {
        createdBy: req.user!.id,
        name: data.name,
        organization: data.organization || null,
        category: data.category || null,
        relatedMembers: data.relatedMembers || [],
        relationshipType: data.relationshipType || null,
        memo: data.memo || null,
        tags: data.tags || [],
        role: data.role || null,
        startYear: data.startYear || null,
        endYear: data.endYear || null,
        instagramUrl: data.instagramUrl || null,
      },
      include: { creator: { select: { id: true, name: true } } },
    });
    res.status(201).json(addStatus(contact));
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'バリデーションエラー', details: error.errors });
    }
    console.error('Create citizen error:', error);
    res.status(500).json({ error: '町民情報の保存に失敗しました', details: error?.message });
  }
});

// 更新
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const data = citizenSchema.parse(req.body);
    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data: {
        name: data.name,
        organization: data.organization || null,
        category: data.category || null,
        relatedMembers: data.relatedMembers || [],
        relationshipType: data.relationshipType || null,
        memo: data.memo || null,
        tags: data.tags || [],
        role: data.role || null,
        startYear: data.startYear || null,
        endYear: data.endYear || null,
        instagramUrl: data.instagramUrl || null,
      },
      include: { creator: { select: { id: true, name: true } } },
    });
    res.json(addStatus(contact));
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'バリデーションエラー', details: error.errors });
    }
    console.error('Update citizen error:', error);
    res.status(500).json({ error: '町民情報の更新に失敗しました', details: error?.message });
  }
});

// 削除
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.contact.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: '町民情報が見つかりません' });
    await prisma.contact.delete({ where: { id: req.params.id } });
    res.json({ message: '削除しました' });
  } catch (error: any) {
    console.error('Delete citizen error:', error);
    res.status(500).json({ error: '町民情報の削除に失敗しました', details: error?.message });
  }
});

export default router;
