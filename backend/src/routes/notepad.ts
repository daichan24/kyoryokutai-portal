import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const MAX_PAGES = 30;
const MAX_CONTENT_LENGTH = 10000; // HTML込みで余裕を持たせる（日本語3000文字相当）

const notepadSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().max(MAX_CONTENT_LENGTH).optional(),
  order: z.number().int().optional(),
});

// 一覧取得
router.get('/', async (req: AuthRequest, res) => {
  try {
    const notepads = await prisma.notepad.findMany({
      where: { userId: req.user!.id },
      orderBy: [{ order: 'asc' }, { updatedAt: 'desc' }],
      select: { id: true, title: true, order: true, createdAt: true, updatedAt: true },
    });
    res.json(notepads);
  } catch (error) {
    console.error('Get notepads error:', error);
    res.status(500).json({ error: 'メモ帳の取得に失敗しました' });
  }
});

// 単一取得
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const notepad = await prisma.notepad.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!notepad) return res.status(404).json({ error: 'メモが見つかりません' });
    res.json(notepad);
  } catch (error) {
    console.error('Get notepad error:', error);
    res.status(500).json({ error: 'メモの取得に失敗しました' });
  }
});

// 新規作成
router.post('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const count = await prisma.notepad.count({ where: { userId } });
    if (count >= MAX_PAGES) {
      return res.status(400).json({ error: `メモ帳は最大${MAX_PAGES}ページまでです` });
    }

    const data = notepadSchema.parse(req.body);

    // タイトル未入力時は「メモN」を自動設定
    let title = data.title?.trim() || '';
    if (!title) {
      title = `メモ${count + 1}`;
    }

    const notepad = await prisma.notepad.create({
      data: {
        userId,
        title,
        content: data.content || '',
        order: data.order ?? count,
      },
    });
    res.status(201).json(notepad);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create notepad error:', error);
    res.status(500).json({ error: 'メモの作成に失敗しました' });
  }
});

// 更新
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const existing = await prisma.notepad.findFirst({
      where: { id: req.params.id, userId },
    });
    if (!existing) return res.status(404).json({ error: 'メモが見つかりません' });

    const data = notepadSchema.parse(req.body);

    // タイトル未入力時は既存タイトルを維持、または「メモN」
    let title = data.title?.trim();
    if (title === undefined) {
      title = existing.title;
    } else if (!title) {
      const count = await prisma.notepad.count({ where: { userId } });
      title = `メモ${count}`;
    }

    const updated = await prisma.notepad.update({
      where: { id: req.params.id },
      data: {
        title,
        content: data.content !== undefined ? data.content : existing.content,
        order: data.order !== undefined ? data.order : existing.order,
      },
    });
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update notepad error:', error);
    res.status(500).json({ error: 'メモの更新に失敗しました' });
  }
});

// 削除
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const existing = await prisma.notepad.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });
    if (!existing) return res.status(404).json({ error: 'メモが見つかりません' });
    await prisma.notepad.delete({ where: { id: req.params.id } });
    res.json({ message: '削除しました' });
  } catch (error) {
    console.error('Delete notepad error:', error);
    res.status(500).json({ error: 'メモの削除に失敗しました' });
  }
});

export default router;
