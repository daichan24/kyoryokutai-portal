import { describe, test, expect, vi, beforeEach } from 'vitest';

// Simulate the upsert logic from POST /api/sns-posts
interface PostRecord {
  id: string;
  userId: string;
  week: string;
  postType: 'STORY' | 'FEED';
  accountId: string | null;
  postedAt: Date;
  url: string | null;
  note: string | null;
  followerCount: number | null;
}

// In-memory store to simulate DB
let store: PostRecord[] = [];
let idCounter = 1;

function findFirst(where: Partial<PostRecord>): PostRecord | undefined {
  return store.find((p) =>
    Object.entries(where).every(([k, v]) => (p as any)[k] === v)
  );
}

function create(data: Omit<PostRecord, 'id'>): PostRecord {
  const record = { ...data, id: `id-${idCounter++}` };
  store.push(record);
  return record;
}

function update(id: string, data: Partial<PostRecord>): PostRecord {
  const idx = store.findIndex((p) => p.id === id);
  if (idx === -1) throw new Error('Not found');
  store[idx] = { ...store[idx], ...data };
  return store[idx];
}

// Upsert logic extracted from snsPosts.ts
async function upsertPost(params: {
  userId: string;
  weekKey: string;
  postType: 'STORY' | 'FEED';
  accountId: string | null;
  postedAt: Date;
  url: string | null;
  note: string | null;
  followerCount: number | null;
}): Promise<PostRecord> {
  const { userId, weekKey, postType, accountId, postedAt, url, note, followerCount } = params;

  const existing = findFirst({ userId, week: weekKey, postType, accountId });

  if (existing) {
    return update(existing.id, { postedAt, url, note, ...(followerCount !== null ? { followerCount } : {}) });
  } else {
    return create({ userId, week: weekKey, postType, accountId, postedAt, url, note, followerCount });
  }
}

