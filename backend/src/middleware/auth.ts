import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { Prisma, Role } from '@prisma/client';
import prisma from '../lib/prisma';
import { getJwtSecret } from '../config/security';
import { hashAiAccessToken, isAiAccessToken, isAiOAuthAccessToken } from '../security/aiAccessToken';
import { isAiWriteMethod, requiredAiScope, scopesAllowedForRole } from '../security/aiPermissions';
import { isSessionPasswordVersionValid } from '../security/sessionVersion';

export type AuthContext =
  | { kind: 'SESSION' }
  | {
      kind: 'AI_TOKEN';
      accessTokenId: string;
      scopes: string[];
      tokenName: string;
      accountRole: Role;
      auditRegistered?: boolean;
    };

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: Role;
  };
  authContext?: AuthContext;
  body: any;
  query: any;
  params: any;
}

function jsonSafe(value: unknown): Prisma.InputJsonValue | undefined {
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? undefined : JSON.parse(serialized) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

function summarizeInput(body: unknown): Prisma.InputJsonObject | undefined {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
  const record = body as Record<string, unknown>;
  const summary: Record<string, string | boolean | string[]> = { keys: Object.keys(record).sort() };
  for (const key of ['title', 'date', 'endDate', 'dueDate', 'projectId', 'missionId', 'linkKind', 'isDayOff']) {
    const value = record[key];
    if (typeof value === 'string') summary[key] = value.slice(0, 200);
    if (typeof value === 'boolean') summary[key] = value;
  }
  return summary as Prisma.InputJsonObject;
}

function resourceTypeFromPath(path: string): string | null {
  if (path.includes('/schedules')) return 'schedule';
  if (path.includes('/tasks')) return 'task';
  if (path.includes('/notepad')) return 'notepad';
  if (path.includes('/projects')) return 'project';
  if (path.includes('/missions')) return 'mission';
  return null;
}

async function prepareAiMutationSafety(
  req: AuthRequest,
  res: Response,
  context: Extract<AuthContext, { kind: 'AI_TOKEN' }>,
): Promise<boolean> {
  if (!isAiWriteMethod(req.method)) return true;

  const rawIdempotencyKey = req.header('Idempotency-Key')?.trim();
  if (!rawIdempotencyKey || rawIdempotencyKey.length > 100) {
    res.status(400).json({
      error: 'AI操作の書き込みには100文字以下のIdempotency-Keyが必要です',
    });
    return false;
  }

  let existing = await prisma.aiIdempotencyKey.findUnique({
    where: {
      accessTokenId_key: {
        accessTokenId: context.accessTokenId,
        key: rawIdempotencyKey,
      },
    },
  });
  if (existing && existing.expiresAt <= new Date()) {
    await prisma.aiIdempotencyKey.delete({ where: { id: existing.id } });
    existing = null;
  }
  if (existing) {
    if (existing.method !== req.method || existing.path !== req.originalUrl.split('?')[0]) {
      res.status(409).json({ error: '同じIdempotency-Keyが別の操作で使用されています' });
      return false;
    }
    if (existing.status === 'COMPLETED' && existing.statusCode) {
      res.status(existing.statusCode).json(existing.responseBody ?? { replayed: true });
      return false;
    }
    res.status(409).json({ error: '同じAI操作が実行中です' });
    return false;
  }

  const idempotencyRecord = await prisma.aiIdempotencyKey.create({
    data: {
      accessTokenId: context.accessTokenId,
      key: rawIdempotencyKey,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  let responseBody: Prisma.InputJsonValue | undefined;
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    responseBody = jsonSafe(body);
    return originalJson(body);
  }) as Response['json'];

  res.on('finish', () => {
    prisma.aiIdempotencyKey.update({
      where: { id: idempotencyRecord.id },
      data: {
        status: 'COMPLETED',
        statusCode: res.statusCode,
        responseBody,
      },
    }).catch((error) => console.error('Failed to finalize AI idempotency record:', error));
  });

  return true;
}

function registerAiAudit(
  req: AuthRequest,
  res: Response,
  context: Extract<AuthContext, { kind: 'AI_TOKEN' }>,
): void {
  if (context.auditRegistered || !isAiWriteMethod(req.method)) return;
  context.auditRegistered = true;
  const requestId = req.header('X-Request-Id')?.slice(0, 100) || crypto.randomUUID();
  let responseResourceId: string | null = null;
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    if (body && typeof body === 'object' && 'id' in body) {
      const id = (body as { id?: unknown }).id;
      if (typeof id === 'string') responseResourceId = id.slice(0, 100);
    }
    return originalJson(body);
  }) as Response['json'];

  res.on('finish', () => {
    prisma.aiOperationAudit.create({
      data: {
        userId: req.user!.id,
        accessTokenId: context.accessTokenId,
        method: req.method,
        path: req.originalUrl.split('?')[0],
        action: `${req.method} ${req.originalUrl.split('?')[0]}`.slice(0, 100),
        resourceType: resourceTypeFromPath(req.originalUrl),
        resourceId: responseResourceId || (typeof req.params?.id === 'string' ? req.params.id.slice(0, 100) : null),
        requestId,
        statusCode: res.statusCode,
        success: res.statusCode >= 200 && res.statusCode < 400,
        inputSummary: summarizeInput(req.body),
      },
    }).catch((error) => console.error('Failed to write AI operation audit:', error));
  });
}

