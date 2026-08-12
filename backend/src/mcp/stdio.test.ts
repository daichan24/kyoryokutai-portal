import { describe, expect, it } from 'vitest';
import { AI_SCOPES } from '../security/aiPermissions';
import { buildMcpReauthorizationChallenge, formatClearBaseApiError } from './stdio';

describe('ClearBase MCP API error guidance', () => {
  it('turns Zod issues into user-facing Japanese field names', () => {
    expect(formatClearBaseApiError({
      error: [
        { path: ['title'], message: 'タイトルは必須です' },
        { path: ['missionId'], message: 'Required' },
      ],
    })).toBe('タイトル: タイトルは必須です、ミッション: Required');
  });

  it('keeps a specific API error instead of replacing it with a generic failure', () => {
    expect(formatClearBaseApiError({
      error: 'バリデーションエラー',
      details: 'projectName: Required',
    })).toBe('projectName: Required');
  });

  it('requests every self-service scope when an old limited connection is reauthorized', () => {
    const challenge = buildMcpReauthorizationChallenge(
      'https://clearbase.example/',
      'tasks:write:self',
    );
    const scopes = challenge.match(/\bscope="([^"]+)"/)?.[1].split(' ');
    expect(scopes).toEqual(AI_SCOPES);
    expect(challenge).toContain('error="insufficient_scope"');
  });
});
