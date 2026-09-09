import { queryClient } from './queryClient';

export interface AuthSession { epoch: number; token: string | null }
let epoch = 0;
const listeners = new Set<() => void>();
export const getAuthSession = (): AuthSession => ({ epoch, token: localStorage.getItem('token') });
export const isCurrentAuthSession = (session: AuthSession): boolean => session.epoch === epoch && session.token === localStorage.getItem('token');
export const onAuthSessionEnd = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

export const changeAuthSession = (token: string | null) => {
  epoch += 1;
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
  // Cancellation is synchronous; do not await before clearing, as a new login may occur.
  void queryClient.cancelQueries();
  queryClient.clear();
  listeners.forEach(listener => listener());
};
