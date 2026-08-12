import crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '../src/lib/prisma';

const baseUrl = (process.env.CLEARBASE_SMOKE_BASE_URL || 'http://localhost:3012').replace(
  /\/$/,
  ''
);
const parsedBaseUrl = new URL(baseUrl);
if (!['localhost', '127.0.0.1', '::1'].includes(parsedBaseUrl.hostname)) {
  throw new Error('OAuth smoke test is restricted to a local ClearBase server');
}

const email = `oauth-smoke-${crypto.randomUUID()}@example.invalid`;
const password = `Smoke-${crypto.randomBytes(12).toString('base64url')}`;
let userId: string | undefined;
let clientId: string | undefined;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(`Expected JSON from ${response.url}: ${text.slice(0, 300)}`);
  }
}

async function mcpRequest(accessToken: string, body: Record<string, unknown>) {
  return fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function main() {
  const user = await prisma.user.create({
    data: {
      name: 'OAuth Smoke Member',
      email,
      password: await bcrypt.hash(password, 10),
      passwordUpdatedAt: new Date(),
      role: 'MEMBER',
    },
  });
  userId = user.id;

  const protectedMetadataResponse = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`);
  const protectedMetadata = await readJson(protectedMetadataResponse);
  assert(protectedMetadataResponse.ok, 'Protected resource metadata failed');
  assert(protectedMetadata.resource === `${baseUrl}/mcp`, 'Protected resource URL mismatch');

  const oauthMetadataResponse = await fetch(`${baseUrl}/.well-known/oauth-authorization-server`);
  const oauthMetadata = await readJson(oauthMetadataResponse);
  assert(oauthMetadataResponse.ok, 'OAuth metadata failed');
  assert(oauthMetadata.code_challenge_methods_supported instanceof Array, 'PKCE metadata missing');

  const redirectUri = 'https://chatgpt.com/connector/oauth/clearbase-smoke-test';
  const registrationResponse = await fetch(`${baseUrl}/oauth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'ClearBase OAuth Smoke',
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    }),
  });
  const registration = await readJson(registrationResponse);
  assert(registrationResponse.status === 201, 'Dynamic client registration failed');
  assert(typeof registration.client_id === 'string', 'client_id missing');
  clientId = registration.client_id;

  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  const authorization = new URL(`${baseUrl}/oauth/authorize`);
  authorization.searchParams.set('response_type', 'code');
  authorization.searchParams.set('client_id', clientId);
  authorization.searchParams.set('redirect_uri', redirectUri);
  authorization.searchParams.set('code_challenge', challenge);
  authorization.searchParams.set('code_challenge_method', 'S256');
  authorization.searchParams.set('resource', `${baseUrl}/mcp`);
  authorization.searchParams.set('state', 'smoke-state');

  const authorizationPage = await fetch(authorization);
  assert(authorizationPage.ok, 'Authorization page did not render');
  assert(
    (await authorizationPage.text()).includes('他のメンバー'),
    'Self-only consent notice missing'
  );

  const consentBody = new URLSearchParams(authorization.searchParams);
  consentBody.set('email', email);
  consentBody.set('password', password);
  const consentResponse = await fetch(`${baseUrl}/oauth/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: consentBody,
    redirect: 'manual',
  });
  assert(consentResponse.status === 302, 'OAuth consent did not redirect');
  const callback = new URL(consentResponse.headers.get('location') || '');
  const code = callback.searchParams.get('code');
  assert(code, 'Authorization code missing');
  assert(callback.searchParams.get('state') === 'smoke-state', 'OAuth state mismatch');

  const tokenResponse = await fetch(`${baseUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
      resource: `${baseUrl}/mcp`,
    }),
  });
  const tokens = await readJson(tokenResponse);
  assert(tokenResponse.ok, 'Authorization code exchange failed');
  assert(
    typeof tokens.access_token === 'string' && tokens.access_token.startsWith('cboa_'),
    'OAuth access token missing'
  );
  assert(
    typeof tokens.refresh_token === 'string' && tokens.refresh_token.startsWith('cbor_'),
    'OAuth refresh token missing'
  );

  const blockedOtherUser = await fetch(`${baseUrl}/api/schedules?userId=another-user`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  assert(blockedOtherUser.status === 403, 'OAuth token accessed another user schedule');

  const blockedAdmin = await fetch(`${baseUrl}/api/users`, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  assert(blockedAdmin.status === 403, 'OAuth token accessed user administration');

  const initializeResponse = await mcpRequest(tokens.access_token, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'clearbase-smoke', version: '1.0.0' },
    },
  });
  const initializeText = await initializeResponse.text();
  assert(
    initializeResponse.ok && initializeText.includes('clearbase-self-service'),
    'MCP initialize failed'
  );

  const toolListResponse = await mcpRequest(tokens.access_token, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {},
  });
  const toolListText = await toolListResponse.text();
  assert(
    toolListResponse.ok && toolListText.includes('clearbase_my_schedule_create'),
    'MCP tool discovery failed'
  );

  const refreshResponse = await fetch(`${baseUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      refresh_token: tokens.refresh_token,
      resource: `${baseUrl}/mcp`,
    }),
  });
  const refreshed = await readJson(refreshResponse);
  assert(refreshResponse.ok, 'Refresh token rotation failed');
  assert(refreshed.access_token !== tokens.access_token, 'Access token was not rotated');
  assert(refreshed.refresh_token !== tokens.refresh_token, 'Refresh token was not rotated');

  const oldAccessResponse = await mcpRequest(tokens.access_token, {
    jsonrpc: '2.0',
    id: 3,
    method: 'tools/list',
    params: {},
  });
  assert(oldAccessResponse.status === 401, 'Rotated access token remained usable');

  const revokeResponse = await fetch(`${baseUrl}/oauth/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      token: refreshed.refresh_token,
      client_id: clientId,
    }),
  });
  assert(revokeResponse.ok, 'OAuth revocation failed');
  const revokedAccessResponse = await mcpRequest(refreshed.access_token, {
    jsonrpc: '2.0',
    id: 4,
    method: 'tools/list',
    params: {},
  });
  assert(revokedAccessResponse.status === 401, 'Revoked access token remained usable');

  console.log(
    JSON.stringify({
      metadata: 'ok',
      dcr: 'ok',
      pkce: 'ok',
      selfOnly: 'ok',
      adminBlocked: 'ok',
      mcpInitialize: 'ok',
      mcpTools: 'ok',
      refreshRotation: 'ok',
      revocation: 'ok',
    })
  );
}

main()
  .finally(async () => {
    if (userId) await prisma.user.deleteMany({ where: { id: userId } });
    if (clientId) await prisma.aiOAuthClient.deleteMany({ where: { id: clientId } });
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
