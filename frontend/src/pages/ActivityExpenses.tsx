import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import type { User } from '../types';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { sortUsersByDisplayOrder } from '../utils/userSort';

function formatYen(n: number) {
  return `¥${n.toLocaleString('ja-JP')}`;
}

const QUICK_AMOUNT_OPTIONS = [500, 1000, 3000, 5000, 10000];
type ExpenseStatus = 'PLANNED' | 'PENDING' | 'APPROVED' | 'REJECTED';
type ExpenseStatusFilter = 'ALL' | ExpenseStatus;
type EntryMode = 'PENDING' | 'PLANNED';

interface ExpenseEntry {
  id: string;
  spentAt: string;
  description: string;
  amount: number;
  projectId?: string | null;
  project?: { id: string; projectName: string; missionId?: string | null } | null;
  scheduleId?: string | null;
  schedule?: { id: string; title?: string | null; startDate?: string | null; endDate?: string | null; startTime?: string | null; endTime?: string | null } | null;
  createdAt: string;
  status?: ExpenseStatus;
  rejectionReason?: string | null;
  createdBy?: { id: string; name: string } | null;
  updatedBy?: { id: string; name: string } | null;
}

interface ProjectOption {
  id: string;
  projectName: string;
  missionId?: string | null;
}

interface ExpenseSummary {
  allocatedAmount: number;
  totalSpent: number;
  remaining: number;
  memo: string | null;
  budgetUpdatedAt: string | null;
  budgetUpdatedBy?: { id: string; name: string } | null;
  entries: ExpenseEntry[];
}

