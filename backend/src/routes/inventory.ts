import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authenticate);

const CATEGORY_ORDER = ['DRINKS', 'FOOD', 'SUPPLIES', 'BAGS', 'OTHER'];
const INITIAL_UPDATED_AT = new Date('2026-07-16T15:00:00.000Z');

const updateInventorySchema = z.object({
  changes: z
    .array(
      z.object({
        id: z.string().min(1),
        quantity: z.number().min(0).max(999999).nullable(),
        expiry: z.string().trim().max(200).nullable(),
        expectedUpdatedAt: z.string().datetime(),
      }),
    )
    .min(1)
    .max(100),
});

const inventoryCategorySchema = z.enum(['DRINKS', 'FOOD', 'SUPPLIES', 'BAGS', 'OTHER']);

const createInventoryItemSchema = z.object({
  category: inventoryCategorySchema,
  name: z.string().trim().min(1).max(100),
  capacity: z.string().trim().max(50).nullable().optional(),
  quantity: z.number().min(0).max(999999).nullable(),
  quantitySuffix: z.string().trim().max(20).nullable().optional(),
  quantityNote: z.string().trim().max(50).nullable().optional(),
  expiry: z.string().trim().max(200).nullable().optional(),
});

const deleteInventoryItemSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
});

function nullableText(value: string | null | undefined) {
  return value?.trim() || null;
}

function sortItems<T extends { category: string; sortOrder: number; name: string }>(items: T[]) {
  return items.sort((a, b) => {
    const categoryDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    return categoryDiff || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ja');
  });
}

/** 在庫一覧。品名・容量は固定値として返し、画面では閲覧専用にする。 */
router.get('/', async (_req: AuthRequest, res) => {
  try {
    const [items, latestUpdate] = await Promise.all([
      prisma.inventoryItem.findMany({
        include: {
          updatedBy: { select: { id: true, name: true } },
        },
      }),
      prisma.inventoryUpdate.findFirst({
        orderBy: { createdAt: 'desc' },
        include: {
          updatedBy: { select: { id: true, name: true } },
        },
      }),
    ]);

    res.json({
      items: sortItems(items),
      lastUpdated: latestUpdate
        ? {
            at: latestUpdate.createdAt.toISOString(),
            by: latestUpdate.updatedBy,
            isInitial: false,
          }
        : {
            at: INITIAL_UPDATED_AT.toISOString(),
            by: null,
            isInitial: true,
          },
    });
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: '在庫情報の取得に失敗しました' });
  }
});

/** 更新単位の履歴。最新の更新差分をワンクリックで確認するためのAPI。 */
router.get('/history', async (req: AuthRequest, res) => {
  try {
    const requestedLimit = Number(req.query.limit || 20);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 50) : 20;
    const updates = await prisma.inventoryUpdate.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        updatedBy: { select: { id: true, name: true } },
        changes: { orderBy: { itemName: 'asc' } },
      },
    });

    res.json(updates);
  } catch (error) {
    console.error('Get inventory history error:', error);
    res.status(500).json({ error: '更新履歴の取得に失敗しました' });
  }
});

/** 固定項目を新規追加し、追加操作も履歴に残す。 */
router.post('/', async (req: AuthRequest, res) => {
  try {
    const data = createInventoryItemSchema.parse(req.body);
    const item = await prisma.$transaction(async (tx) => {
      const lastItem = await tx.inventoryItem.findFirst({
        where: { category: data.category },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      });
      const created = await tx.inventoryItem.create({
        data: {
          category: data.category,
          name: data.name,
          capacity: nullableText(data.capacity),
          quantity: data.quantity,
          quantitySuffix: nullableText(data.quantitySuffix),
          quantityNote: nullableText(data.quantityNote),
          expiry: nullableText(data.expiry),
          sortOrder: (lastItem?.sortOrder ?? 0) + 10,
          updatedById: req.user!.id,
        },
      });

      await tx.inventoryUpdate.create({
        data: {
          updatedById: req.user!.id,
          changes: {
            create: {
              itemId: created.id,
              itemName: created.name,
              itemCapacity: created.capacity,
              itemQuantitySuffix: created.quantitySuffix,
              category: created.category,
              changeType: 'ADD',
              previousQuantity: null,
              nextQuantity: created.quantity,
              previousExpiry: null,
              nextExpiry: created.expiry,
            },
          },
        },
      });

      return created;
    });

    res.status(201).json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '入力内容を確認してください', details: error.errors });
    }
    console.error('Create inventory item error:', error);
    res.status(500).json({ error: '在庫項目の追加に失敗しました' });
  }
});

/**
 * 在庫数と賞味期限だけを一括更新する。
 * expectedUpdatedAt により、別の人の直前の更新を誤って上書きしない。
 */
