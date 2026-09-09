// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { MemoryRouter, Routes, Route, useNavigate, NavigateFunction } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { NotepadPage } from './NotepadPage';
import { queryClient } from '../utils/queryClient';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import type { User } from '../types';
let root: Root, container: HTMLDivElement, routeTo: NavigateFunction;
let writes: Array<{ url: string; title: string; content: string; token: string }>;
let records: Record<string, { id: string; title: string; content: string; order: number; createdAt: string; updatedAt: string }>;
let put: ((config: InternalAxiosRequestConfig) => Promise<AxiosResponse>) | undefined;
const originalAdapter = api.defaults.adapter;
const response = (config: InternalAxiosRequestConfig, data: unknown): AxiosResponse => ({ config, data, status: 200, statusText: 'OK', headers: {} });
const settle = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(0); }); };
const navigate = async (path: string) => { await act(async () => { routeTo(path); }); await settle(); };
const edit = async (text: string) => { await act(async () => { const editor = container.querySelector('[contenteditable]')!; editor.textContent = text; editor.dispatchEvent(new Event('input', { bubbles: true })); }); };
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); vi.useFakeTimers(); queryClient.clear(); useAuthStore.getState().logout();
  api.setToken('A'); useAuthStore.setState({ user: { id: 'A', name: 'A' } as User, isAuthenticated: true }); writes = []; put = undefined;
  records = Object.fromEntries(['one', 'two'].map(id => [id, { id, title: id, content: 'original '+id, order: 0, createdAt: '2026-09-07T00:00:00Z', updatedAt: '2026-09-07T00:00:00Z' }]));
  api.defaults.adapter = async config => {
    if (config.method === 'put') {
      const data = JSON.parse(config.data); writes.push({ url: config.url!, ...data, token: String(config.headers.Authorization) });
      if (put) return put(config);
      const id = config.url!.split('/').pop()!; records[id] = { ...records[id], ...data }; return response(config, records[id]);
    }
    const id = config.url!.split('/').pop()!; return response(config, id === 'notepad' ? Object.values(records) : records[id]);
  };
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  const Navigation = () => { routeTo = useNavigate(); return <Routes><Route path="/notepad/:id" element={<NotepadPage />} /><Route path="/elsewhere" element={<div>別画面</div>} /></Routes>; };
  await act(async () => root.render(<QueryClientProvider client={queryClient}><MemoryRouter initialEntries={['/notepad/one']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Navigation /></MemoryRouter></QueryClientProvider>)); await settle();
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); useAuthStore.getState().logout(); queryClient.clear(); api.defaults.adapter = originalAdapter; vi.useRealTimers(); });
it('persists editing when route navigation occurs before two seconds', async () => {
  await edit('移動直前'); await navigate('/elsewhere'); await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
  expect(writes.some(w => w.url.endsWith('/one') && w.content === '移動直前')).toBe(true);
});
it('memo switching preserves both edits under the right IDs', async () => {
  await edit('一つ目'); await navigate('/notepad/two'); await edit('二つ目');
  await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
  expect(writes.map(w => [w.url.split('/').pop(), w.content])).toEqual([['one', '一つ目'], ['two', '二つ目']]);
});
it('an older save response cannot overwrite a second edit while in flight', async () => {
  let finish!: () => void;
  put = config => new Promise(resolve => { finish = () => { const data = JSON.parse(config.data); records.one = { ...records.one, ...data }; resolve(response(config, records.one)); }; });
  await edit('first edit'); await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  await edit('latest edit'); const complete = finish; put = undefined; await act(async () => complete()); await settle();
  expect(container.querySelector('[contenteditable]')?.textContent).toBe('latest edit');
  await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
  expect(writes.at(-1)?.content).toBe('latest edit');
});
it('failed save survives route return and allows explicit retry', async () => {
  put = async config => { throw new AxiosError('offline', 'ERR_NETWORK', config); };
  await edit('失敗後も保持'); await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
  await navigate('/elsewhere'); await navigate('/notepad/one');
  expect(container.querySelector('[contenteditable]')?.textContent).toBe('失敗後も保持');
  expect(container.textContent).toContain('保存に失敗');
  put = undefined; const retry = [...container.querySelectorAll('button')].find(b => /再試行|再保存/.test(b.textContent || ''));
  expect(retry).toBeTruthy(); await act(async () => retry!.click()); await settle();
  expect(records.one.content).toBe('失敗後も保持');
});
it('pending previous-user edits are never sent with the new user token', async () => {
  await edit('A only'); await act(async () => { useAuthStore.getState().logout(); api.setToken('B'); useAuthStore.setState({ user: { id: 'B' } as User, isAuthenticated: true }); });
  await navigate('/elsewhere'); await act(async () => { await vi.advanceTimersByTimeAsync(2100); });
  expect(writes.filter(w => w.content === 'A only' && w.token === 'Bearer B')).toEqual([]);
});
it('routine autosave still waits two seconds and marks the latest edit saved', async () => {
  await edit('通常の自動保存');
  await act(async () => { await vi.advanceTimersByTimeAsync(1999); }); expect(writes).toHaveLength(0);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); }); await settle();
  expect(records.one.content).toBe('通常の自動保存'); expect(container.textContent).toContain('保存済');
});
it('a completed prior-user save cannot repopulate private cache after login changes', async () => {
  let finish!: () => void;
  put = config => new Promise(resolve => { finish = () => resolve(response(config, { ...records.one, content: 'A private delayed' })); });
  await edit('A private delayed'); await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  await act(async () => { useAuthStore.getState().logout(); api.setToken('B'); useAuthStore.setState({ user: { id: 'B' } as User, isAuthenticated: true }); });
  await navigate('/elsewhere'); await act(async () => finish()); await settle();
  expect(queryClient.getQueryData(['notepad', 'A', 'one'])).toBeUndefined();
  expect(queryClient.getQueryCache().findAll().some(q => JSON.stringify(q.state.data).includes('A private delayed'))).toBe(false);
  expect(localStorage.getItem('token')).toBe('B');
});
it('failed deletion does not discard edits whose save also failed', async () => {
  put = async config => { throw new AxiosError('offline', 'ERR_NETWORK', config); };
  const adapter = api.defaults.adapter as (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>;
  api.defaults.adapter = async config => { if (config.method === 'delete') throw new AxiosError('offline', 'ERR_NETWORK', config); return adapter(config); };
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
  await edit('削除失敗時も保持'); await act(async () => container.querySelector<HTMLButtonElement>('[title="削除"]')!.click()); await settle();
  expect(container.querySelector('[contenteditable]')?.textContent).toBe('削除失敗時も保持');
  confirm.mockRestore();
});
it('stale detail and list GETs cannot replace a newer committed memo after returning', async () => {
  await navigate('/elsewhere');
  await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
  const oldDetail = { ...records.one };
  const oldList = Object.values(records).map(record => ({ ...record }));
  const adapter = api.defaults.adapter as (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>;
  const releaseReads: Array<() => void> = [];
  api.defaults.adapter = config => {
    if (config.method === 'get' && releaseReads.length < 2 && ['/api/me/notepad', '/api/me/notepad/one'].includes(config.url!)) {
      return new Promise(resolve => releaseReads.push(() => resolve(response(config, config.url!.endsWith('/one') ? oldDetail : oldList))));
    }
    return adapter(config);
  };
  await navigate('/notepad/one');
  expect(releaseReads).toHaveLength(2);
  await act(async () => {
    const input = container.querySelector<HTMLInputElement>('input[type="text"]')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '最新タイトル');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await edit('最新本文');
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); }); await settle();
  expect(records.one).toMatchObject({ title: '最新タイトル', content: '最新本文' });
  await act(async () => { releaseReads.forEach(release => release()); }); await settle();
  expect(container.querySelector('[contenteditable]')?.textContent).toBe('最新本文');
  expect(container.querySelector<HTMLInputElement>('input[type="text"]')?.value).toBe('最新タイトル');
  expect(container.querySelector('aside p.truncate')?.textContent).toBe('最新タイトル');
  expect(queryClient.getQueryData(['notepad', 'A', 'one'])).toMatchObject({ title: '最新タイトル', content: '最新本文' });
});
it('cancelling an obsolete first list read still loads the complete memo list', async () => {
  await navigate('/elsewhere');
  queryClient.removeQueries({ queryKey: ['notepads', 'A'], exact: true });
  const adapter = api.defaults.adapter as (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>;
  let releaseOldList!: () => void;
  let delayed = false;
  api.defaults.adapter = config => {
    if (config.method === 'get' && config.url === '/api/me/notepad' && !delayed) {
      delayed = true;
      const oldList = Object.values(records).map(record => ({ ...record }));
      return new Promise(resolve => { releaseOldList = () => resolve(response(config, oldList)); });
    }
    return adapter(config);
  };
  await navigate('/notepad/one'); await edit('保存した本文');
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); }); await settle();
  await act(async () => releaseOldList()); await settle();
  expect([...container.querySelectorAll('aside p.truncate')].map(node => node.textContent)).toEqual(['one', 'two']);
  expect(container.querySelector('[contenteditable]')?.textContent).toBe('保存した本文');
});
it('recovers an uncached list when an older PUT succeeds and the latest PUT fails', async () => {
  await navigate('/elsewhere');
  queryClient.removeQueries({ queryKey: ['notepads', 'A'], exact: true });
  const adapter = api.defaults.adapter as (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>;
  let releaseOldList!: () => void;
  let delayed = false;
  api.defaults.adapter = config => {
    if (config.method === 'get' && config.url === '/api/me/notepad' && !delayed) {
      delayed = true;
      const oldList = Object.values(records).map(record => ({ ...record }));
      return new Promise(resolve => { releaseOldList = () => resolve(response(config, oldList)); });
    }
    return adapter(config);
  };
  let completeFirstSave!: () => void;
  put = config => new Promise(resolve => {
    completeFirstSave = () => {
      records.one = { ...records.one, ...JSON.parse(config.data) };
      resolve(response(config, records.one));
    };
  });
  await navigate('/notepad/one'); await edit('先に保存する本文');
  await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
  await edit('失敗しても保持する最新本文');
  put = async config => { throw new AxiosError('offline', 'ERR_NETWORK', config); };
  await act(async () => completeFirstSave()); await settle();
  expect(writes).toHaveLength(2);
  await act(async () => releaseOldList()); await settle();
  expect([...container.querySelectorAll('aside p.truncate')].map(node => node.textContent)).toEqual(['one', 'two']);
  expect(container.querySelector('[contenteditable]')?.textContent).toBe('失敗しても保持する最新本文');
  expect(container.textContent).toContain('保存に失敗');
  put = undefined;
  const retry = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('再試行'));
  expect(retry).toBeTruthy(); await act(async () => retry!.click()); await settle();
  expect(records.one.content).toBe('失敗しても保持する最新本文');
});
