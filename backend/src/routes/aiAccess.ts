import { Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { authenticate, authorize, AuthRequest, requireSession } from '../middleware/auth';
import { createAiAccessTokenValue } from '../security/aiAccessToken';
import { AI_SCOPES, scopesAllowedForRole } from '../security/aiPermissions';
import { aiTokenIssueRateLimit } from '../middleware/authRateLimit';

const router = Router();
router.use(authenticate, requireSession);

const createTokenSchema = z.object({
  name: z.string().trim().min(1).max(100),
  currentPassword: z.string().min(1),
  scopes: z.array(z.enum(AI_SCOPES)).min(1),
  expiresInDays: z.number().int().min(1).max(365).default(90),
});

router.get('/capabilities', async (req: AuthRequest, res) => {
  res.json({
    availableScopes: scopesAllowedForRole(req.user!.role),
    role: req.user!.role,
    passwordIsNeverSharedWithAi: true,
  });
});

router.get('/access-tokens', async (req: AuthRequest, res) => {
  const tokens = await prisma.aiAccessToken.findMany({
    where: { userId: req.user!.id },
    select: {
      id: true,
      name: true,
      tokenPrefix: true,
      scopes: true,
      expiresAt: true,
      revokedAt: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(tokens);
});

router.post('/access-tokens', aiTokenIssueRateLimit, async (req: AuthRequest, res) => {
  try {
    const data = createTokenSchema.parse(req.body);
    const allowedScopes = new Set(scopesAllowedForRole(req.user!.role));
    if (data.scopes.some((scope) => !allowedScopes.has(scope))) {
      return res.status(403).json({ error: '現在の役割では指定されたAI操作権限を発行できません' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { password: true },
    });
    if (!user || !(await bcrypt.compare(data.currentPassword, user.password))) {
      return res.status(401).json({ error: '現在のパスワードが正しくありません' });
    }

    const generated = createAiAccessTokenValue();
    const tokenRecord = await prisma.aiAccessToken.create({
      data: {
        userId: req.user!.id,
        name: data.name,
        tokenPrefix: generated.tokenPrefix,
        tokenHash: generated.tokenHash,
        scopes: [...new Set(data.scopes)],
        expiresAt: new Date(Date.now() + data.expiresInDays * 24 * 60 * 60 * 1000),
      },
      select: {
        id: true,
        name: true,
        tokenPrefix: true,
        scopes: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    res.status(201).json({
      ...tokenRecord,
      token: generated.token,
      warning: 'この接続トークンは今回だけ表示されます。パスワードはAIに渡さないでください。',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create AI access token error:', error);
    res.status(500).json({ error: 'AI接続の発行に失敗しました' });
  }
});

router.delete('/access-tokens/:id', async (req: AuthRequest, res) => {
  const token = await prisma.aiAccessToken.findUnique({
    where: { id: req.params.id },
    select: { id: true, userId: true, revokedAt: true },
  });
  if (!token) return res.status(404).json({ error: 'AI接続が見つかりません' });
  if (token.userId !== req.user!.id && req.user!.role !== 'MASTER') {
    return res.status(403).json({ error: '権限がありません' });
  }
  await prisma.aiAccessToken.update({
    where: { id: token.id },
    data: { revokedAt: token.revokedAt || new Date() },
  });
  res.json({ message: 'AI接続を失効させました' });
});

router.get('/audit', async (req: AuthRequest, res) => {
  const requestedUserId = typeof req.query.userId === 'string' ? req.query.userId : null;
  if (requestedUserId && requestedUserId !== req.user!.id && req.user!.role !== 'MASTER') {
    return res.status(403).json({ error: '権限がありません' });
  }
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const audits = await prisma.aiOperationAudit.findMany({
    where: { userId: requestedUserId || req.user!.id },
    include: { accessToken: { select: { name: true, tokenPrefix: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  res.json(audits);
});

router.get('/admin/audit', authorize('MASTER'), async (req: AuthRequest, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const audits = await prisma.aiOperationAudit.findMany({
    include: {
      user: { select: { id: true, name: true, email: true } },
      accessToken: { select: { name: true, tokenPrefix: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  res.json(audits);
});

export default router;
