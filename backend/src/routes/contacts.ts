import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const contactSchema = z.object({
  name: z.string().min(1),
  organization: z.string().optional(),
  title: z.string().optional(),
  contactInfo: z.string().optional(),
  memo: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

const historySchema = z.object({
  date: z.string(),
  content: z.string().min(1),
  projectId: z.string().optional(),
});

// 町民一覧取得
router.get('/', async (req: AuthRequest, res) => {
  try {
    const { search, tag } = req.query;
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string } },
        { organization: { contains: search as string } },
      ];
    }

    if (tag) {
      where.tags = { has: tag as string };
    }

    const contacts = await prisma.contact.findMany({
      where,
      include: {
        creator: { select: { id: true, name: true } },
        histories: {
          take: 3,
          orderBy: { date: 'desc' },
          include: { user: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(contacts);
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({ error: 'Failed to get contacts' });
  }
});

// 町民詳細取得
router.get('/:id', async (req, res) => {
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: req.params.id },
      include: {
        creator: true,
        histories: {
          include: {
            user: true,
            project: { select: { id: true, projectName: true } },
          },
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json(contact);
  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({ error: 'Failed to get contact' });
  }
});

// 町民作成
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = contactSchema.parse(req.body);

    const contact = await prisma.contact.create({
      data: {
        createdBy: req.user!.id,
        name: data.name,
        organization: data.organization,
        title: data.title,
        contactInfo: data.contactInfo,
        memo: data.memo,
        tags: data.tags,
      },
      include: { creator: true },
    });

    res.status(201).json(contact);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create contact error:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

// 町民更新
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const data = contactSchema.parse(req.body);

    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data: {
        name: data.name,
        organization: data.organization,
        title: data.title,
        contactInfo: data.contactInfo,
        memo: data.memo,
        tags: data.tags,
      },
      include: { creator: true },
    });

    res.json(contact);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update contact error:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

// 町民削除
router.delete('/:id', async (req, res) => {
  try {
    await prisma.contact.delete({ where: { id: req.params.id } });
    res.json({ message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

// 接触履歴追加
router.post('/:id/histories', async (req: AuthRequest, res) => {
  try {
    const data = historySchema.parse(req.body);

    const history = await prisma.contactHistory.create({
      data: {
        contactId: req.params.id,
        userId: req.user!.id,
        date: new Date(data.date),
        content: data.content,
        projectId: data.projectId,
      },
      include: {
        user: true,
        project: { select: { id: true, projectName: true } },
      },
    });

    res.status(201).json(history);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create contact history error:', error);
    res.status(500).json({ error: 'Failed to create contact history' });
  }
});

export default router;