async function authenticateAiToken(req: AuthRequest, res: Response, token: string): Promise<boolean> {
  const tokenHash = hashAiAccessToken(token);
  const oauthAccessToken = isAiOAuthAccessToken(token);
  const tokenRecord = await prisma.aiAccessToken.findFirst({
    where: oauthAccessToken
      ? { authType: 'OAUTH', accessTokenHash: tokenHash }
      : { authType: 'MANUAL', tokenHash },
    include: {
      user: { select: { id: true, email: true, role: true } },
    },
  });

  if (
    !tokenRecord
    || tokenRecord.revokedAt
    || (oauthAccessToken
      ? !tokenRecord.accessTokenExpiresAt || tokenRecord.accessTokenExpiresAt <= new Date()
      : tokenRecord.expiresAt && tokenRecord.expiresAt <= new Date())
  ) {
    res.status(401).json({ error: 'AI接続が無効または期限切れです' });
    return false;
  }

  const requiredScope = requiredAiScope(req.method, req.originalUrl);
  const currentlyAllowedScopes = new Set(scopesAllowedForRole(tokenRecord.user.role));
  if (
    !requiredScope
    || !tokenRecord.scopes.includes(requiredScope)
    || !currentlyAllowedScopes.has(requiredScope)
  ) {
    res.status(403).json({ error: 'このAI接続には該当操作の権限がありません' });
    return false;
  }

  if (req.method === 'GET' && req.originalUrl.split('?')[0] === '/api/schedules') {
    const requestedUserId = typeof req.query.userId === 'string' ? req.query.userId : null;
    const requestsMultipleUsers = req.query.allMembers === 'true' || req.query.userIds !== undefined;
    if (requestsMultipleUsers || (requestedUserId && requestedUserId !== tokenRecord.userId)) {
      res.status(403).json({ error: 'AI接続では本人以外のスケジュールを取得できません' });
      return false;
    }
    // 参加者として見える他人の予定もAIには返さず、必ず本人作成分へ固定する。
    req.query.userId = tokenRecord.userId;
  }

  // AI接続は、MASTERでも初期段階では本人データのみを扱う。
  // 管理操作は専用スコープと承認フローを追加するまで解放しない。
  req.user = {
    ...tokenRecord.user,
    role: tokenRecord.user.role === 'MASTER' ? 'MEMBER' : tokenRecord.user.role,
  };
  const context: Extract<AuthContext, { kind: 'AI_TOKEN' }> = {
    kind: 'AI_TOKEN',
    accessTokenId: tokenRecord.id,
    scopes: tokenRecord.scopes,
    tokenName: tokenRecord.name,
    accountRole: tokenRecord.user.role,
  };
  req.authContext = context;

  const mutationReady = await prepareAiMutationSafety(req, res, context);
  if (!mutationReady) return false;
  registerAiAudit(req, res, context);

  prisma.aiAccessToken.update({
    where: { id: tokenRecord.id },
    data: { lastUsedAt: new Date() },
  }).catch((error) => console.error('Failed to update AI token lastUsedAt:', error));

  return true;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (req.user && req.authContext) return next();

    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (isAiAccessToken(token)) {
      const authenticated = await authenticateAiToken(req, res, token);
      if (authenticated) next();
      return;
    }

    const decoded = jwt.verify(token, getJwtSecret()) as {
      id: string;
      iat?: number;
      passwordUpdatedAt?: number | null;
    };
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, passwordUpdatedAt: true },
    });
    if (!user) return res.status(401).json({ error: 'Invalid token' });
    if (!isSessionPasswordVersionValid(decoded, user.passwordUpdatedAt)) {
      return res.status(401).json({ error: 'Session expired after password change' });
    }

    req.user = { id: user.id, email: user.email, role: user.role };
    req.authContext = { kind: 'SESSION' };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const requireSession = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.authContext?.kind !== 'SESSION') {
    return res.status(403).json({ error: 'この操作は管理画面からのみ実行できます' });
  }
  next();
};

export const authorize = (...roles: Role[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};
