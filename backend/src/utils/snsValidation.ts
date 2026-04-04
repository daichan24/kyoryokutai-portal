import { z } from 'zod';

/**
 * フォロワー数バリデーション
 * - 数値・文字列・nullを受け付ける
 * - カンマ区切り文字列を数値に変換
 * - 0〜99,999,999の範囲外は undefined を返す（エラーにしない）
 */
export const followerCountField = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    if (v === '') return undefined;
    const n = typeof v === 'string' ? parseInt(String(v).replace(/,/g, ''), 10) : Number(v);
    if (!Number.isFinite(n) || Number.isNaN(n)) return undefined;
    const t = Math.trunc(n);
    if (t < 0 || t > 99_999_999) return undefined;
    return t;
  });

/**
 * URLバリデーション
 * - 空文字列または有効なURL形式を受け付ける
 */
export const urlField = z
  .string()
  .optional()
  .refine((val) => !val || val === '' || z.string().url().safeParse(val).success, {
    message: 'Invalid URL format',
  });

/**
 * SNS投稿作成スキーマ
 */
export const snsPostCreateSchema = z.object({
  postedAt: z.string(), // ISO 日時または YYYY-MM-DD
  postType: z.enum(['STORY', 'FEED']),
  accountId: z.string().uuid().optional().nullable(),
  url: urlField,
  note: z.string().max(2000).optional(),
  followerCount: followerCountField,
});

/**
 * SNS投稿更新スキーマ（部分更新）
 */
export const snsPostUpdateSchema = snsPostCreateSchema.partial();

/**
 * 投稿日時の入力をパース
 * - YYYY-MM-DD 形式の場合は JST 正午（12:00）として解釈（週境界計算と整合）
 * - それ以外は Date コンストラクタに委譲
 */
export function parsePostedAtInput(raw: string): Date {
  const t = raw.trim();
  if (t.length === 10 && /^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const y = parseInt(t.slice(0, 4), 10);
    const mo = parseInt(t.slice(5, 7), 10);
    const d = parseInt(t.slice(8, 10), 10);
    // JST noon = UTC 03:00 (UTC+9 - 9h = UTC)
    return new Date(Date.UTC(y, mo - 1, d, 3, 0, 0));
  }
  return new Date(t);
}
