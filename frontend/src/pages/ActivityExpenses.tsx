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
  projectId?: string | null;
  project?: { id: string; projectName: string; missionId?: string | null } | null;
  createdAt: string;
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
  const isStaff = user?.role === 'MASTER' || user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT';

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [budgetMemo, setBudgetMemo] = useState('');
  const [spentAt, setSpentAt] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [projectIdForEntry, setProjectIdForEntry] = useState('');

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
        projectId: projectIdForEntry,
        spentAt,
        description: description.trim(),
        amount: n,
      });
    },
    onSuccess: () => {
      invalidate();
      setDescription('');
      setAmount('');
      setProjectIdForEntry('');
      setSpentAt(format(new Date(), 'yyyy-MM-dd'));
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
      };
      if (projectIdForEntry) body.projectId = projectIdForEntry;
      await api.put(`/api/activity-expenses/entries/${editingId}`, body);
    },
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      setDescription('');
      setAmount('');
      setProjectIdForEntry('');
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
    setProjectIdForEntry(e.projectId || '');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDescription('');
    setAmount('');
    setProjectIdForEntry('');
    setSpentAt(format(new Date(), 'yyyy-MM-dd'));
  };

  if (!user) return null;

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">活動経費</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          使った日・内容・金額を記録し、設定された上限から差し引いた残りが分かります。支出は必ず自分のプロジェクト（ミッション配下の活動）に紐づけてください。メンバーは自分の分だけ表示されます。行政・サポート・マスターは隊員を選んで閲覧・予算設定・チェックリスト編集ができます。
        </p>
      </div>

      <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">対象経費一覧</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          長沼町地域おこし協力隊活動費補助金交付要綱に基づく対象経費です。詳細は役場にご確認ください。
        </p>
        <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700/80">
              <tr>
                <th className="text-left px-3 py-2 font-medium w-32">費用区分</th>
                <th className="text-left px-3 py-2 font-medium">対象経費</th>
                <th className="text-left px-3 py-2 font-medium w-48">対象外経費</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
              <tr>
                <td className="px-3 py-3 text-gray-800 dark:text-gray-100 align-top font-medium">旅費</td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  <div>・研修等の宿泊代、交通費等</div>
                  <div>・長期間に帰省する際に要する交通費等</div>
                  <div>・本町に帰省する</div>
                </td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  ・目的外の出張
                </td>
              </tr>
              <tr>
                <td className="px-3 py-3 text-gray-800 dark:text-gray-100 align-top font-medium">消耗品費</td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  ・事務用品及備品等
                </td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  ・転売目的の製作物等を仕入れ
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
                  <div>・試験に要する電話料</div>
                  <div>・事業に係る必要な通信料</div>
                </td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top"></td>
              </tr>
              <tr>
                <td className="px-3 py-3 text-gray-800 dark:text-gray-100 align-top font-medium">広告料</td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  ・活動に要する広告宣伝費
                </td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top"></td>
              </tr>
              <tr>
                <td className="px-3 py-3 text-gray-800 dark:text-gray-100 align-top font-medium">手数料</td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  ・活動に要する手続手数料
                </td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top"></td>
              </tr>
              <tr>
                <td className="px-3 py-3 text-gray-800 dark:text-gray-100 align-top font-medium">保険料</td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  ・イベント保険料
                </td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  <div>・任意の保険料</div>
                  <div>・個人の生命保険料等</div>
                </td>
              </tr>
              <tr>
                <td className="px-3 py-3 text-gray-800 dark:text-gray-100 align-top font-medium">使用料、賃借料</td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  <div>・会場使用料</div>
                  <div>・試験に要する車両等の賃料</div>
                  <div>・時間貸に区分されている場合に限る</div>
                  <div>・活動に不可欠な資材等の賃料</div>
                  <div>・ソフトウェア、一般賃貸ソフトウェア、ライセンス費用等、イベント資材のリース料</div>
                </td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  <div>・駐車スペースに係る費用（駐車、洗車代、共益費等）</div>
                </td>
              </tr>
              <tr>
                <td className="px-3 py-3 text-gray-800 dark:text-gray-100 align-top font-medium">備品購入費</td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  <div>・活動に必要な備品（机等、機材等）</div>
                  <div>・町民の来客なく製品として扱うことはならない</div>
                </td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  <div>・車の購入費用</div>
                  <div>・転売目的の購入</div>
                  <div>・貸与作りあり、目的外の使用ができるもの（調べパソコン、スマートフォン、タブレット端末等）</div>
                </td>
              </tr>
              <tr>
                <td className="px-3 py-3 text-gray-800 dark:text-gray-100 align-top font-medium">謝礼費</td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  ・研修受講の謝礼
                </td>
                <td className="px-3 py-3 text-gray-700 dark:text-gray-200 align-top">
                  ・飲食の費用
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">一覧（新しい順）</h2>
            {summary.entries.length === 0 ? (
              <p className="text-sm text-gray-500">まだ登録がありません。</p>
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
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-200 text-sm">
                            {row.project?.projectName || (
                              <span className="text-amber-600 dark:text-amber-400">未設定</span>
                            )}
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
                {/* スマホ表示: カード */}
                <div className="sm:hidden space-y-2">
                  {summary.entries.map((row) => (
                    <div key={row.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                            {format(parseISO(row.spentAt), 'M/d', { locale: ja })}
                          </p>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{row.description}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {row.project?.projectName || <span className="text-amber-600 dark:text-amber-400">プロジェクト未設定</span>}
                          </p>
                        </div>
                        <p className="text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100 whitespace-nowrap">{formatYen(row.amount)}</p>
                      </div>
                      <div className="flex gap-2 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
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
