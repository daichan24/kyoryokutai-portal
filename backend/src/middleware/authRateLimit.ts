import { rateLimit } from 'express-rate-limit';

const sharedOptions = {
  standardHeaders: 'draft-8' as const,
  legacyHeaders: false,
};

export const loginRateLimit = rateLimit({
  ...sharedOptions,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  message: { error: 'ログイン試行が多すぎます。しばらく待ってから再試行してください' },
});

export const loginHintsRateLimit = rateLimit({
  ...sharedOptions,
  windowMs: 15 * 60 * 1000,
  limit: 30,
  message: { error: 'アカウント一覧の取得が多すぎます。しばらく待ってから再試行してください' },
});

export const registrationRateLimit = rateLimit({
  ...sharedOptions,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: { error: '登録試行が多すぎます。しばらく待ってから再試行してください' },
});

export const aiTokenIssueRateLimit = rateLimit({
  ...sharedOptions,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: { error: 'AI接続の発行試行が多すぎます。しばらく待ってから再試行してください' },
});
