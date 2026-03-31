import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { CalendarDays, ClipboardList, Users } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';

interface ParticipationSummary {
  mandatedCount: number;
  memberHostedEventCount: number;
  totalCumulative: number;
}

interface MatrixResponse {
  year: number;
  members: { id: string; name: string; displayOrder: number }[];
  events: { id: string; title: string; startDate: string; endDate: string; requiredSlots: number }[];
  cells: Record<string, boolean>;
}

interface AuditRow {
  id: string;
  userId: string;
  memberName: string;
  attended: boolean;
  changedByName: string;
  createdAt: string;
}

const STAFF_ROLES = ['MASTER', 'SUPPORT', 'GOVERNMENT'] as const;

function cellKey(eventId: string, userId: string) {
  return `${eventId}:${userId}`;
}

export const EventParticipationSummary: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isStaff = user && STAFF_ROLES.includes(user.role as (typeof STAFF_ROLES)[number]);
  const yearNow = new Date().getFullYear();
  const [year, setYear] = useState(yearNow);
  const [tab, setTab] = useState<'matrix' | 'admin'>('matrix');
  const [editMode, setEditMode] = useState(false);
  const [draftCells, setDraftCells] = useState<Record<string, boolean>>({});
  const [auditEventId, setAuditEventId] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formSlots, setFormSlots] = useState(1);

  const { data: summary, isLoading: summaryLoading } = useQuery<ParticipationSummary>({
    queryKey: ['event-participation-summary'],
    queryFn: async () => {
      const response = await api.get('/api/events/participation-summary');
      return response.data;
    },
  });

  const { data: matrix, isLoading: matrixLoading } = useQuery<MatrixResponse>({
    queryKey: ['mandated-team-events', 'matrix', year],
    queryFn: async () => {
      const r = await api.get<MatrixResponse>(`/api/mandated-team-events/matrix?year=${year}`);
      return r.data;
    },
    enabled: tab === 'matrix',
  });

  const { data: auditLogs = [], isLoading: auditLoading } = useQuery<AuditRow[]>({
    queryKey: ['mandated-team-events', 'audit', auditEventId],
    queryFn: async () => {
      const r = await api.get<AuditRow[]>(`/api/mandated-team-events/${auditEventId}/audit-logs`);
      return r.data || [];
    },
    enabled: !!auditEventId && tab === 'matrix',
  });

  const effectiveCells = useMemo(() => {
    if (!matrix) return {};
    if (!editMode) return matrix.cells;
    return { ...matrix.cells, ...draftCells };
  }, [matrix, editMode, draftCells]);

  const { data: mandatedList = [] } = useQuery<
    { id: string; title: string; startDate: string; endDate: string }[]
  >({
    queryKey: ['mandated-team-events', 'list', year, 'admin'],
    queryFn: async () => {
      const r = await api.get(`/api/mandated-team-events?year=${year}`);
      return r.data || [];
    },
    enabled: tab === 'admin' && !!isStaff,
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/mandated-team-events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mandated-team-events'] });
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      await api.post('/api/mandated-team-events', {
        title: formTitle.trim(),
        description: formDesc.trim() || null,
        startDate: formStart,
        endDate: formEnd,
        requiredSlots: Math.max(1, formSlots),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mandated-team-events'] });
      setFormTitle('');
      setFormDesc('');
      setFormStart('');
      setFormEnd('');
      setFormSlots(1);
    },
  });

  const saveMatrixMut = useMutation({
    mutationFn: async (changes: { eventId: string; userId: string; attended: boolean }[]) => {
      await api.post('/api/mandated-team-events/matrix/save', { changes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mandated-team-events'] });
      setDraftCells({});
      setEditMode(false);
    },
  });

  const startEdit = () => {
    if (!matrix) return;
    setDraftCells({});
    setEditMode(true);
  };

  const cancelEdit = () => {
    setDraftCells({});
    setEditMode(false);
  };

  const toggleCell = (eventId: string, userId: string) => {
    if (!matrix || !editMode) return;
    if (!isStaff && user?.id !== userId) return;
    const k = cellKey(eventId, userId);
    const base = matrix.cells[k] ?? false;
    const current = draftCells[k] !== undefined ? draftCells[k] : base;
    setDraftCells((prev) => ({ ...prev, [k]: !current }));
  };

  const saveChanges = () => {
    if (!matrix || !user) return;
    const changes: { eventId: string; userId: string; attended: boolean }[] = [];
    const keys = new Set<string>();
    for (const ev of matrix.events) {
      for (const m of matrix.members) {
        keys.add(cellKey(ev.id, m.id));
      }
    }
    for (const k of keys) {
      const [eventId, userId] = k.split(':');
      const orig = matrix.cells[k] ?? false;
      const next = draftCells[k] !== undefined ? draftCells[k] : orig;
      if (next !== orig) {
        if (!isStaff && userId !== user.id) continue;
        changes.push({ eventId, userId, attended: next });
      }
    }
    if (changes.length === 0) {
      setEditMode(false);
      return;
    }
    saveMatrixMut.mutate(changes);
  };

  const memberColWidth = 'min-w-[52px] w-[52px]';

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">イベント参加状況</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          役場・スタッフが登録する隊員参加枠はマトリクスで管理します。累計参加回数は「隊員参加枠でのチェック」と「他メンバーのイベント主催への参加（承認済み）」の内訳で表示します。
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border dark:border-gray-700 pb-2">
        <button
          type="button"
          onClick={() => {
            setTab('matrix');
            setAuditEventId(null);
          }}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'matrix'
              ? 'bg-primary text-white'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          隊員参加マトリクス
        </button>
        {isStaff && (
          <button
            type="button"
            onClick={() => setTab('admin')}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              tab === 'admin'
                ? 'bg-primary text-white'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            参加枠イベントの登録
          </button>
        )}
      </div>

      {tab === 'matrix' && (
        <>
          {summaryLoading ? (
            <div className="flex justify-center h-32">
              <LoadingSpinner />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-card dark:bg-gray-800 rounded-lg border border-border dark:border-gray-700 p-5">
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                  <Users className="h-4 w-4" />
                  累計（合計）
                </div>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {summary?.totalCumulative ?? 0}
                </p>
              </div>
              <div className="bg-card dark:bg-gray-800 rounded-lg border border-border dark:border-gray-700 p-5">
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                  <ClipboardList className="h-4 w-4" />
                  内訳: 隊員参加枠
                </div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {summary?.mandatedCount ?? 0}
                </p>
              </div>
              <div className="bg-card dark:bg-gray-800 rounded-lg border border-border dark:border-gray-700 p-5">
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                  <CalendarDays className="h-4 w-4" />
                  内訳: メンバー主催イベント参加
                </div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {summary?.memberHostedEventCount ?? 0}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  他メンバーが作成したイベントに、あなたが参加承認された回数です。
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              表示年
              <select
                value={year}
                onChange={(e) => {
                  setYear(Number(e.target.value));
                  cancelEdit();
                }}
                className="border border-border dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-900"
              >
                {[yearNow + 1, yearNow, yearNow - 1, yearNow - 2].map((y) => (
                  <option key={y} value={y}>
                    {y}年
                  </option>
                ))}
              </select>
            </label>
            {!editMode ? (
              <Button type="button" variant="outline" size="sm" onClick={startEdit}>
                更新（チェックを変更）
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  onClick={saveChanges}
                  disabled={saveMatrixMut.isPending}
                >
                  {saveMatrixMut.isPending ? '保存中…' : '変更を保存'}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={cancelEdit}>
                  キャンセル
                </Button>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {isStaff ? '全員のチェックを変更できます。' : '自分の列のみ変更できます。'}
                </span>
              </>
            )}
          </div>

          {matrixLoading || !matrix ? (
            <LoadingSpinner />
          ) : matrix.events.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {year}年に該当する隊員参加枠のイベントがありません。管理者は「参加枠イベントの登録」から追加してください。
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border dark:border-gray-700 bg-card dark:bg-gray-800 shadow-sm">
              <table className="text-xs border-collapse min-w-max">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-900/80">
                    <th className="sticky left-0 z-10 bg-gray-100 dark:bg-gray-900/80 border-b border-r border-gray-200 dark:border-gray-700 px-3 py-2 text-left font-semibold text-gray-900 dark:text-gray-100 min-w-[200px] max-w-[280px]">
                      イベント
                    </th>
                    {matrix.members.map((m) => (
                      <th
                        key={m.id}
                        className={`border-b border-gray-200 dark:border-gray-700 px-0.5 py-2 text-center font-medium text-gray-800 dark:text-gray-200 ${memberColWidth}`}
                        title={m.name}
                      >
                        <span className="block line-clamp-3 break-all text-[10px] leading-tight">{m.name}</span>
                      </th>
                    ))}
                    <th className="border-b border-gray-200 dark:border-gray-700 px-2 py-2 w-24 text-center text-gray-600 dark:text-gray-400">
                      履歴
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.events.map((ev) => (
                    <tr key={ev.id} className="border-b border-gray-100 dark:border-gray-700/80">
                      <td className="sticky left-0 z-10 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 px-3 py-2 align-top">
                        <div className="font-medium text-gray-900 dark:text-gray-100 leading-snug">{ev.title}</div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 whitespace-nowrap">
                          {ev.startDate} 〜 {ev.endDate}
                        </div>
                      </td>
                      {matrix.members.map((m) => {
                        const k = cellKey(ev.id, m.id);
                        const checked = effectiveCells[k] ?? false;
                        const canToggle =
                          editMode && (isStaff || user.id === m.id);
                        return (
                          <td key={m.id} className={`border-r border-gray-100 dark:border-gray-700/50 text-center p-1 ${memberColWidth}`}>
                            <button
                              type="button"
                              disabled={!canToggle}
                              onClick={() => toggleCell(ev.id, m.id)}
                              className={`w-9 h-9 rounded border text-sm font-bold mx-auto flex items-center justify-center ${
                                checked
                                  ? 'bg-green-100 dark:bg-green-900/40 border-green-400 text-green-800 dark:text-green-200'
                                  : 'bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-400'
                              } ${canToggle ? 'cursor-pointer hover:opacity-90' : 'cursor-default opacity-90'}`}
                              title={m.name}
                            >
                              {checked ? '✓' : ''}
                            </button>
                          </td>
                        );
                      })}
                      <td className="text-center p-1">
                        <button
                          type="button"
                          className="text-primary text-xs underline"
                          onClick={() => setAuditEventId(auditEventId === ev.id ? null : ev.id)}
                        >
                          {auditEventId === ev.id ? '閉じる' : '表示'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {auditEventId && (
            <div className="bg-card dark:bg-gray-800 rounded-lg border border-border dark:border-gray-700 p-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 text-sm">変更履歴</h3>
              {auditLoading ? (
                <LoadingSpinner />
              ) : auditLogs.length === 0 ? (
                <p className="text-xs text-gray-500">まだ変更履歴がありません。</p>
              ) : (
                <ul className="space-y-2 max-h-56 overflow-y-auto text-xs">
                  {auditLogs.map((log) => (
                    <li
                      key={log.id}
                      className="flex flex-wrap gap-x-3 gap-y-1 border-b border-gray-100 dark:border-gray-700 pb-2"
                    >
                      <span className="text-gray-500">
                        {new Date(log.createdAt).toLocaleString('ja-JP')}
                      </span>
                      <span className="font-medium text-gray-800 dark:text-gray-200">{log.memberName}</span>
                      <span>{log.attended ? '参加 ✓' : '不参加'}</span>
                      <span className="text-gray-600 dark:text-gray-400">担当: {log.changedByName}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'admin' && isStaff && (
        <div className="space-y-6">
          <section className="bg-card dark:bg-gray-800 rounded-lg border border-border dark:border-gray-700 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              隊員参加枠イベントの新規登録
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="タイトル" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} required />
              <Input
                label="必要人数（目安）"
                type="number"
                min={1}
                value={String(formSlots)}
                onChange={(e) => setFormSlots(Math.max(1, parseInt(e.target.value, 10) || 1))}
              />
              <Input label="開始日" type="date" value={formStart} onChange={(e) => setFormStart(e.target.value)} />
              <Input label="終了日" type="date" value={formEnd} onChange={(e) => setFormEnd(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">説明（任意）</label>
              <textarea
                className="w-full border border-border dark:border-gray-600 rounded-md px-3 py-2 bg-white dark:bg-gray-900 text-sm"
                rows={3}
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
              />
            </div>
            <Button
              type="button"
              onClick={() => createMut.mutate()}
              disabled={!formTitle.trim() || !formStart || !formEnd || createMut.isPending}
            >
              登録する
            </Button>
          </section>

          <section className="bg-card dark:bg-gray-800 rounded-lg border border-border dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              {year}年の登録一覧
            </h2>
            {mandatedList.length === 0 ? (
              <p className="text-sm text-gray-500">該当がありません。</p>
            ) : (
              <ul className="space-y-2">
                {mandatedList.map((ev) => (
                  <li
                    key={ev.id}
                    className="flex flex-wrap items-center justify-between gap-2 border border-border dark:border-gray-600 rounded-lg px-3 py-2"
                  >
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">{ev.title}</div>
                      <div className="text-xs text-gray-500">
                        {ev.startDate} 〜 {ev.endDate}
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      disabled={deleteMut.isPending}
                      onClick={() => {
                        if (window.confirm('この参加枠イベントを削除しますか？')) deleteMut.mutate(ev.id);
                      }}
                    >
                      削除
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      {tab === 'admin' && !isStaff && (
        <p className="text-sm text-gray-500 dark:text-gray-400">このタブは行政・サポート・マスターのみ利用できます。</p>
      )}
    </div>
  );
};
