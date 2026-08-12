import { describe, expect, it } from 'vitest';
import { buildSnsPostPayload, getSnsPostSaveErrorMessage } from './snsPostForm';

describe('buildSnsPostPayload', () => {
  it('投稿日だけの編集では任意項目を再送しない', () => {
    expect(buildSnsPostPayload({
      existingPost: {
        postedAt: '2026-08-10T03:00:00.000Z',
        postType: 'STORY',
        url: 'old-format-url',
        note: '既存メモ',
        followerCount: 120,
      },
      postedAt: '2026-08-11',
      postType: 'STORY',
      url: 'old-format-url',
      note: '既存メモ',
      followerCount: '120',
    })).toEqual({ postedAt: '2026-08-11' });
  });

  it('旧形式のBOTH投稿も投稿日だけ更新できるペイロードにする', () => {
    expect(buildSnsPostPayload({
      existingPost: {
        postedAt: '2026-08-10T03:00:00.000Z',
        postType: 'BOTH',
      },
      postedAt: '2026-08-12',
      postType: 'BOTH',
      url: '',
      note: '',
      followerCount: '',
    })).toEqual({ postedAt: '2026-08-12' });
  });

  it('任意項目を消した場合は空値を明示して送る', () => {
    expect(buildSnsPostPayload({
      existingPost: {
        postedAt: '2026-08-10T03:00:00.000Z',
        postType: 'FEED',
        url: 'https://example.com/post',
        note: 'メモ',
        followerCount: 200,
      },
      postedAt: '2026-08-10',
      postType: 'FEED',
      url: '',
      note: '',
      followerCount: '',
    })).toEqual({
      postedAt: '2026-08-10',
      url: '',
      note: '',
      followerCount: null,
    });
  });
});

describe('getSnsPostSaveErrorMessage', () => {
  it('Validation failedより具体的な詳細を表示する', () => {
    expect(getSnsPostSaveErrorMessage({
      response: {
        data: {
          error: 'Validation failed',
          details: [{ message: 'SNSアカウントを選択してください' }],
        },
      },
    })).toBe('SNSアカウントを選択してください');
  });

  it('具体的なAPIエラーはそのまま表示する', () => {
    expect(getSnsPostSaveErrorMessage({
      response: { data: { error: '指定されたSNSアカウントを利用できません' } },
    })).toBe('指定されたSNSアカウントを利用できません');
  });
});
