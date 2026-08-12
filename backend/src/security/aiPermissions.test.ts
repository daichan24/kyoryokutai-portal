import { describe, expect, it } from 'vitest';
import { AI_SCOPES, requiredAiScope, scopesAllowedForRole } from './aiPermissions';

describe('AI permission routing', () => {
  it('maps the core self-service endpoints to the narrowest scope', () => {
    expect(requiredAiScope('GET', '/api/schedules?startDate=2026-08-01')).toBe('schedules:read:self');
    expect(requiredAiScope('POST', '/api/schedules')).toBe('schedules:write:self');
    expect(requiredAiScope('GET', '/api/missions/m1/tasks')).toBe('tasks:read:self');
    expect(requiredAiScope('PUT', '/api/missions/m1/tasks/t1')).toBe('tasks:write:self');
    expect(requiredAiScope('POST', '/api/missions')).toBe('missions:write:self');
    expect(requiredAiScope('DELETE', '/api/projects/p1')).toBe('projects:write:self');
    expect(requiredAiScope('GET', '/api/me/notepad/n1')).toBe('notepad:read:self');
  });

  it('denies endpoints that were not explicitly allowlisted', () => {
    expect(requiredAiScope('GET', '/api/users')).toBeNull();
    expect(requiredAiScope('POST', '/api/admin/users')).toBeNull();
    expect(requiredAiScope('GET', '/api/ai/access-tokens')).toBeNull();
  });

  it('does not issue AI scopes to support or government accounts', () => {
    expect(scopesAllowedForRole('SUPPORT')).toEqual([]);
    expect(scopesAllowedForRole('GOVERNMENT')).toEqual([]);
    expect(scopesAllowedForRole('MEMBER')).toEqual(AI_SCOPES);
    expect(scopesAllowedForRole('MASTER')).toEqual(AI_SCOPES);
  });
});
