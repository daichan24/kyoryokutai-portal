import crypto from 'crypto';
import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import prisma from '../lib/prisma';
import {
  createAiOAuthAccessTokenValue,
  createAiOAuthRefreshTokenValue,
  hashAiAccessToken,
} from '../security/aiAccessToken';
import { AI_SCOPES, scopesAllowedForRole, type AiScope } from '../security/aiPermissions';
import {
  loginRateLimit,
  oauthRegistrationRateLimit,
  oauthTokenRateLimit,
} from '../middleware/authRateLimit';

const router = Router();
const ACCESS_TOKEN_LIFETIME_SECONDS = 60 * 60;
const AUTHORIZATION_CODE_LIFETIME_MS = 5 * 60 * 1000;

const scopeLabels: Record<AiScope, string> = {
  'tasks:read:self': '自分のタスクを見る',
  'tasks:write:self': '自分のタスクを追加・変更・削除する',
  'schedules:read:self': '自分の予定・休みを見る',
  'schedules:write:self': '自分の予定・休みを追加・変更・削除する',
  'notepad:read:self': '自分のメモを見る',
  'notepad:write:self': '自分のメモを追加・変更・削除する',
  'missions:read:self': '自分のミッションを見る',
  'missions:write:self': '自分のミッションを追加・変更・削除する',
  'projects:read:self': '自分のプロジェクトを見る',
  'projects:write:self': '自分のプロジェクトを追加・変更・削除する',
};

function publicBaseUrl(req: Request): string {
  const configured = process.env.BACKEND_PUBLIC_URL?.trim().replace(/\/$/, '');
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('BACKEND_PUBLIC_URL is required for OAuth in production');
  }
  return `${req.protocol}://${req.get('host')}`;
}

function resourceUrl(req: Request): string {
  return `${publicBaseUrl(req)}/mcp`;
}

function oauthError(res: Response, status: number, error: string, description: string) {
  return res.status(status).json({ error, error_description: description });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function isAllowedRedirectUri(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.hash) return false;
    if (url.protocol === 'https:' && url.hostname === 'chatgpt.com') {
      return (
        url.pathname.startsWith('/connector/oauth/') ||
        url.pathname === '/connector_platform_oauth_redirect'
      );
    }
    if (process.env.NODE_ENV !== 'production' && url.protocol === 'http:') {
      return ['127.0.0.1', 'localhost', '::1'].includes(url.hostname);
    }
    return false;
  } catch {
    return false;
  }
}

const registrationSchema = z.object({
  client_name: z.string().trim().min(1).max(200).default('ChatGPT'),
  redirect_uris: z.array(z.string().url()).min(1).max(10),
  token_endpoint_auth_method: z.literal('none').optional().default('none'),
  grant_types: z.array(z.string()).optional(),
  response_types: z.array(z.string()).optional(),
});

router.get(
  ['/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp'],
  (req, res) => {
    const baseUrl = publicBaseUrl(req);
    res.json({
      resource: `${baseUrl}/mcp`,
      authorization_servers: [baseUrl],
      scopes_supported: AI_SCOPES,
      bearer_methods_supported: ['header'],
    });
  }
);

