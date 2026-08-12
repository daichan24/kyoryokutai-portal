import { Router, type Request, type Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import prisma from '../lib/prisma';
import { createClearBaseMcpServer } from '../mcp/stdio';
import {
  hashAiAccessToken,
  isAiAccessToken,
  isAiOAuthAccessToken,
} from '../security/aiAccessToken';
import { AI_SCOPE_STRING } from '../security/aiPermissions';

const router = Router();

function publicBaseUrl(req: Request): string {
  const configured = process.env.BACKEND_PUBLIC_URL?.trim().replace(/\/$/, '');
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('BACKEND_PUBLIC_URL is required for MCP in production');
  }
  return `${req.protocol}://${req.get('host')}`;
}

function unauthorized(req: Request, res: Response): void {
  const metadataUrl = `${publicBaseUrl(req)}/.well-known/oauth-protected-resource`;
  res.setHeader(
    'WWW-Authenticate',
    `Bearer resource_metadata="${metadataUrl}", scope="${AI_SCOPE_STRING}"`
  );
  res.status(401).json({
    jsonrpc: '2.0',
    error: { code: -32001, message: 'ClearBaseへの接続が必要です' },
    id: null,
  });
}

async function validateMcpToken(rawToken: string) {
  if (!isAiAccessToken(rawToken)) return null;
  const tokenHash = hashAiAccessToken(rawToken);
  const oauth = isAiOAuthAccessToken(rawToken);
  const record = await prisma.aiAccessToken.findFirst({
    where: oauth
      ? { authType: 'OAUTH', accessTokenHash: tokenHash }
      : { authType: 'MANUAL', tokenHash },
    select: {
      id: true,
      revokedAt: true,
      expiresAt: true,
      accessTokenExpiresAt: true,
      scopes: true,
    },
  });
  if (!record || record.revokedAt) return null;
  const expiry = oauth ? record.accessTokenExpiresAt : record.expiresAt;
  if (expiry && expiry <= new Date()) return null;
  if (oauth && !expiry) return null;
  return record;
}

router.post('/mcp', async (req, res) => {
  const rawToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim() || '';
  try {
    const tokenRecord = await validateMcpToken(rawToken);
    if (!tokenRecord) return unauthorized(req, res);

    const server = createClearBaseMcpServer({
      apiBaseUrl: publicBaseUrl(req),
      aiToken: rawToken,
    });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);
    res.on('close', () => {
      transport.close().catch(() => undefined);
      server.close().catch(() => undefined);
    });
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('MCP HTTP request failed:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'ClearBase MCPの処理に失敗しました' },
        id: null,
      });
    }
  }
});

router.get('/mcp', (req, res) => {
  const rawToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim() || '';
  validateMcpToken(rawToken)
    .then((record) => {
      if (!record) return unauthorized(req, res);
      res.status(405).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'このMCPはPOST方式です' },
        id: null,
      });
    })
    .catch((error) => {
      console.error('MCP authentication failed:', error);
      res.status(500).json({ error: 'MCP認証に失敗しました' });
    });
});

router.delete('/mcp', (req, res) => {
  res.status(405).json({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'このMCPはステートレスです' },
    id: null,
  });
});

export default router;
