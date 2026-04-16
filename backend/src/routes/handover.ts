import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import prisma from '../lib/prisma';

const router = Router();

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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// カテゴリ作成
router.post('/categories', authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, type, description } = req.body;
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// カテゴリ更新
router.put('/categories/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, type, description } = req.body;
    const category = await prisma.handoverCategory.update({
      where: { id },
      data: { name, type, description },
    });
    res.json(category);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// カテゴリ削除
router.delete('/categories/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await prisma.handoverCategory.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// フォルダ作成
router.post('/folders', authenticate, async (req: AuthRequest, res) => {
  try {
    const { categoryId, fiscalYear, title, description } = req.body;
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// フォルダ更新
router.put('/folders/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { title, description, fiscalYear } = req.body;
    const folder = await prisma.handoverFolder.update({
      where: { id },
      data: { title, description, fiscalYear },
    });
    res.json(folder);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// フォルダ削除
router.delete('/folders/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await prisma.handoverFolder.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 文書作成
router.post('/documents', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { folderId, title, content, relatedContactIds, relatedMemberIds, budget, venue } = req.body;
    
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 文書更新
router.put('/documents/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { title, content, relatedContactIds, relatedMemberIds, budget, venue } = req.body;
    
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 文書削除
router.delete('/documents/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await prisma.handoverDocument.delete({ where: { id } });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
