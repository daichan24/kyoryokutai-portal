import { Router } from 'express';
import { z } from 'zod';
import { authenticate, AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';

const router = Router();

const categorySchema = z.object({
  name: z.string().min(1).max(200),
  type: z.enum(['EVENT', 'MEETING']).optional(),
  description: z.string().max(10000).optional().nullable(),
});

const folderSchema = z.object({
  categoryId: z.string().uuid(),
  fiscalYear: z.number().int().min(2000).max(2100),
  title: z.string().min(1).max(200),
  description: z.string().max(10000).optional().nullable(),
});

const folderUpdateSchema = z.object({
  title: z.string().min(1).max(200),
  fiscalYear: z.number().int().min(2000).max(2100),
  description: z.string().max(10000).optional().nullable(),
});

const documentSchema = z.object({
  folderId: z.string().uuid(),
  title: z.string().min(1).max(200),
  content: z.string().max(100000),
  relatedContactIds: z.array(z.string().uuid()).optional(),
  relatedMemberIds: z.array(z.string().uuid()).optional(),
  budget: z.number().int().min(0).optional().nullable(),
  venue: z.string().max(200).optional().nullable(),
});

const documentUpdateSchema = documentSchema.omit({ folderId: true });

// カテゴリ一覧取得
router.get('/categories', authenticate, async (req: AuthRequest, res) => {
  try {
    const categories = await prisma.handoverCategory.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        folders: {
          orderBy: { fiscalYear: 'desc' },
          include: {
            documents: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });
    res.json(categories);
  } catch (error) {
    console.error('Fetch handover categories error:', error);
    res.status(500).json({ error: 'カテゴリの取得に失敗しました' });
  }
});

// カテゴリ作成
router.post('/categories', authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, type, description } = categorySchema.parse(req.body);
    const maxOrder = await prisma.handoverCategory.findFirst({
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const category = await prisma.handoverCategory.create({
      data: {
        name,
        type: type || 'EVENT',
        description,
        sortOrder: (maxOrder?.sortOrder || 0) + 1,
      },
    });
    res.json(category);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    console.error('Create handover category error:', error);
    res.status(500).json({ error: 'カテゴリの作成に失敗しました' });
  }
});

// カテゴリ更新
router.put('/categories/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, type, description } = categorySchema.parse(req.body);
    const category = await prisma.handoverCategory.update({
      where: { id },
      data: { name, type, description },
    });
    res.json(category);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    console.error('Update handover category error:', error);
    res.status(500).json({ error: 'カテゴリの更新に失敗しました' });
  }
});

// カテゴリ削除
router.delete('/categories/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await prisma.handoverCategory.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete handover category error:', error);
    res.status(500).json({ error: 'カテゴリの削除に失敗しました' });
  }
});

// フォルダ作成
router.post('/folders', authenticate, async (req: AuthRequest, res) => {
  try {
    const { categoryId, fiscalYear, title, description } = folderSchema.parse(req.body);
    const maxOrder = await prisma.handoverFolder.findFirst({
      where: { categoryId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const folder = await prisma.handoverFolder.create({
      data: {
        categoryId,
        fiscalYear,
        title,
        description,
        sortOrder: (maxOrder?.sortOrder || 0) + 1,
      },
    });
    res.json(folder);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    console.error('Create handover folder error:', error);
    res.status(500).json({ error: 'フォルダの作成に失敗しました' });
  }
});

// フォルダ更新
router.put('/folders/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { title, description, fiscalYear } = folderUpdateSchema.parse(req.body);
    const folder = await prisma.handoverFolder.update({
      where: { id },
      data: { title, description, fiscalYear },
    });
    res.json(folder);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    console.error('Update handover folder error:', error);
    res.status(500).json({ error: 'フォルダの更新に失敗しました' });
  }
});

// フォルダ削除
router.delete('/folders/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await prisma.handoverFolder.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete handover folder error:', error);
    res.status(500).json({ error: 'フォルダの削除に失敗しました' });
  }
});

// 文書一覧取得（フォルダ内）
router.get('/folders/:folderId/documents', authenticate, async (req: AuthRequest, res) => {
  try {
    const { folderId } = req.params;
    const documents = await prisma.handoverDocument.findMany({
      where: { folderId },
      orderBy: { sortOrder: 'asc' },
      include: {
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
      },
    });
    res.json(documents);
  } catch (error) {
    console.error('Fetch handover documents error:', error);
    res.status(500).json({ error: '文書一覧の取得に失敗しました' });
  }
});

// 文書詳細取得
router.get('/documents/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const document = await prisma.handoverDocument.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
        folder: {
          include: {
            category: true,
          },
        },
      },
    });
    res.json(document);
  } catch (error) {
    console.error('Fetch handover document error:', error);
    res.status(500).json({ error: '文書の取得に失敗しました' });
  }
});

// 文書作成
router.post('/documents', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { folderId, title, content, relatedContactIds, relatedMemberIds, budget, venue } = documentSchema.parse(req.body);

    const maxOrder = await prisma.handoverDocument.findFirst({
      where: { folderId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const document = await prisma.handoverDocument.create({
      data: {
        folderId,
        title,
        content,
        relatedContactIds: relatedContactIds || [],
        relatedMemberIds: relatedMemberIds || [],
        budget,
        venue,
        sortOrder: (maxOrder?.sortOrder || 0) + 1,
        createdById: userId,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });
    res.json(document);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    console.error('Create handover document error:', error);
    res.status(500).json({ error: '文書の作成に失敗しました' });
  }
});

// 文書更新
router.put('/documents/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { title, content, relatedContactIds, relatedMemberIds, budget, venue } = documentUpdateSchema.parse(req.body);

    const document = await prisma.handoverDocument.update({
      where: { id },
      data: {
        title,
        content,
        relatedContactIds,
        relatedMemberIds,
        budget,
        venue,
        updatedById: userId,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        updatedBy: { select: { id: true, name: true } },
      },
    });
    res.json(document);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    console.error('Update handover document error:', error);
    res.status(500).json({ error: '文書の更新に失敗しました' });
  }
});

// 文書削除
router.delete('/documents/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await prisma.handoverDocument.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete handover document error:', error);
    res.status(500).json({ error: '文書の削除に失敗しました' });
  }
});

export default router;
