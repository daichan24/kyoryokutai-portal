// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it } from 'vitest';
import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from './authStore';
import { api } from '../utils/api';
import { queryClient } from '../utils/queryClient';
const response = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({ config, data, status: 200, statusText: 'OK', headers: {} });
const originalAdapter = api.defaults.adapter;
beforeEach(() => { localStorage.clear(); queryClient.clear(); useAuthStore.getState().logout(); });
afterEach(() => { useAuthStore.getState().logout(); queryClient.clear(); api.defaults.adapter = originalAdapter; });
it('logout and different login remove private cache and cancel delayed old queries', async () => {
  api.setToken('A');
  queryClient.setQueryData(['notepads', 'A'], [{ title: 'A private' }]);
  queryClient.setQueryData(['notepad', 'A', 'one'], { content: 'A private body' });
  let complete!: (value: unknown) => void;
  const oldFetch = queryClient.fetchQuery({ queryKey: ['notepads', 'A', 'delayed'], queryFn: () => new Promise(resolve => { complete = resolve; }) }).catch(() => undefined);
  useAuthStore.getState().logout();
  api.defaults.adapter = async config => response(config, { token: 'B', user: { id: 'B', name: 'B' } });
  await useAuthStore.getState().login('b@example.test', 'fixture');
  complete([{ title: 'A delayed' }]); await oldFetch;
  expect(queryClient.getQueryData(['notepads', 'A'])).toBeUndefined();
  expect(queryClient.getQueryData(['notepad', 'A', 'one'])).toBeUndefined();
  expect(queryClient.getQueryData(['notepads', 'A', 'delayed'])).toBeUndefined();
  expect(localStorage.getItem('token')).toBe('B');
});
it('delayed fetchMe 401 cannot clear a newer login token or user', async () => {
  api.setToken('A'); let fail!: () => void;
  api.defaults.adapter = config => config.url === '/api/auth/me' ? new Promise((_resolve, reject) => { fail = () => reject(new AxiosError('expired', 'ERR_BAD_REQUEST', config, undefined, { ...response(config, {}), status: 401 })); }) : Promise.resolve(response(config, { token: 'B', user: { id: 'B', name: 'B' } }));
  const old = useAuthStore.getState().fetchMe(); await Promise.resolve();
  useAuthStore.getState().logout(); await useAuthStore.getState().login('b@example.test', 'fixture');
  fail(); await old;
  expect(localStorage.getItem('token')).toBe('B'); expect(useAuthStore.getState().user?.id).toBe('B');
});
it('an old safe-request retry never runs with the replacement token', async () => {
  api.setToken('A'); const sent: string[] = [];
  api.defaults.adapter = async config => { sent.push(String(config.headers.Authorization)); throw new AxiosError('unavailable', 'ERR_BAD_RESPONSE', config, undefined, { ...response(config, {}), status: 503 }); };
  const request = api.get('/api/me/notepad').catch(() => undefined);
  await new Promise(resolve => setTimeout(resolve, 10));
  useAuthStore.getState().logout(); api.setToken('B');
  await request;
  expect(sent).toEqual(['Bearer A']); expect(localStorage.getItem('token')).toBe('B');
});
