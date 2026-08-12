import { describe, expect, it } from 'vitest';
import { snsPostCreateSchema, snsPostUpdateSchema } from './snsValidation';

describe('SNS投稿の作成・更新スキーマ', () => {
  it('メンバーが投稿日だけを更新できる', () => {
    expect(snsPostUpdateSchema.safeParse({ postedAt: '2026-08-12' }).success).toBe(true);
  });

  it('旧形式のBOTHは更新時だけ互換入力として受け付ける', () => {
    expect(snsPostUpdateSchema.safeParse({ postedAt: '2026-08-12', postType: 'BOTH' }).success).toBe(true);
    expect(snsPostCreateSchema.safeParse({ postedAt: '2026-08-12', postType: 'BOTH' }).success).toBe(false);
  });

  it('一括作成された初期InstagramアカウントIDで新規投稿できる', () => {
    const result = snsPostCreateSchema.safeParse({
      postedAt: '2026-08-12',
      postType: 'STORY',
      accountId: 'default-instagram-550e8400-e29b-41d4-a716-446655440000',
    });

    expect(result.success).toBe(true);
  });

  it('空のSNSアカウントIDは拒否する', () => {
    const result = snsPostCreateSchema.safeParse({
      postedAt: '2026-08-12',
      postType: 'STORY',
      accountId: '  ',
    });

    expect(result.success).toBe(false);
  });
});
