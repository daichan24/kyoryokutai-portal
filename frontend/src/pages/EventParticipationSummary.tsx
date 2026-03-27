import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { CalendarDays, Award, TrendingUp, Users, ClipboardList } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';

interface ParticipationSummary {
  thisMonthCount: number;
  totalCount: number;
  totalPoints: number;
}

interface MandatedEventRow {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  requiredSlots: number;
  attendedCount: number;
  totalRows: number;
  creator: { id: string; name: string };
}

interface YearSummary {
  year: number;
  members: { userId: string; name: string; count: number }[];
  events: {
    id: string;
    title: string;
    startDate: string;
    endDate: string;
    requiredSlots: number;
    attendedCount: number;
  }[];
  stats: { avg: number; min: number; max: number; spread: number };
}

interface MandatedDetail {
  id: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  requiredSlots: number;
  members: {
    userId: string;
    name: string;
    attended: boolean;
    avatarColor?: string;
    avatarLetter?: string | null;
  }[];
}

const STAFF_ROLES = ['MASTER', 'SUPPORT', 'GOVERNMENT'] as const;

export const EventParticipationSummary: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isStaff = user && STAFF_ROLES.includes(user.role as (typeof STAFF_ROLES)[number]);
  const yearNow = new Date().getFullYear();
  const [year, setYear] = useState(yearNow);
  const [tab, setTab] = useState<'personal' | 'mandated'>('personal');

  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formSlots, setFormSlots] = useState(1);
  const [selectedMandatedId, setSelectedMandatedId] = useState<string | null>(null);

  const { data: summary, isLoading: summaryLoading } = useQuery<ParticipationSummary>({
    queryKey: ['event-participation-summary'],
    queryFn: async () => {
      const response = await api.get('/api/events/participation-summary');
      return response.data;
    },
    enabled: tab === 'personal',
  });

  const { data: mandatedList = [], isLoading: mandatedLoading } = useQuery<MandatedEventRow[]>({
    queryKey: ['mandated-team-events', year],
    queryFn: async () => {
      const r = await api.get<MandatedEventRow[]>(`/api/mandated-team-events?year=${year}`);
      return r.data || [];
    },
    enabled: tab === 'mandated',
  });

  const { data: yearSummary, isLoading: yearSummaryLoading } = useQuery<YearSummary>({
    queryKey: ['mandated-team-events', 'summary', year],
    queryFn: async () => {
      const r = await api.get<YearSummary>(`/api/mandated-team-events/summary/year?year=${year}`);
      return r.data;
    },
    enabled: tab === 'mandated',
  });

  const { data: mandatedDetail, isLoading: detailLoading } = useQuery<MandatedDetail>({
    queryKey: ['mandated-team-events', 'detail', selectedMandatedId],
    queryFn: async () => {
      const r = await api.get<MandatedDetail>(`/api/mandated-team-events/${selectedMandatedId}/detail`);
      return r.data;
    },
    enabled: !!selectedMandatedId && tab === 'mandated',
  });

  const createMut = useMutation({
    mutationFn: async () => {
      await api.post('/api/mandated-team-events', {
        title: formTitle.trim(),
        description: formDesc.trim() || null,
        startDate: formStart,
        endDate: formEnd,
        requiredSlots: formSlots,
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

  const attendanceMut = useMutation({
    mutationFn: async ({ userId, attended }: { userId: string; attended: boolean }) => {
      if (!selectedMandatedId) return;
      await api.patch(`/api/mandated-team-events/${selectedMandatedId}/attendance`, { userId, attended });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mandated-team-events'] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/mandated-team-events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mandated-team-events'] });
      setSelectedMandatedId(null);
    },
  });

  const maxCount = useMemo(() => {
    if (!yearSummary?.members.length) return 1;
    return Math.max(1, ...yearSummary.members.map((m) => m.count));
  }, [yearSummary]);

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">イベント参加状況</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          個人のイベント参加記録と、役場・スタッフが登録する「隊員参加が必要な業務イベント」の集計をまとめて確認できます。
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border dark:border-gray-700 pb-2">
        <button
          type="button"
          onClick={() => setTab('personal')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'personal'
              ? 'bg-primary text-white'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          個人の参加記録
        </button>
        <button
          type="button"
          onClick={() => setTab('mandated')}
          className={`px-4 py-2 rounded-lg text-sm font-medium ${
            tab === 'mandated'
              ? 'bg-primary text-white'
              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          隊員参加枠（役場・スタッフ登録）
        </button>
      </div>

      {tab === 'personal' && (
        <>
          {summaryLoading ? (
            <div className="flex justify-center h-48">
              <LoadingSpinner />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-card dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <CalendarDays className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-medium text-gray-600 dark:text-gray-400">今月の参加回数</h2>
                      <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                        {summary?.thisMonthCount || 0}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-card dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-medium text-gray-600 dark:text-gray-400">累計参加回数</h2>
                      <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                        {summary?.totalCount || 0}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="bg-card dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-3 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                      <Award className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div>
                      <h2 className="text-sm font-medium text-gray-600 dark:text-gray-400">参加ポイント合計</h2>
                      <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                        {summary?.totalPoints?.toFixed(1) || '0.0'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-card dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">補足</h2>
                <div className="space-y-2 text-gray-600 dark:text-gray-400 text-sm">
                  <p>ここは「個人イベント」への参加や、既存のイベント機能で記録された参加の集計です。</p>
                  <p>町・スタッフが指定する隊員参加枠の集計は「隊員参加枠」タブを開いてください。</p>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'mandated' && (
        <div className="space-y-8">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              集計年
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="border border-border dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-900"
              >
                {[yearNow + 1, yearNow, yearNow - 1, yearNow - 2].map((y) => (
                  <option key={y} value={y}>
                    {y}年
                  </option>
                ))}
              </select>
            </label>
          </div>

          {yearSummaryLoading ? (
            <LoadingSpinner />
          ) : yearSummary ? (
            <section className="bg-card dark:bg-gray-800 rounded-lg border border-border dark:border-gray-700 p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Users className="h-5 w-5" />
                {year}年の参加回数（隊員別・均等化の目安）
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                チェック済みの参加のみカウントします。平均 {yearSummary.stats.avg} 回、最小 {yearSummary.stats.min} 回、最大{' '}
                {yearSummary.stats.max} 回（ばらつき {yearSummary.stats.spread}）。
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-border dark:border-gray-600 text-left">
                      <th className="py-2 pr-4">隊員</th>
                      <th className="py-2 pr-4 w-28">参加回数</th>
                      <th className="py-2">比較（最大に対する割合）</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearSummary.members.map((m) => (
                      <tr key={m.userId} className="border-b border-border/60 dark:border-gray-700/80">
                        <td className="py-2 pr-4 font-medium text-gray-900 dark:text-gray-100">{m.name}</td>
                        <td className="py-2 pr-4">{m.count}</td>
                        <td className="py-2">
                          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden max-w-xs">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${maxCount ? (m.count / maxCount) * 100 : 0}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {isStaff && (
            <section className="bg-card dark:bg-gray-800 rounded-lg border border-border dark:border-gray-700 p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                隊員参加枠の新規登録（MASTER / サポート / 行政）
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
          )}

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {year}年に期間が重なる枠一覧
            </h2>
            {mandatedLoading ? (
              <LoadingSpinner />
            ) : mandatedList.length === 0 ? (
              <p className="text-sm text-gray-500">該当する登録がありません。</p>
            ) : (
              <ul className="space-y-2">
                {mandatedList.map((ev) => (
                  <li key={ev.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedMandatedId(ev.id === selectedMandatedId ? null : ev.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                        selectedMandatedId === ev.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border dark:border-gray-700 bg-card dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }`}
                    >
                      <div className="font-medium text-gray-900 dark:text-gray-100">{ev.title}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {ev.startDate} 〜 {ev.endDate} ／ 必要 {ev.requiredSlots} 名 ／ 参加チェック {ev.attendedCount} /{' '}
                        {ev.totalRows}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {selectedMandatedId && (
            <section className="bg-card dark:bg-gray-800 rounded-lg border border-border dark:border-gray-700 p-6 space-y-4">
              {detailLoading || !mandatedDetail ? (
                <LoadingSpinner />
              ) : (
                <>
                  <div className="flex flex-wrap justify-between gap-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{mandatedDetail.title}</h3>
                    {isStaff && (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          if (window.confirm('この登録を削除しますか？')) deleteMut.mutate(mandatedDetail.id);
                        }}
                        disabled={deleteMut.isPending}
                      >
                        削除
                      </Button>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {mandatedDetail.startDate} 〜 {mandatedDetail.endDate} ／ 必要人数 {mandatedDetail.requiredSlots} 名
                  </p>
                  {mandatedDetail.description && (
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {mandatedDetail.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    隊員は自分の行のみ変更できます。スタッフは全員分を変更できます。
                  </p>
                  <ul className="divide-y divide-border dark:divide-gray-700">
                    {mandatedDetail.members.map((m) => {
                      const canEdit = isStaff || user.id === m.userId;
                      return (
                        <li key={m.userId} className="flex items-center justify-between gap-3 py-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{m.name}</span>
                          <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={m.attended}
                              disabled={!canEdit || attendanceMut.isPending}
                              onChange={(e) =>
                                attendanceMut.mutate({ userId: m.userId, attended: e.target.checked })
                              }
                              className="rounded border-gray-300 text-primary"
                            />
                            参加した
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
};