router.put('/', async (req: AuthRequest, res) => {
  try {
    const parsed = updateInventorySchema.parse(req.body);
    const duplicateIds = parsed.changes.filter(
      (change, index, changes) => changes.findIndex((candidate) => candidate.id === change.id) !== index,
    );
    if (duplicateIds.length) {
      return res.status(400).json({ error: '同じ品目が重複しています' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingItems = await tx.inventoryItem.findMany({
        where: { id: { in: parsed.changes.map((change) => change.id) } },
      });
      const itemMap = new Map(existingItems.map((item) => [item.id, item]));

      if (existingItems.length !== parsed.changes.length) {
        const error = new Error('在庫品目が見つかりません');
        (error as Error & { statusCode?: number }).statusCode = 404;
        throw error;
      }

      const actualChanges = parsed.changes.flatMap((change) => {
        const item = itemMap.get(change.id)!;
        const nextExpiry = change.expiry?.trim() || null;
        if (item.quantity === change.quantity && (item.expiry || null) === nextExpiry) return [];
        return [{ input: { ...change, expiry: nextExpiry }, item }];
      });

      if (!actualChanges.length) {
        const error = new Error('変更された在庫がありません');
        (error as Error & { statusCode?: number }).statusCode = 400;
        throw error;
      }

      const update = await tx.inventoryUpdate.create({
        data: {
          updatedById: req.user!.id,
          changes: {
            create: actualChanges.map(({ input, item }) => ({
              itemId: item.id,
              itemName: item.name,
              itemCapacity: item.capacity,
              itemQuantitySuffix: item.quantitySuffix,
              category: item.category,
              changeType: 'UPDATE',
              previousQuantity: item.quantity,
              nextQuantity: input.quantity,
              previousExpiry: item.expiry,
              nextExpiry: input.expiry,
            })),
          },
        },
      });

      for (const { input, item } of actualChanges) {
        if (item.updatedAt.toISOString() !== input.expectedUpdatedAt) {
          const error = new Error('別のユーザーが先に更新しました。画面を再読み込みしてください');
          (error as Error & { statusCode?: number }).statusCode = 409;
          throw error;
        }
        const updated = await tx.inventoryItem.updateMany({
          where: { id: item.id, updatedAt: item.updatedAt },
          data: {
            quantity: input.quantity,
            expiry: input.expiry,
            updatedById: req.user!.id,
          },
        });
        if (updated.count !== 1) {
          const error = new Error('別のユーザーが先に更新しました。画面を再読み込みしてください');
          (error as Error & { statusCode?: number }).statusCode = 409;
          throw error;
        }
      }

      return { updateId: update.id, changedCount: actualChanges.length };
    });

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '入力内容を確認してください', details: error.errors });
    }
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500;
    if (statusCode === 500) console.error('Update inventory error:', error);
    res.status(statusCode).json({ error: error instanceof Error ? error.message : '在庫情報の更新に失敗しました' });
  }
});

/** 項目を削除する。差分履歴は品名等のスナップショットとして保持する。 */
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { expectedUpdatedAt } = deleteInventoryItemSchema.parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findUnique({ where: { id: req.params.id } });
      if (!item) {
        const error = new Error('在庫品目が見つかりません');
        (error as Error & { statusCode?: number }).statusCode = 404;
        throw error;
      }
      if (item.updatedAt.toISOString() !== expectedUpdatedAt) {
        const error = new Error('別のユーザーが先に更新しました。画面を再読み込みしてください');
        (error as Error & { statusCode?: number }).statusCode = 409;
        throw error;
      }

      await tx.inventoryUpdate.create({
        data: {
          updatedById: req.user!.id,
          changes: {
            create: {
              itemId: item.id,
              itemName: item.name,
              itemCapacity: item.capacity,
              itemQuantitySuffix: item.quantitySuffix,
              category: item.category,
              changeType: 'DELETE',
              previousQuantity: item.quantity,
              nextQuantity: null,
              previousExpiry: item.expiry,
              nextExpiry: null,
            },
          },
        },
      });

      const deleted = await tx.inventoryItem.deleteMany({
        where: { id: item.id, updatedAt: item.updatedAt },
      });
      if (deleted.count !== 1) {
        const error = new Error('別のユーザーが先に更新しました。画面を再読み込みしてください');
        (error as Error & { statusCode?: number }).statusCode = 409;
        throw error;
      }
      return { deletedId: item.id };
    });

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: '削除対象の情報が古くなっています。画面を再読み込みしてください' });
    }
    const statusCode = (error as Error & { statusCode?: number }).statusCode || 500;
    if (statusCode === 500) console.error('Delete inventory item error:', error);
    res.status(statusCode).json({ error: error instanceof Error ? error.message : '在庫項目の削除に失敗しました' });
  }
});

export default router;