export const ActivityExpenses: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const isStaff = user?.role === 'MASTER' || user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT';

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetMemo, setBudgetMemo] = useState('');
  const [spentAt, setSpentAt] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entryMode, setEntryMode] = useState<EntryMode>('PENDING');
  const [projectIdForEntry, setProjectIdForEntry] = useState('');
  const [scheduleIdForEntry, setScheduleIdForEntry] = useState('');
  const [expenseStatusFilter, setExpenseStatusFilter] = useState<ExpenseStatusFilter>('ALL');
  const scheduleIdFromQuery = searchParams.get('scheduleId') || '';
  const appliedScheduleParamsRef = React.useRef<string | null>(null);

  const effectiveUserId = isStaff ? selectedMemberId : user?.id ?? null;

  const { data: memberProjects = [] } = useQuery<ProjectOption[]>({
    queryKey: ['activity-expenses', 'projects', effectiveUserId],
    queryFn: async () => {
      const r = await api.get<ProjectOption[]>(`/api/projects?userId=${effectiveUserId}`);
      return r.data || [];
    },
    enabled: Boolean(effectiveUserId),
  });

  const { data: members = [], isLoading: membersLoading } = useQuery<User[]>({
    queryKey: ['activity-expenses', 'members'],
    queryFn: async () => {
      const r = await api.get<User[]>('/api/users?role=MEMBER');
      return r.data || [];
    },
    enabled: isStaff,
  });

  const sortedMembers = useMemo(
    () => sortUsersByDisplayOrder(members),
    [members]
  );

  const { data: summary, isLoading: summaryLoading } = useQuery<ExpenseSummary>({
    queryKey: ['activity-expenses', 'summary', effectiveUserId],
    queryFn: async () => {
      const params = isStaff ? { userId: effectiveUserId } : {};
      const r = await api.get<ExpenseSummary>('/api/activity-expenses/summary', { params });
      return r.data;
    },
    enabled: Boolean(effectiveUserId),
  });

  React.useEffect(() => {
    if (summary && isStaff) {
      setBudgetAmount(String(summary.allocatedAmount));
      setBudgetMemo(summary.memo || '');
    }
  }, [summary?.allocatedAmount, summary?.memo, isStaff, effectiveUserId]);

  React.useEffect(() => {
    if (!scheduleIdFromQuery || appliedScheduleParamsRef.current === scheduleIdFromQuery) return;
    appliedScheduleParamsRef.current = scheduleIdFromQuery;
    const queryUserId = searchParams.get('userId');
    if (isStaff && queryUserId) setSelectedMemberId(queryUserId);
    const queryDate = searchParams.get('date');
    const queryDescription = searchParams.get('description');
    const queryProjectId = searchParams.get('projectId');
    setScheduleIdForEntry(scheduleIdFromQuery);
    if (queryDate) setSpentAt(queryDate);
    if (queryDescription) setDescription(queryDescription);
    if (queryProjectId) setProjectIdForEntry(queryProjectId);
  }, [isStaff, scheduleIdFromQuery, searchParams]);

  const clearScheduleParams = () => {
    if (!scheduleIdFromQuery) return;
    const next = new URLSearchParams(searchParams);
    ['scheduleId', 'date', 'description', 'projectId', 'userId'].forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['activity-expenses'] });
    queryClient.invalidateQueries({ queryKey: ['interview-monthly'] });
  };

  const budgetMut = useMutation({
    mutationFn: async () => {
      const n = parseInt(budgetAmount.replace(/[,]/g, ''), 10);
      if (Number.isNaN(n) || n < 0) throw new Error('INVALID');
      await api.put('/api/activity-expenses/budget', {
        userId: effectiveUserId,
        allocatedAmount: n,
        memo: budgetMemo.trim() || null,
      });
    },
    onSuccess: invalidate,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const n = parseInt(amount.replace(/[,]/g, ''), 10);
      if (Number.isNaN(n) || n < 1) throw new Error('INVALID');
      await api.post('/api/activity-expenses/entries', {
        userId: isStaff ? effectiveUserId : undefined,
        projectId: projectIdForEntry,
        scheduleId: scheduleIdForEntry || undefined,
        spentAt,
        description: description.trim(),
        amount: n,
        status: entryMode,
      });
    },
    onSuccess: () => {
      invalidate();
      setDescription('');
      setAmount('');
      setProjectIdForEntry('');
      setScheduleIdForEntry('');
      setEntryMode('PENDING');
      setSpentAt(format(new Date(), 'yyyy-MM-dd'));
      clearScheduleParams();
    },
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      const n = parseInt(amount.replace(/[,]/g, ''), 10);
      if (!editingId || Number.isNaN(n) || n < 1) throw new Error('INVALID');
      const body: Record<string, unknown> = {
        spentAt,
        description: description.trim(),
        amount: n,
        status: entryMode,
      };
      if (projectIdForEntry) body.projectId = projectIdForEntry;
      body.scheduleId = scheduleIdForEntry || null;
      await api.put(`/api/activity-expenses/entries/${editingId}`, body);
    },
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      setDescription('');
      setAmount('');
      setProjectIdForEntry('');
      setScheduleIdForEntry('');
      setEntryMode('PENDING');
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/activity-expenses/entries/${id}`);
    },
    onSuccess: invalidate,
  });

  const reopenMut = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/api/activity-expenses/entries/${id}/reopen`);
    },
    onSuccess: invalidate,
  });

  const startEdit = (e: ExpenseEntry) => {
    setEditingId(e.id);
    setSpentAt(e.spentAt.slice(0, 10));
    setDescription(e.description);
    setAmount(String(e.amount));
    setProjectIdForEntry(e.projectId || '');
    setScheduleIdForEntry(e.scheduleId || '');
    setEntryMode(e.status === 'PLANNED' ? 'PLANNED' : 'PENDING');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDescription('');
    setAmount('');
    setProjectIdForEntry('');
    setScheduleIdForEntry('');
    setEntryMode('PENDING');
    setSpentAt(format(new Date(), 'yyyy-MM-dd'));
    clearScheduleParams();
  };

  const filteredEntries = useMemo(() => {
    const entries = summary?.entries || [];
    if (expenseStatusFilter === 'ALL') return entries;
    return entries.filter((entry) => (entry.status || 'PENDING') === expenseStatusFilter);
  }, [summary?.entries, expenseStatusFilter]);

  const statusCounts = useMemo(() => {
    const entries = summary?.entries || [];
    return {
      ALL: entries.length,
      PLANNED: entries.filter((entry) => entry.status === 'PLANNED').length,
      PENDING: entries.filter((entry) => (entry.status || 'PENDING') === 'PENDING').length,
      APPROVED: entries.filter((entry) => entry.status === 'APPROVED').length,
      REJECTED: entries.filter((entry) => entry.status === 'REJECTED').length,
    };
  }, [summary?.entries]);

  if (!user) return null;

  return (
    <div className="w-full max-w-none space-y-6">
      <details className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-200">
          対象経費一覧を確認
        </summary>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400 mb-4">
          長沼町地域おこし協力隊活動費補助金交付要綱に基づく対象経費です。詳細は役場にご確認ください。
        </p>
        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
          <table className="min-w-full table-fixed text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/80">
              <tr>
                <th className="text-left px-3 py-2 font-medium w-[18%] min-w-[120px]">費用区分</th>
                <th className="text-left px-3 py-2 font-medium w-[42%] min-w-[260px]">対象経費</th>
                <th className="text-left px-3 py-2 font-medium w-[40%] min-w-[260px]">対象外経費</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
              <tr>
                <td className="px-3 py-3 text-gray-800 dark:text-gray-100 align-top font-medium">旅費</td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  <div>・研修等の宿泊料、交通費</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">※長沼町職員等の旅費に関する条例に準ずる</div>
                </td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  ・目的外の出張
                </td>
              </tr>
              <tr>
                <td className="px-3 py-3 text-gray-800 dark:text-gray-100 align-top font-medium">消耗品費</td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  ・事務用品費等
                </td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  ・転売目的の原材料等仕入れ
                </td>
              </tr>
              <tr>
                <td className="px-3 py-3 text-gray-800 dark:text-gray-100 align-top font-medium">印刷製本費</td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  ・印刷物の制作費
                </td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top"></td>
              </tr>
              <tr>
                <td className="px-3 py-3 text-gray-800 dark:text-gray-100 align-top font-medium">通信運搬費</td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  <div>・活動に要する郵便料、配送料</div>
                  <div>・活動に要する電話料</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">※事業に係る部分に限る</div>
                </td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top"></td>
              </tr>
              <tr>
                <td className="px-3 py-3 text-gray-800 dark:text-gray-100 align-top font-medium">広告料</td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  ・活動に関する広告掲載料
                </td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top"></td>
              </tr>
              <tr>
                <td className="px-3 py-3 text-gray-800 dark:text-gray-100 align-top font-medium">手数料</td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  ・活動に要する対応手数料
                </td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top"></td>
              </tr>
              <tr>
                <td className="px-3 py-3 text-gray-800 dark:text-gray-100 align-top font-medium">保険料</td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  ・イベント保険料
                </td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  <div>・住居の保険料</div>
                  <div>・個人の生命保険料等</div>
                </td>
              </tr>
              <tr>
                <td className="px-3 py-3 text-gray-800 dark:text-gray-100 align-top font-medium">使用料、借上料</td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  <div>・会場使用料</div>
                  <div>・活動に要する事務所の賃料</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">※明確に区分されている場合に限る</div>
                  <div>・活動に不可欠な特定業務ソフトウェア、一般事務用ソフトウェアの使用料、ライセンス費用、イベント資材のリース料</div>
                </td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  ・居住スペースに係る費用（家賃、光熱水費、共益費、敷金礼金等）
                </td>
              </tr>
              <tr>
                <td className="px-3 py-3 text-gray-800 dark:text-gray-100 align-top font-medium">備品購入費</td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  <div>・活動に必要な備品（機器、機材等）</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">※町長の承認なく処分してはならない</div>
                </td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  <div>・車の購入費用</div>
                  <div>・転売目的の購入</div>
                  <div>・汎用性があり、目的外の使用ができるもの（例：パソコン、スマートフォン、タブレット端末等）</div>
                </td>
              </tr>
              <tr>
                <td className="px-3 py-3 text-gray-800 dark:text-gray-100 align-top font-medium">負担金</td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  ・研修受講の経費
                </td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  ・飲食の費用
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>

      {isStaff && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">隊員</label>
          {membersLoading ? (
            <LoadingSpinner />
          ) : (
            <select
              value={selectedMemberId || ''}
              onChange={(e) => setSelectedMemberId(e.target.value || null)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
            >
              <option value="">選択してください</option>
              {sortedMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {!effectiveUserId && isStaff && (
        <p className="text-center text-gray-500 py-12">隊員を選ぶと表示されます。</p>
      )}

      {effectiveUserId && summaryLoading && (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      )}

      {effectiveUserId && summary && !summaryLoading && (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">設定上限（円）</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                {formatYen(summary.allocatedAmount)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">使用・予定累計</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                {formatYen(summary.totalSpent)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                予定・未承認・承認済みの合計（差し戻しは除外）
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">残り</p>
              <p
                className={`text-2xl font-bold tabular-nums ${summary.remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'
                  }`}
              >
                {formatYen(summary.remaining)}
              </p>
            </div>
          </section>

          {isStaff && (
            <section className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 space-y-3">
              <h2 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">予算・メモの設定（行政・サポート・マスター）</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">上限金額（円）</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={budgetAmount}
                    onChange={(e) => setBudgetAmount(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">メモ（年度や用途の目安など）</label>
                  <textarea
                    value={budgetMemo}
                    onChange={(e) => setBudgetMemo(e.target.value)}
                    rows={2}
                    className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  />
                </div>
              </div>
              <Button
                type="button"
                onClick={() => {
                  const n = parseInt(budgetAmount.replace(/[,]/g, ''), 10);
                  if (Number.isNaN(n) || n < 0) {
                    alert('上限金額は0以上の半角数字で入力してください');
                    return;
                  }
                  budgetMut.mutate();
                }}
                disabled={budgetMut.isPending}
              >
                保存
              </Button>
              {summary.budgetUpdatedAt && (
                <p className="text-xs text-gray-500">
                  最終更新: {format(parseISO(summary.budgetUpdatedAt), 'yyyy/M/d HH:mm', { locale: ja })}
                  {summary.budgetUpdatedBy && ` · ${summary.budgetUpdatedBy.name}`}
                </p>
              )}
            </section>
          )}

          {!isStaff && summary.memo && (
            <p className="text-sm text-gray-600 dark:text-gray-300 border-l-4 border-gray-300 dark:border-gray-600 pl-3">
              {summary.memo}
            </p>
          )}

          <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {editingId ? '支出・予定の修正' : '支出・予定を追加'}
            </h2>
            {scheduleIdForEntry && (
              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-800 dark:text-blue-200">
                カレンダーの予定から経費登録中です。この支出は予定と紐づきます。備品購入など予定と関係しない経費は、この表示がない通常入力のままプロジェクトに紐づけて登録できます。
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium mb-1">日付</label>
                <input
                  type="date"
                  value={spentAt}
                  onChange={(e) => setSpentAt(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">登録方法</label>
                <div className="grid grid-cols-2 rounded-md border border-gray-300 dark:border-gray-600 p-1 bg-gray-50 dark:bg-gray-900/40">
                  {[
                    ['PENDING', '申請する'],
                    ['PLANNED', '予定として控える'],
                  ].map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setEntryMode(mode as EntryMode)}
                      className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                        entryMode === mode
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {entryMode === 'PLANNED' && (
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    承認申請は送らず、残額計算にだけ反映します。
                  </p>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium mb-1">紐づくプロジェクト（必須）</label>
                <select
                  value={projectIdForEntry}
                  onChange={(e) => setProjectIdForEntry(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm"
                >
                  <option value="">選択してください</option>
                  {memberProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.projectName}
                    </option>
                  ))}
                </select>
                {memberProjects.length === 0 && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    ミッション管理でプロジェクトを作成すると、ここに表示されます。
                  </p>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium mb-1">内容</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm"
                  placeholder="例：会議資料コピー代"
                  maxLength={500}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">金額（円）</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm"
                  placeholder="1000"
                />
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {QUICK_AMOUNT_OPTIONS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAmount(String(value))}
                      className="shrink-0 rounded-full border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-xs text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800"
                    >
                      {value.toLocaleString()}円
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {editingId ? (
                <>
                  <Button
                    type="button"
                    className="w-full sm:w-auto"
                    onClick={() => {
                      if (!description.trim()) {
                        alert('内容を入力してください');
                        return;
                      }
                      if (!projectIdForEntry) {
                        alert('プロジェクトを選択してください');
                        return;
                      }
                      const n = parseInt(amount.replace(/[,]/g, ''), 10);
                      if (Number.isNaN(n) || n < 1) {
                        alert('金額は1円以上の半角数字で入力してください');
                        return;
                      }
                      updateMut.mutate();
                    }}
                    disabled={updateMut.isPending}
                  >
                    更新
                  </Button>
                  <Button type="button" variant="outline" onClick={cancelEdit} className="w-full sm:w-auto">
                    キャンセル
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    if (!description.trim()) {
                      alert('内容を入力してください');
                      return;
                    }
                    if (!projectIdForEntry) {
                      alert('活動に紐づくプロジェクトを選んでください');
                      return;
                    }
                    const n = parseInt(amount.replace(/[,]/g, ''), 10);
                    if (Number.isNaN(n) || n < 1) {
                      alert('金額は1円以上の半角数字で入力してください');
                      return;
                    }
                    createMut.mutate();
                  }}
                  disabled={createMut.isPending}
                >
                  追加
                </Button>
              )}
            </div>
          </section>

          <section>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">一覧（新しい順）</h2>
              <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 dark:border-gray-700 p-1 bg-gray-50 dark:bg-gray-900/40">
                {[
                  ['ALL', `すべて ${statusCounts.ALL}`],
                  ['PLANNED', `予定 ${statusCounts.PLANNED}`],
                  ['PENDING', `未承認 ${statusCounts.PENDING}`],
                  ['APPROVED', `承認済み ${statusCounts.APPROVED}`],
                  ['REJECTED', `差し戻し ${statusCounts.REJECTED}`],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setExpenseStatusFilter(key as typeof expenseStatusFilter)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      expenseStatusFilter === key
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {summary.entries.length === 0 ? (
              <p className="text-sm text-gray-500">まだ登録がありません。</p>
            ) : filteredEntries.length === 0 ? (
              <p className="text-sm text-gray-500">この状態の経費はありません。</p>
            ) : (
              <div className="space-y-2">
                {/* PC表示: テーブル */}
                <div className="hidden sm:block overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-700/80">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">日付</th>
                        <th className="text-left px-3 py-2 font-medium">プロジェクト</th>
                        <th className="text-left px-3 py-2 font-medium">内容</th>
                        <th className="text-center px-3 py-2 font-medium w-24">状態</th>
                        <th className="text-right px-3 py-2 font-medium">金額</th>
                        <th className="text-right px-3 py-2 font-medium w-40">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                      {filteredEntries.map((row) => (
                        <tr key={row.id}>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-700 dark:text-gray-200">
                            {format(parseISO(row.spentAt), 'yyyy年M月d日', { locale: ja })}
                          </td>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-200 text-sm">
                            {row.project?.projectName || (
                              <span className="text-amber-600 dark:text-amber-400">未設定</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-800 dark:text-gray-100">
                            {row.description}
                            {row.schedule && (
                              <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                                予定: {row.schedule.title || '予定'}{row.schedule.startDate ? `（${format(parseISO(row.schedule.startDate), 'M/d', { locale: ja })}）` : ''}
                              </p>
                            )}
                            {row.status === 'REJECTED' && row.rejectionReason && (
                              <p className="text-xs text-red-600 dark:text-red-400 mt-1">差し戻し理由: {row.rejectionReason}</p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {row.status === 'PLANNED' ? (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">予定</span>
                            ) : row.status === 'APPROVED' ? (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">承認済</span>
                            ) : row.status === 'REJECTED' ? (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200">差戻し</span>
                            ) : (
                              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">未検証</span>
                            )}
                            {row.status && row.status !== 'PENDING' && row.updatedBy && (
                              <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">対応: {row.updatedBy.name}</p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">{formatYen(row.amount)}</td>
                          <td className="px-3 py-2 text-right space-x-2">
                            {row.status && row.status !== 'PENDING' && row.updatedBy?.id === user?.id && (
                              <button
                                type="button"
                                className="text-amber-600 dark:text-amber-400 hover:underline text-xs"
                                onClick={() => {
                                  if (confirm('この対応を未承認に戻しますか？')) reopenMut.mutate(row.id);
                                }}
                              >
                                戻す
                              </button>
                            )}
                            <button
                              type="button"
                              className="text-blue-600 dark:text-blue-400 hover:underline text-xs"
                              onClick={() => startEdit(row)}
                            >
                              編集
                            </button>
                            <button
                              type="button"
                              className="text-red-600 dark:text-red-400 hover:underline text-xs"
                              onClick={() => {
                                if (confirm('この行を削除しますか？')) deleteMut.mutate(row.id);
                              }}
                            >
                              削除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* スマホ表示: カード */}
                <div className="sm:hidden space-y-2">
                  {filteredEntries.map((row) => (
                    <div key={row.id} className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800">
                      <div className="p-3">
                        <div className="mb-2 flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums mb-1">
                              {format(parseISO(row.spentAt), 'yyyy年M月d日', { locale: ja })}
                            </p>
                            <p className="text-sm font-semibold leading-5 text-gray-900 dark:text-gray-100">{row.description}</p>
                          </div>
                          <p className="whitespace-nowrap text-base font-bold tabular-nums text-gray-900 dark:text-gray-100">{formatYen(row.amount)}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="rounded bg-gray-100 px-2 py-0.5 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                            {row.project?.projectName || 'プロジェクト未設定'}
                          </span>
                          <span>
                            {row.status === 'PLANNED' ? (
                              <span className="font-medium px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">予定</span>
                            ) : row.status === 'APPROVED' ? (
                              <span className="font-medium px-2 py-0.5 rounded bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200">承認済</span>
                            ) : row.status === 'REJECTED' ? (
                              <span className="font-medium px-2 py-0.5 rounded bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200">差戻し</span>
                            ) : (
                              <span className="font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">未承認</span>
                            )}
                          </span>
                        </div>
                        {row.schedule && (
                          <p className="mt-2 text-xs text-blue-600 dark:text-blue-300">
                            予定: {row.schedule.title || '予定'}{row.schedule.startDate ? `（${format(parseISO(row.schedule.startDate), 'M月d日', { locale: ja })}）` : ''}
                          </p>
                        )}
                        {row.status === 'REJECTED' && row.rejectionReason && (
                          <p className="mt-2 text-xs text-red-600 dark:text-red-400">差し戻し: {row.rejectionReason}</p>
                        )}
                        {row.status && row.status !== 'PENDING' && row.updatedBy && (
                          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">対応: {row.updatedBy.name}</p>
                        )}
                      </div>
                      <div className="flex gap-2 border-t border-gray-100 p-2 dark:border-gray-700">
                        {row.status && row.status !== 'PENDING' && row.updatedBy?.id === user?.id && (
                          <button
                            type="button"
                            className="flex-1 text-center text-xs text-amber-600 dark:text-amber-400 py-1 rounded border border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                            onClick={() => {
                              if (confirm('この対応を未承認に戻しますか？')) reopenMut.mutate(row.id);
                            }}
                          >
                            戻す
                          </button>
                        )}
                        <button
                          type="button"
                          className="flex-1 text-center text-xs text-blue-600 dark:text-blue-400 py-1 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          onClick={() => startEdit(row)}
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          className="flex-1 text-center text-xs text-red-600 dark:text-red-400 py-1 rounded border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => {
                            if (confirm('この行を削除しますか？')) deleteMut.mutate(row.id);
                          }}
                        >
                          削除
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
