export type EditableSnsPostType = 'STORY' | 'FEED' | 'BOTH';

export interface EditableSnsPost {
  postedAt: string;
  postType: EditableSnsPostType;
  url?: string | null;
  note?: string | null;
  followerCount?: number | null;
}

interface BuildSnsPostPayloadOptions {
  existingPost?: EditableSnsPost | null;
  postedAt: string;
  postType: EditableSnsPostType;
  url: string;
  note: string;
  followerCount: string;
}

/**
 * 投稿日だけを直すとき、変更していない任意項目を再送しない。
 * 旧データに現在の入力規則外の値が残っていても、日付更新を妨げないため。
 */
export function buildSnsPostPayload({
  existingPost,
  postedAt,
  postType,
  url,
  note,
  followerCount,
}: BuildSnsPostPayloadOptions): Record<string, unknown> {
  const payload: Record<string, unknown> = { postedAt };
  const trimmedUrl = url.trim();
  const trimmedNote = note.trim();

  if (!existingPost) {
    payload.postType = postType;
    if (trimmedUrl) payload.url = trimmedUrl;
    if (trimmedNote) payload.note = trimmedNote;
  } else {
    if (postType !== existingPost.postType) payload.postType = postType;
    if (trimmedUrl !== (existingPost.url || '').trim()) payload.url = trimmedUrl;
    if (trimmedNote !== (existingPost.note || '').trim()) payload.note = trimmedNote;
  }

  const trimmedFollowerCount = followerCount.trim();
  if (trimmedFollowerCount === '') {
    if (existingPost?.followerCount != null) payload.followerCount = null;
  } else {
    const parsedFollowerCount = Number.parseInt(trimmedFollowerCount.replace(/,/g, ''), 10);
    if (!Number.isNaN(parsedFollowerCount) && parsedFollowerCount >= 0) {
      if (!existingPost || parsedFollowerCount !== existingPost.followerCount) {
        payload.followerCount = parsedFollowerCount;
      }
    }
  }

  return payload;
}

interface ApiValidationIssue {
  message?: unknown;
}

export function getSnsPostSaveErrorMessage(error: unknown): string {
  const apiData = (error as {
    response?: { data?: { error?: unknown; details?: unknown } };
    message?: unknown;
  })?.response?.data;
  const apiError = typeof apiData?.error === 'string' ? apiData.error : '';
  const details = Array.isArray(apiData?.details) ? apiData.details as ApiValidationIssue[] : [];
  const detailMessage = details.find((issue) => typeof issue?.message === 'string')?.message;

  if (apiError && apiError !== 'Validation failed') return apiError;
  if (typeof detailMessage === 'string') return detailMessage;
  if (apiError) return '入力内容を確認してください';

  const fallback = (error as { message?: unknown })?.message;
  return typeof fallback === 'string' && fallback ? fallback : '不明なエラー';
}
