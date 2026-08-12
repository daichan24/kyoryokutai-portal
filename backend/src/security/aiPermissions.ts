import type { Role } from '@prisma/client';

export const AI_SCOPES = [
  'tasks:read:self',
  'tasks:write:self',
  'schedules:read:self',
  'schedules:write:self',
  'notepad:read:self',
  'notepad:write:self',
  'missions:read:self',
  'missions:write:self',
  'projects:read:self',
  'projects:write:self',
] as const;

export type AiScope = (typeof AI_SCOPES)[number];

export const AI_SCOPE_STRING = AI_SCOPES.join(' ');

type ScopeRule = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: RegExp;
  scope: AiScope;
};

const RULES: ScopeRule[] = [
  { method: 'GET', path: /^\/api\/missions\/[^/]+\/tasks(?:\/|$|\?)/, scope: 'tasks:read:self' },
  { method: 'POST', path: /^\/api\/missions\/[^/]+\/tasks(?:\/|$|\?)/, scope: 'tasks:write:self' },
  { method: 'PUT', path: /^\/api\/missions\/[^/]+\/tasks\/[^/]+(?:\/|$|\?)/, scope: 'tasks:write:self' },
  { method: 'DELETE', path: /^\/api\/missions\/[^/]+\/tasks\/[^/]+(?:\/|$|\?)/, scope: 'tasks:write:self' },
  { method: 'GET', path: /^\/api\/schedules(?:\/|$|\?)/, scope: 'schedules:read:self' },
  { method: 'POST', path: /^\/api\/schedules(?:\/|$|\?)/, scope: 'schedules:write:self' },
  { method: 'PUT', path: /^\/api\/schedules\/[^/]+(?:\/|$|\?)/, scope: 'schedules:write:self' },
  { method: 'DELETE', path: /^\/api\/schedules\/[^/]+(?:\/|$|\?)/, scope: 'schedules:write:self' },
  { method: 'GET', path: /^\/api\/me\/notepad(?:\/|$|\?)/, scope: 'notepad:read:self' },
  { method: 'POST', path: /^\/api\/me\/notepad(?:\/|$|\?)/, scope: 'notepad:write:self' },
  { method: 'PUT', path: /^\/api\/me\/notepad\/[^/]+(?:\/|$|\?)/, scope: 'notepad:write:self' },
  { method: 'DELETE', path: /^\/api\/me\/notepad\/[^/]+(?:\/|$|\?)/, scope: 'notepad:write:self' },
  { method: 'GET', path: /^\/api\/missions(?:\/|$|\?)/, scope: 'missions:read:self' },
  { method: 'POST', path: /^\/api\/missions(?:\/|$|\?)/, scope: 'missions:write:self' },
  { method: 'PUT', path: /^\/api\/missions\/[^/]+(?:\/|$|\?)/, scope: 'missions:write:self' },
  { method: 'DELETE', path: /^\/api\/missions\/[^/]+(?:\/|$|\?)/, scope: 'missions:write:self' },
  { method: 'GET', path: /^\/api\/projects(?:\/|$|\?)/, scope: 'projects:read:self' },
  { method: 'POST', path: /^\/api\/projects(?:\/|$|\?)/, scope: 'projects:write:self' },
  { method: 'PUT', path: /^\/api\/projects\/[^/]+(?:\/|$|\?)/, scope: 'projects:write:self' },
  { method: 'DELETE', path: /^\/api\/projects\/[^/]+(?:\/|$|\?)/, scope: 'projects:write:self' },
];

export function scopesAllowedForRole(role: Role): readonly AiScope[] {
  if (role === 'MEMBER' || role === 'MASTER') return AI_SCOPES;
  return [];
}

export function requiredAiScope(method: string, originalUrl: string): AiScope | null {
  const normalizedMethod = method.toUpperCase() as ScopeRule['method'];
  const rule = RULES.find((candidate) => (
    candidate.method === normalizedMethod && candidate.path.test(originalUrl)
  ));
  return rule?.scope ?? null;
}

export function isAiWriteMethod(method: string): boolean {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());
}