router.get('/.well-known/oauth-authorization-server', (req, res) => {
  const baseUrl = publicBaseUrl(req);
  res.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/oauth/authorize`,
    token_endpoint: `${baseUrl}/oauth/token`,
    registration_endpoint: `${baseUrl}/oauth/register`,
    revocation_endpoint: `${baseUrl}/oauth/revoke`,
    scopes_supported: AI_SCOPES,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none'],
    code_challenge_methods_supported: ['S256'],
  });
});

router.post('/oauth/register', oauthRegistrationRateLimit, async (req, res) => {
  try {
    const data = registrationSchema.parse(req.body);
    if (data.redirect_uris.some((uri) => !isAllowedRedirectUri(uri))) {
      return oauthError(
        res,
        400,
        'invalid_redirect_uri',
        'ChatGPTのOAuthコールバックだけを登録できます'
      );
    }
    if (
      data.grant_types &&
      data.grant_types.some((type) => !['authorization_code', 'refresh_token'].includes(type))
    ) {
      return oauthError(res, 400, 'invalid_client_metadata', '未対応のgrant_typeです');
    }
    if (data.response_types && data.response_types.some((type) => type !== 'code')) {
      return oauthError(
        res,
        400,
        'invalid_client_metadata',
        'response_typeはcodeだけを利用できます'
      );
    }

    const client = await prisma.aiOAuthClient.create({
      data: {
        id: `cbclient_${crypto.randomBytes(24).toString('base64url')}`,
        clientName: data.client_name,
        redirectUris: [...new Set(data.redirect_uris)],
        tokenEndpointAuthMethod: 'none',
      },
    });
    res.status(201).json({
      client_id: client.id,
      client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
      client_name: client.clientName,
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return oauthError(
        res,
        400,
        'invalid_client_metadata',
        error.issues[0]?.message || '登録内容が不正です'
      );
    }
    console.error('OAuth client registration error:', error);
    return oauthError(res, 500, 'server_error', 'OAuthクライアントを登録できませんでした');
  }
});

const authorizationSchema = z.object({
  response_type: z.literal('code'),
  client_id: z.string().min(1).max(300),
  redirect_uri: z.string().url(),
  scope: z.string().max(1000).optional(),
  state: z.string().max(2000).optional(),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43,128}$/),
  code_challenge_method: z.literal('S256'),
  resource: z.string().url(),
});

type AuthorizationInput = z.infer<typeof authorizationSchema>;

async function validateAuthorizationRequest(req: Request, input: AuthorizationInput) {
  if (input.resource !== resourceUrl(req)) throw new Error('resourceがClearBase MCPと一致しません');
  const client = await prisma.aiOAuthClient.findUnique({ where: { id: input.client_id } });
  if (!client || !client.redirectUris.includes(input.redirect_uri)) {
    throw new Error('OAuthクライアントまたはredirect_uriが無効です');
  }
  const scopes = input.scope ? input.scope.split(/\s+/).filter(Boolean) : [...AI_SCOPES];
  if (scopes.length === 0 || scopes.some((scope) => !AI_SCOPES.includes(scope as AiScope))) {
    throw new Error('未対応の権限が要求されました');
  }
  return { client, scopes: [...new Set(scopes)] as AiScope[] };
}

function renderAuthorizationPage(
  input: AuthorizationInput,
  clientName: string,
  scopes: AiScope[],
  error?: string
): string {
  const hidden = Object.entries(input)
    .filter(([, value]) => value !== undefined)
    .map(
      ([key, value]) =>
        `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(String(value))}">`
    )
    .join('');
  const scopeItems = scopes.map((scope) => `<li>${escapeHtml(scopeLabels[scope])}</li>`).join('');
  const errorBlock = error ? `<p class="error">${escapeHtml(error)}</p>` : '';
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ClearBaseを接続</title><style>
body{font-family:-apple-system,BlinkMacSystemFont,"Noto Sans JP",sans-serif;background:#f4f7fb;color:#172033;margin:0;padding:24px}.card{max-width:560px;margin:28px auto;background:#fff;border:1px solid #dce3ec;border-radius:16px;padding:28px;box-shadow:0 12px 32px #23334d18}h1{font-size:24px;margin:0 0 10px}.lead{color:#536176;line-height:1.7}.notice{background:#eef8f1;border:1px solid #b9dfc4;border-radius:10px;padding:12px;margin:18px 0;color:#205d32}ul{line-height:1.8;padding-left:22px}label{display:block;font-weight:600;margin-top:16px}input[type=email],input[type=password]{box-sizing:border-box;width:100%;padding:12px;margin-top:6px;border:1px solid #b9c5d4;border-radius:9px;font-size:16px}.button{width:100%;margin-top:22px;padding:13px;border:0;border-radius:9px;background:#2563eb;color:white;font-size:16px;font-weight:700;cursor:pointer}.small{font-size:13px;color:#667085;line-height:1.6}.error{background:#fff1f1;border:1px solid #f0b4b4;color:#9f1d1d;padding:10px;border-radius:8px}</style></head>
<body><main class="card"><h1>ClearBaseをChatGPTに接続</h1><p class="lead">${escapeHtml(clientName)}が、以下の本人データを操作する許可を求めています。</p>${errorBlock}<div class="notice">他のメンバーの予定・タスク・メモは操作できません。この接続によって有料契約が開始されることもありません。</div><ul>${scopeItems}</ul>
<form method="post" action="/oauth/authorize">${hidden}<label>ClearBaseのメールアドレス<input type="email" name="email" autocomplete="username" required></label><label>ClearBaseのパスワード<input type="password" name="password" autocomplete="current-password" required></label><button class="button" type="submit">本人として接続を許可</button></form><p class="small">パスワードはClearBaseへ直接送信され、ChatGPTには渡りません。接続はClearBaseの「設定 → AI接続」からいつでも解除できます。</p></main></body></html>`;
}

router.get('/oauth/authorize', async (req, res) => {
  try {
    const input = authorizationSchema.parse(req.query);
    const { client, scopes } = await validateAuthorizationRequest(req, input);
    res.type('html').send(renderAuthorizationPage(input, client.clientName, scopes));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OAuth認可要求が不正です';
    res
      .status(400)
      .type('html')
      .send(`<h1>接続できません</h1><p>${escapeHtml(message)}</p>`);
  }
});

router.post('/oauth/authorize', loginRateLimit, async (req, res) => {
  try {
    const input = authorizationSchema.parse(req.body);
    const email = z.string().email().parse(req.body.email);
    const password = z.string().min(1).parse(req.body.password);
    const { client, scopes } = await validateAuthorizationRequest(req, input);
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, password: true, role: true },
    });
    const passwordMatches = user ? await bcrypt.compare(password, user.password) : false;
    const allowedScopes = user ? new Set(scopesAllowedForRole(user.role)) : new Set<AiScope>();
    if (!user || !passwordMatches || scopes.some((scope) => !allowedScopes.has(scope))) {
      return res
        .status(401)
        .type('html')
        .send(
          renderAuthorizationPage(
            input,
            client.clientName,
            scopes,
            'ログイン情報が正しくないか、この役割ではAI接続を利用できません。'
          )
        );
    }

    const authorizationCode = `cboc_${crypto.randomBytes(32).toString('base64url')}`;
    await prisma.aiOAuthAuthorizationCode.create({
      data: {
        codeHash: hashAiAccessToken(authorizationCode),
        clientId: client.id,
        userId: user.id,
        redirectUri: input.redirect_uri,
        scopes,
        codeChallenge: input.code_challenge,
        resource: input.resource,
        expiresAt: new Date(Date.now() + AUTHORIZATION_CODE_LIFETIME_MS),
      },
    });
    const redirect = new URL(input.redirect_uri);
    redirect.searchParams.set('code', authorizationCode);
    if (input.state) redirect.searchParams.set('state', input.state);
    res.redirect(302, redirect.toString());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'OAuth認可に失敗しました';
    res
      .status(400)
      .type('html')
      .send(`<h1>接続できません</h1><p>${escapeHtml(message)}</p>`);
  }
});

const authorizationCodeTokenSchema = z.object({
  grant_type: z.literal('authorization_code'),
  client_id: z.string().min(1),
  code: z.string().min(1),
  redirect_uri: z.string().url(),
  code_verifier: z.string().min(43).max(128),
  resource: z.string().url(),
});

const refreshTokenSchema = z.object({
  grant_type: z.literal('refresh_token'),
  client_id: z.string().min(1),
  refresh_token: z.string().min(1),
  resource: z.string().url(),
  scope: z.string().optional(),
});

export function pkceChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function tokenResponse(accessToken: string, refreshToken: string, scopes: string[]) {
  return {
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_LIFETIME_SECONDS,
    refresh_token: refreshToken,
    scope: scopes.join(' '),
  };
}

router.post('/oauth/token', oauthTokenRateLimit, async (req, res) => {
  try {
    if (req.body.grant_type === 'authorization_code') {
      const data = authorizationCodeTokenSchema.parse(req.body);
      if (data.resource !== resourceUrl(req)) {
        return oauthError(res, 400, 'invalid_target', 'resourceが一致しません');
      }
      const code = await prisma.aiOAuthAuthorizationCode.findUnique({
        where: { codeHash: hashAiAccessToken(data.code) },
        include: { client: true, user: { select: { id: true, role: true } } },
      });
      if (
        !code ||
        code.usedAt ||
        code.expiresAt <= new Date() ||
        code.clientId !== data.client_id ||
        code.redirectUri !== data.redirect_uri ||
        code.resource !== data.resource ||
        code.codeChallenge !== pkceChallenge(data.code_verifier)
      ) {
        return oauthError(res, 400, 'invalid_grant', '認可コードが無効または使用済みです');
      }
      const allowed = new Set(scopesAllowedForRole(code.user.role));
      if (code.scopes.some((scope) => !allowed.has(scope as AiScope))) {
        return oauthError(res, 400, 'invalid_scope', '現在の役割では利用できない権限です');
      }
      const claimed = await prisma.aiOAuthAuthorizationCode.updateMany({
        where: { id: code.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (claimed.count !== 1) {
        return oauthError(res, 400, 'invalid_grant', '認可コードはすでに使用されています');
      }

      const access = createAiOAuthAccessTokenValue();
      const refresh = createAiOAuthRefreshTokenValue();
      await prisma.aiAccessToken.create({
        data: {
          userId: code.userId,
          name: `${code.client.clientName}（自動接続）`,
          tokenPrefix: access.tokenPrefix,
          tokenHash: hashAiAccessToken(`oauth-grant:${crypto.randomUUID()}`),
          scopes: code.scopes,
          authType: 'OAUTH',
          oauthClientId: code.clientId,
          refreshTokenHash: refresh.tokenHash,
          accessTokenHash: access.tokenHash,
          accessTokenExpiresAt: new Date(Date.now() + ACCESS_TOKEN_LIFETIME_SECONDS * 1000),
          expiresAt: null,
        },
      });
      return res.json(tokenResponse(access.token, refresh.token, code.scopes));
    }

    if (req.body.grant_type === 'refresh_token') {
      const data = refreshTokenSchema.parse(req.body);
      if (data.resource !== resourceUrl(req)) {
        return oauthError(res, 400, 'invalid_target', 'resourceが一致しません');
      }
      const grant = await prisma.aiAccessToken.findFirst({
        where: {
          authType: 'OAUTH',
          refreshTokenHash: hashAiAccessToken(data.refresh_token),
          revokedAt: null,
        },
        include: { user: { select: { role: true } } },
      });
      if (!grant || grant.oauthClientId !== data.client_id) {
        return oauthError(res, 400, 'invalid_grant', '更新トークンが無効です');
      }
      const requestedScopes = data.scope ? data.scope.split(/\s+/).filter(Boolean) : grant.scopes;
      const currentlyAllowedScopes = new Set(scopesAllowedForRole(grant.user.role));
      if (
        requestedScopes.some(
          (scope) => !grant.scopes.includes(scope) || !currentlyAllowedScopes.has(scope as AiScope)
        )
      ) {
        return oauthError(res, 400, 'invalid_scope', '接続時に許可されていない権限です');
      }
      const access = createAiOAuthAccessTokenValue();
      const refresh = createAiOAuthRefreshTokenValue();
      const rotated = await prisma.aiAccessToken.updateMany({
        where: {
          id: grant.id,
          refreshTokenHash: hashAiAccessToken(data.refresh_token),
          revokedAt: null,
        },
        data: {
          tokenPrefix: access.tokenPrefix,
          scopes: requestedScopes,
          refreshTokenHash: refresh.tokenHash,
          accessTokenHash: access.tokenHash,
          accessTokenExpiresAt: new Date(Date.now() + ACCESS_TOKEN_LIFETIME_SECONDS * 1000),
          lastUsedAt: new Date(),
        },
      });
      if (rotated.count !== 1) {
        return oauthError(res, 400, 'invalid_grant', '更新トークンはすでに使用されています');
      }
      return res.json(tokenResponse(access.token, refresh.token, requestedScopes));
    }

    return oauthError(res, 400, 'unsupported_grant_type', '未対応のgrant_typeです');
  } catch (error) {
    if (error instanceof z.ZodError) {
      return oauthError(
        res,
        400,
        'invalid_request',
        error.issues[0]?.message || 'トークン要求が不正です'
      );
    }
    console.error('OAuth token error:', error);
    return oauthError(res, 500, 'server_error', 'トークンを発行できませんでした');
  }
});

router.post('/oauth/revoke', oauthTokenRateLimit, async (req, res) => {
  const token = typeof req.body.token === 'string' ? req.body.token : '';
  const clientId = typeof req.body.client_id === 'string' ? req.body.client_id : '';
  if (token && clientId) {
    const tokenHash = hashAiAccessToken(token);
    await prisma.aiAccessToken.updateMany({
      where: {
        oauthClientId: clientId,
        authType: 'OAUTH',
        OR: [{ refreshTokenHash: tokenHash }, { accessTokenHash: tokenHash }],
      },
      data: { revokedAt: new Date(), accessTokenHash: null, refreshTokenHash: null },
    });
  }
  res.status(200).end();
});

export default router;
