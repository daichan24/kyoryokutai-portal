import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import type { User } from '../types';

type ConsultationAudience = 'ANY' | 'SUPPORT_ONLY' | 'GOVERNMENT_ONLY' | 'SPECIFIC_USER';

interface ConsultationRow {
  id: string;
  audience: ConsultationAudience;
  subject: string | null;
  body: string;
  status: 'OPEN' | 'RESOLVED';
  createdAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  member?: { id: string; name: string; avatarColor: string };
  targetUser?: { id: string; name: string; role: string } | null;
  resolvedBy?: { id: string; name: string } | null;
}

function audienceLabel(a: ConsultationAudience): string {
  const m: Record<ConsultationAudience, string> = {
    ANY: '誰でも（サポート・行政・マスター）',
    SUPPORT_ONLY: 'サポート担当',
    GOVERNMENT_ONLY: '行政担当',
    SPECIFIC_USER: '特定の相手',
  };
  return m[a];
}

export const Consultations: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isMember = user?.role === 'MEMBER';
  const isStaff = user?.role === 'MASTER' || user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT';

  const [audience, setAudience] = useState<ConsultationAudience>('ANY');
  const [targetUserId, setTargetUserId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');

  const { data: staffUsers = [] } = useQuery({
    queryKey: ['consultations', 'staff-users'],
    queryFn: async () => {
      const [s, g] = await Promise.all([
        api.get<User[]>('/api/users?role=SUPPORT'),
        api.get<User[]>('/api/users?role=GOVERNMENT'),
      ]);
      return [...(s.data || []), ...(g.data || [])].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    },
    enabled: isMember,
  });

  const { data: mine = [], isLoading: mineLoading } = useQuery({
    queryKey: ['consultations', 'mine'],
    queryFn: async () => {
      const r = await api.get<ConsultationRow[]>('/api/consultations/mine');
      return r.data || [];
    },
    enabled: isMember,
  });

  const { data: inbox = [], isLoading: inboxLoading } = useQuery({
    queryKey: ['consultations', 'inbox'],
    queryFn: async () => {
      const r = await api.get<ConsultationRow[]>('/api/consultations/inbox?status=OPEN');
      return r.data || [];
    },
    enabled: isStaff,
  });

  const { data: inboxAll = [], isLoading: inboxAllLoading } = useQuery({
    queryKey: ['consultations', 'inbox-all'],
    queryFn: async () => {
      const r = await api.get<ConsultationRow[]>('/api/consultations/inbox?status=ALL');
      return r.data || [];
    },
    enabled: isStaff,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      await api.post('/api/consultations', {
        audience,
        targetUserId: audience === 'SPECIFIC_USER' ? targetUserId : undefined,
        subject: subject.trim() || undefined,
        body: body.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] });
      queryClient.invalidateQueries({ queryKey: ['interview-monthly'] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['consultations', 'mine', 'inbox-preview'] });
      queryClient.invalidateQueries({ queryKey: ['consultations', 'inbox', 'task-requests-preview'] });
      setBody('');
      setSubject('');
      setTargetUserId('');
      setAudience('ANY');
    },
  });

  const resolveMut = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      await api.patch(`/api/consultations/${id}/resolve`, { resolutionNote: note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] });
      queryClient.invalidateQueries({ queryKey: ['interview-monthly'] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['consultations', 'inbox', 'task-requests-preview'] });
      setResolveId(null);
      setResolutionNote('');
    },
  });

  const pickerUsers = useMemo(() => staffUsers, [staffUsers]);

  if (!user) return null;

  if (!isMember && !isStaff) {
    return <p className="text-gray-500 p-8">この画面を表示する権限がありません。</p>;
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {isMember ? '相談' : '相談（対応）'}
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          {isMember
            ? 'サポート・行政・マスターへ相談を送れます。内容は依頼ボックスにも表示され、面談画面でも担当者が確認できます。'
            : '隊員からの相談に対応し、解決したら「対応済み」にしてください。'}
        </p>
      </div>

      {isMember && (
        <>
          <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">新しい相談</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">相手</label>
              <select
                value={audience}
                onChange={(e) => setAudience(e.target.value as ConsultationAudience)}
                className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
              >
                <option value="ANY">{audienceLabel('ANY')}</option>
                <option value="SUPPORT_ONLY">{audienceLabel('SUPPORT_ONLY')}</option>
                <option value="GOVERNMENT_ONLY">{audienceLabel('GOVERNMENT_ONLY')}</option>
                <option value="SPECIFIC_USER">{audienceLabel('SPECIFIC_USER')}</option>
              </select>
            </div>
            {audience === 'SPECIFIC_USER' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">ユーザー</label>
                <select
                  value={targetUserId}
                  onChange={(e) => setTargetUserId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                >
                  <option value="">選択してください</option>
                  {pickerUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}（{u.role === 'SUPPORT' ? 'サポート' : '行政'}）
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">件名（任意）</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                maxLength={400}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">内容</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                placeholder="相談内容を具体的に書いてください"
              />
            </div>
            <Button
              type="button"
              onClick={() => {
                if (!body.trim()) {
                  alert('内容を入力してください');
                  return;
                }
                if (audience === 'SPECIFIC_USER' && !targetUserId) {
                  alert('相手を選んでください');
                  return;
                }
                createMut.mutate();
              }}
              disabled={createMut.isPending}
            >
              送信する
            </Button>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">送った相談</h2>
            {mineLoading ? (
              <LoadingSpinner />
            ) : mine.length === 0 ? (
              <p className="text-sm text-gray-500">まだありません。</p>
            ) : (
              <ul className="space-y-3">
                {mine.map((c) => (
                  <li
                    key={c.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800/80"
                  >
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {c.subject?.trim() || '（件名なし）'}
                      </span>
                      <span
                        className={
                          c.status === 'OPEN'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-green-600 dark:text-green-400'
                        }
                      >
                        {c.status === 'OPEN' ? '未対応' : '対応済み'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {audienceLabel(c.audience)}
                      {c.targetUser && ` → ${c.targetUser.name}`} ·{' '}
                      {format(new Date(c.createdAt), 'yyyy/M/d HH:mm', { locale: ja })}
                    </p>
                    <p className="text-sm text-gray-800 dark:text-gray-200 mt-2 whitespace-pre-wrap">{c.body}</p>
                    {c.status === 'RESOLVED' && c.resolutionNote && (
                      <div className="mt-3 pt-3 border-t border-dashed border-gray-200 dark:border-gray-600 text-sm">
                        <p className="text-xs font-semibold text-gray-500">対応内容</p>
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{c.resolutionNote}</p>
                        {c.resolvedAt && (
                          <p className="text-xs text-gray-500 mt-1">
                            {format(new Date(c.resolvedAt), 'yyyy/M/d', { locale: ja })}
                            {c.resolvedBy && ` · ${c.resolvedBy.name}`}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {isStaff && (
        <>
          {inboxLoading ? (
            <LoadingSpinner />
          ) : (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">対応待ち</h2>
              {inbox.length === 0 ? (
                <p className="text-sm text-gray-500">対応待ちの相談はありません。</p>
              ) : (
                <ul className="space-y-3">
                  {inbox.map((c) => (
                    <li
                      key={c.id}
                      className="border border-amber-200 dark:border-amber-900 rounded-lg p-4 bg-amber-50/50 dark:bg-amber-950/20"
                    >
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {c.member?.name}さん — {c.subject?.trim() || '（件名なし）'}
                        </span>
                        <Button size="sm" variant="outline" onClick={() => setResolveId(c.id)}>
                          対応済みにする
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {audienceLabel(c.audience)}
                        {c.targetUser && ` → ${c.targetUser.name}`} ·{' '}
                        {format(new Date(c.createdAt), 'yyyy/M/d HH:mm', { locale: ja })}
                      </p>
                      <p className="text-sm text-gray-800 dark:text-gray-200 mt-2 whitespace-pre-wrap">{c.body}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {inboxAllLoading ? (
            <LoadingSpinner />
          ) : (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">すべて（履歴）</h2>
              <ul className="space-y-2 text-sm">
                {inboxAll.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap gap-2 border-b border-gray-100 dark:border-gray-700 py-2 text-gray-700 dark:text-gray-300"
                  >
                    <span className="font-medium">{c.member?.name}</span>
                    <span className="text-gray-500">{c.status === 'OPEN' ? '未対応' : '済'}</span>
                    <span>{c.subject?.trim() || '（件名なし）'}</span>
                    <span className="text-gray-400 text-xs ml-auto">
                      {format(new Date(c.createdAt), 'M/d', { locale: ja })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {resolveId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">対応済み</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">対応日は今日の日付で記録されます。</p>
            <div>
              <label className="block text-sm font-medium mb-1">対応内容</label>
              <textarea
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setResolveId(null)}>
                キャンセル
              </Button>
              <Button
                onClick={() => {
                  if (!resolutionNote.trim()) {
                    alert('対応内容を入力してください');
                    return;
                  }
                  resolveMut.mutate({ id: resolveId, note: resolutionNote.trim() });
                }}
                disabled={resolveMut.isPending}
              >
                保存
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