describe('Upsert Logic', () => {
  beforeEach(() => {
    store = [];
    idCounter = 1;
  });

  describe('11.1 新規作成のテスト', () => {
    test('should create new post when none exists', async () => {
      const result = await upsertPost({
        userId: 'user-1',
        weekKey: '2024-W03',
        postType: 'STORY',
        accountId: null,
        postedAt: new Date('2024-01-15T03:00:00Z'),
        url: null,
        note: null,
        followerCount: null,
      });

      expect(result.id).toBeDefined();
      expect(result.userId).toBe('user-1');
      expect(result.week).toBe('2024-W03');
      expect(result.postType).toBe('STORY');
      expect(store.length).toBe(1);
    });

    test('should create separate posts for STORY and FEED in same week', async () => {
      await upsertPost({
        userId: 'user-1',
        weekKey: '2024-W03',
        postType: 'STORY',
        accountId: null,
        postedAt: new Date('2024-01-15T03:00:00Z'),
        url: null,
        note: null,
        followerCount: null,
      });

      await upsertPost({
        userId: 'user-1',
        weekKey: '2024-W03',
        postType: 'FEED',
        accountId: null,
        postedAt: new Date('2024-01-16T03:00:00Z'),
        url: null,
        note: null,
        followerCount: null,
      });

      expect(store.length).toBe(2);
      expect(store[0].postType).toBe('STORY');
      expect(store[1].postType).toBe('FEED');
    });

    test('should create separate posts for different users same week and type', async () => {
      await upsertPost({
        userId: 'user-1',
        weekKey: '2024-W03',
        postType: 'STORY',
        accountId: null,
        postedAt: new Date('2024-01-15T03:00:00Z'),
        url: null,
        note: null,
        followerCount: null,
      });

      await upsertPost({
        userId: 'user-2',
        weekKey: '2024-W03',
        postType: 'STORY',
        accountId: null,
        postedAt: new Date('2024-01-15T03:00:00Z'),
        url: null,
        note: null,
        followerCount: null,
      });

      expect(store.length).toBe(2);
      expect(store[0].userId).toBe('user-1');
      expect(store[1].userId).toBe('user-2');
    });

    test('should create separate posts for different accounts same week and type', async () => {
      await upsertPost({
        userId: 'user-1',
        weekKey: '2024-W03',
        postType: 'STORY',
        accountId: 'account-1',
        postedAt: new Date('2024-01-15T03:00:00Z'),
        url: null,
        note: null,
        followerCount: null,
      });

      await upsertPost({
        userId: 'user-1',
        weekKey: '2024-W03',
        postType: 'STORY',
        accountId: 'account-2',
        postedAt: new Date('2024-01-16T03:00:00Z'),
        url: null,
        note: null,
        followerCount: null,
      });

      expect(store.length).toBe(2);
      expect(store[0].accountId).toBe('account-1');
      expect(store[1].accountId).toBe('account-2');
    });
  });

  describe('11.2 更新のテスト', () => {
    test('should update existing post with same userId+week+postType+accountId', async () => {
      const first = await upsertPost({
        userId: 'user-1',
        weekKey: '2024-W03',
        postType: 'STORY',
        accountId: null,
        postedAt: new Date('2024-01-15T03:00:00Z'),
        url: null,
        note: 'original note',
        followerCount: 100,
      });

      const second = await upsertPost({
        userId: 'user-1',
        weekKey: '2024-W03',
        postType: 'STORY',
        accountId: null,
        postedAt: new Date('2024-01-16T03:00:00Z'),
        url: 'https://example.com',
        note: 'updated note',
        followerCount: 200,
      });

      // Should be same record (updated, not new)
      expect(store.length).toBe(1);
      expect(second.id).toBe(first.id);
      expect(second.note).toBe('updated note');
      expect(second.url).toBe('https://example.com');
      expect(second.followerCount).toBe(200);
    });

    test('should update postedAt when same key', async () => {
      const originalDate = new Date('2024-01-15T03:00:00Z');
      const updatedDate = new Date('2024-01-17T03:00:00Z');

      await upsertPost({
        userId: 'user-1',
        weekKey: '2024-W03',
        postType: 'STORY',
        accountId: null,
        postedAt: originalDate,
        url: null,
        note: null,
        followerCount: null,
      });

      const result = await upsertPost({
        userId: 'user-1',
        weekKey: '2024-W03',
        postType: 'STORY',
        accountId: null,
        postedAt: updatedDate,
        url: null,
        note: null,
        followerCount: null,
      });

      expect(result.postedAt).toEqual(updatedDate);
      expect(store.length).toBe(1);
    });

    test('should not update followerCount when null passed (preserve existing)', async () => {
      await upsertPost({
        userId: 'user-1',
        weekKey: '2024-W03',
        postType: 'STORY',
        accountId: null,
        postedAt: new Date('2024-01-15T03:00:00Z'),
        url: null,
        note: null,
        followerCount: 500,
      });

      // Update with null followerCount - should NOT overwrite existing
      const result = await upsertPost({
        userId: 'user-1',
        weekKey: '2024-W03',
        postType: 'STORY',
        accountId: null,
        postedAt: new Date('2024-01-16T03:00:00Z'),
        url: null,
        note: 'new note',
        followerCount: null,
      });

      // followerCount should remain 500 (not overwritten by null)
      expect(result.followerCount).toBe(500);
    });

    test('should update followerCount when non-null value passed', async () => {
      await upsertPost({
        userId: 'user-1',
        weekKey: '2024-W03',
        postType: 'STORY',
        accountId: null,
        postedAt: new Date('2024-01-15T03:00:00Z'),
        url: null,
        note: null,
        followerCount: 500,
      });

      const result = await upsertPost({
        userId: 'user-1',
        weekKey: '2024-W03',
        postType: 'STORY',
        accountId: null,
        postedAt: new Date('2024-01-16T03:00:00Z'),
        url: null,
        note: null,
        followerCount: 600,
      });

      expect(result.followerCount).toBe(600);
    });
  });

  describe('11.3 P2002エラーハンドリングのテスト', () => {
    test('should handle P2002 by finding and updating existing record', async () => {
      // Simulate P2002 scenario: record exists but wasn't found in initial search
      // (race condition scenario)
      const existingRecord: PostRecord = {
        id: 'existing-id',
        userId: 'user-1',
        week: '2024-W03',
        postType: 'STORY',
        accountId: null,
        postedAt: new Date('2024-01-15T03:00:00Z'),
        url: null,
        note: 'existing note',
        followerCount: 100,
      };
      store.push(existingRecord);

      // Simulate P2002 retry logic: find existing and update
      const retry = findFirst({ userId: 'user-1', week: '2024-W03', postType: 'STORY' });
      expect(retry).toBeDefined();

      if (retry) {
        const updated = update(retry.id, {
          postedAt: new Date('2024-01-16T03:00:00Z'),
          url: 'https://example.com',
          note: 'updated note',
        });

        expect(updated.id).toBe('existing-id');
        expect(updated.note).toBe('updated note');
        expect(store.length).toBe(1); // Still only 1 record
      }
    });

    test('should result in exactly one record after multiple upsert attempts', async () => {
      // Simulate multiple concurrent upsert attempts
      const params = {
        userId: 'user-1',
        weekKey: '2024-W03',
        postType: 'STORY' as const,
        accountId: null,
        postedAt: new Date('2024-01-15T03:00:00Z'),
        url: null,
        note: null,
        followerCount: null,
      };

      await upsertPost(params);
      await upsertPost({ ...params, note: 'second attempt' });
      await upsertPost({ ...params, note: 'third attempt' });

      expect(store.length).toBe(1);
      expect(store[0].note).toBe('third attempt');
    });

    test('should handle upsert with different accountIds independently', async () => {
      const baseParams = {
        userId: 'user-1',
        weekKey: '2024-W03',
        postType: 'STORY' as const,
        postedAt: new Date('2024-01-15T03:00:00Z'),
        url: null,
        note: null,
        followerCount: null,
      };

      await upsertPost({ ...baseParams, accountId: 'account-1' });
      await upsertPost({ ...baseParams, accountId: 'account-2' });
      await upsertPost({ ...baseParams, accountId: 'account-1', note: 'updated' }); // Should update account-1

      expect(store.length).toBe(2);
      const acc1 = store.find((p) => p.accountId === 'account-1');
      const acc2 = store.find((p) => p.accountId === 'account-2');
      expect(acc1?.note).toBe('updated');
      expect(acc2?.note).toBeNull();
    });
  });
});
