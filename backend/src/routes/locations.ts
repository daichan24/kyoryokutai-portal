import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

router.use(authenticate);

const createLocationSchema = z.object({
  name: z.string().min(1),
  order: z.number().optional(),
  isActive: z.boolean().optional(),
});

const updateLocationSchema = createLocationSchema.partial();

router.get('/', async (req, res) => {
  try {
    const { includeInactive } = req.query;

    const where: any = {};

    if (!includeInactive) {
      where.isActive = true;
    }

    const locations = await prisma.location.findMany({
      where,
      orderBy: { order: 'asc' },
    });

    res.json(locations);
  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({ error: 'Failed to get locations' });
  }
});

router.post('/', authorize('MASTER'), async (req, res) => {
  try {
    const data = createLocationSchema.parse(req.body);

    const location = await prisma.location.create({
      data,
    });

    res.status(201).json(location);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create location error:', error);
    res.status(500).json({ error: 'Failed to create location' });
  }
});

router.put('/:id', authorize('MASTER'), async (req, res) => {
  try {
    const { id } = req.params;
    const data = updateLocationSchema.parse(req.body);

    const location = await prisma.location.update({
      where: { id },
      data,
    });

    res.json(location);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

router.delete('/:id', authorize('MASTER'), async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.location.delete({
      where: { id },
    });

    res.json({ message: 'Location deleted successfully' });
  } catch (error) {
    console.error('Delete location error:', error);
    res.status(500).json({ error: 'Failed to delete location' });
  }
});

export default router;
