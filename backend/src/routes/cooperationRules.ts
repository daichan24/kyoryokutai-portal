import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// 全細則取得
router.get('/', authenticate, async (req, res) => {
  try {
    const rules = await prisma.cooperationRule.findMany({
      orderBy: { fiscalYear: 'desc' },
    });
    res.json(rules);
  } catch (error) {
    console.error('Error fetching cooperation rules:', error);
    res.status(500).json({ error: 'Failed to fetch cooperation rules' });
  }
});

// 特定年度の細則取得
router.get('/:fiscalYear', authenticate, async (req, res) => {
  try {
    const fiscalYear = parseInt(req.params.fiscalYear);
    const rule = await prisma.cooperationRule.findUnique({
      where: { fiscalYear },
    });
    
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    
    res.json(rule);
  } catch (error) {
    console.error('Error fetching cooperation rule:', error);
    res.status(500).json({ error: 'Failed to fetch cooperation rule' });
  }
});

// 細則作成
router.post('/', authenticate, async (req, res) => {
  try {
    const { fiscalYear, title, content, isActive } = req.body;
    const userId = (req as AuthRequest).user?.id;

    // 既存チェック
    const existing = await prisma.cooperationRule.findUnique({
      where: { fiscalYear },
    });

    if (existing) {
      return res.status(400).json({ error: 'Rule for this fiscal year already exists' });
    }

    const rule = await prisma.cooperationRule.create({
      data: {
        fiscalYear,
        title,
        content,
        isActive: isActive ?? true,
        createdById: userId,
        updatedById: userId,
      },
    });

    res.status(201).json(rule);
  } catch (error) {
    console.error('Error creating cooperation rule:', error);
    res.status(500).json({ error: 'Failed to create cooperation rule' });
  }
});

// 細則更新
router.put('/:fiscalYear', authenticate, async (req, res) => {
  try {
    const fiscalYear = parseInt(req.params.fiscalYear);
    const { title, content, isActive } = req.body;
    const userId = (req as AuthRequest).user?.id;

    const rule = await prisma.cooperationRule.update({
      where: { fiscalYear },
      data: {
        title,
        content,
        isActive,
        updatedById: userId,
        version: { increment: 1 },
      },
    });

    res.json(rule);
  } catch (error) {
    console.error('Error updating cooperation rule:', error);
    res.status(500).json({ error: 'Failed to update cooperation rule' });
  }
});

// 細則削除
router.delete('/:fiscalYear', authenticate, async (req, res) => {
  try {
    const fiscalYear = parseInt(req.params.fiscalYear);

    await prisma.cooperationRule.delete({
      where: { fiscalYear },
    });

    res.json({ message: 'Rule deleted successfully' });
  } catch (error) {
    console.error('Error deleting cooperation rule:', error);
    res.status(500).json({ error: 'Failed to delete cooperation rule' });
  }
});

export default router;
