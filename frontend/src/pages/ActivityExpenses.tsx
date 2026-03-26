import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import type { User } from '../types';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';

function formatYen(n: number) {
  return `¥${n.toLocaleString('ja-JP')}`;
}

interface ExpenseEntry {
  id: string;
  spentAt: string;
  description: string;
  amount: number;
  createdAt: string;
  createdBy?: { id: string; name: string } | null;
  updatedBy?: { id: string; name: string } | null;
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
  const isStaff = user?.role === 'MASTER' || user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT';

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetMemo, setBudgetMemo] = useState('');
  const [spentAt, setSpentAt] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const effectiveUserId = isStaff ? selectedMemberId : user?.id ?? null;

  React.useEffect(() => {
    setEditingId(null);
    setDescription('');
    setAmount('');
  }, [effectiveUserId]);

  const { data: members = [], isLoading: membersLoading } = useQuery<User[]>({
    queryKey: ['activity-expenses', 'members'],
    queryFn: async () => {
      const r = await api.get<User[]>('/api/users?role=MEMBER');
      return r.data || [];
    },
    enabled: isStaff,
  });

  const sortedMembers = useMemo(
    () => [...members].sort((a, b) => a.name.localeCompare(b.name, 'ja')),
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
        spentAt,
        description: description.trim(),
        amount: n,
      });
    },
    onSuccess: () => {
      invalidate();
      setDescription('');
      setAmount('');
      setSpentAt(format(new Date(), 'yyyy-MM-dd'));
    },
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      const n = parseInt(amount.replace(/[,]/g, ''), 10);
      if (!editingId || Number.isNaN(n) || n < 1) throw new Error('INVALID');
      await api.put(`/api/activity-expenses/entries/${editingId}`, {
        spentAt,
        description: description.trim(),
        amount: n,
      });
    },
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      setDescription('');
      setAmount('');
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/activity-expenses/entries/${id}`);
    },
    onSuccess: invalidate,
  });

  const startEdit = (e: ExpenseEntry) => {
    setEditingId(e.id);
    setSpentAt(e.spentAt.slice(0, 10));
    setDescription(e.description);
    setAmount(String(e.amount));
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDescription('');
    setAmount('');
    setSpentAt(format(new Date(), 'yyyy-MM-dd'));
  };

  if (!user) return null;

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">活動経費</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          使った日・内容・金額を記録し、設定された上限から差し引いた残りが分かります。メンバーは自分の分だけ表示されます。行政・サポート・マスターは隊員を選んで閲覧・予算設定・登録の修正ができます。
        </p>
      </div>

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
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">使用累計</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                {formatYen(summary.totalSpent)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">残り</p>
              <p
                className={`text-2xl font-bold tabular-nums ${
                  summary.remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'
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
              {editingId ? '支出の修正' : '支出を追加'}
            </h2>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="block text-xs font-medium mb-1">日付</label>
                <input
                  type="date"
                  value={spentAt}
                  onChange={(e) => setSpentAt(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-medium mb-1">内容</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
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
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                  placeholder="1000"
                />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {editingId ? (
                <>
                  <Button
                    type="button"
                    onClick={() => {
                      if (!description.trim()) {
                        alert('内容を入力してください');
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
                  <Button type="button" variant="outline" onClick={cancelEdit}>
                    キャンセル
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  onClick={() => {
                    if (!description.trim()) {
                      alert('内容を入力してください');
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">一覧（新しい順）</h2>
            {summary.entries.length === 0 ? (
              <p className="text-sm text-gray-500">まだ登録がありません。</p>
            ) : (
              <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/80">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">日付</th>
                      <th className="text-left px-3 py-2 font-medium">内容</th>
                      <th className="text-right px-3 py-2 font-medium">金額</th>
                      <th className="text-right px-3 py-2 font-medium w-40">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                    {summary.entries.map((row) => (
                      <tr key={row.id}>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-700 dark:text-gray-200">
                          {format(parseISO(row.spentAt), 'yyyy年M月d日', { locale: ja })}
                        </td>
                        <td className="px-3 py-2 text-gray-800 dark:text-gray-100">{row.description}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">{formatYen(row.amount)}</td>
                        <td className="px-3 py-2 text-right space-x-2">
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
            )}
          </section>
        </>
      )}
    </div>
  );
};
