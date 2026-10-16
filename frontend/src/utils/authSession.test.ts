// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { changeAuthSession, getAuthSession, isCurrentAuthSession, renewSessionToken } from './authSession';

describe('renewSessionToken', () => {
  beforeEach(() => changeAuthSession('token-a'));

  it('keeps requests started with the old token valid after renewal', () => {
    const before = getAuthSession();
    renewSessionToken('token-b');
    expect(localStorage.getItem('token')).toBe('token-b');
    expect(isCurrentAuthSession(before)).toBe(true);
    expect(isCurrentAuthSession(getAuthSession())).toBe(true);
  });

  it('still ends old sessions on logout or another login', () => {
    const before = getAuthSession();
    renewSessionToken('token-b');
    changeAuthSession('token-other-user');
    expect(isCurrentAuthSession(before)).toBe(false);
    changeAuthSession(null);
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('does nothing when logged out', () => {
    changeAuthSession(null);
    renewSessionToken('token-b');
    expect(localStorage.getItem('token')).toBeNull();
  });
});
