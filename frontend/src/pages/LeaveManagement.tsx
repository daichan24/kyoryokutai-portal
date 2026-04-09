import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Plus, Trash2, Check } from 'lucide-react';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import type { User } from '../types';

interface PaidLeaveData {
  totalDays: number; usedDays: number; remainingDays: number;
  expiresAt: string; daysUntilExpiry: number; memo: string | null;
  updatedBy: { id: string; name: string } | null; updatedAt: string | null;
  entries: Array<{ id: string; usedAt: string; days: number; note: string | null }>;
}
interface UnpaidLeaveData {
  totalUsedDays: number;
  entries: Array<{ id: string; usedAt: string; days: number; note: string | null }>;
}
interface CompLeaveItem {
  id: string; grantedAt: string; expiresAt: string; daysLeft: number; remainingDays: number;
  totalHours: number | null; leaveType: 'FULL_DAY' | 'TIME_ADJUST'; status: string; note: string | null;
  confirmedBy: { id: string; name: string } | null; confirmedAt: string | null;
  schedule: { id: string; title: string | null; activityDescription: string; startDate: string; startTime: string; endTime: string } | null;
  usages: Array<{ id: string; usedAt: string; days: number; note: string | null }>;
}
interface CompData { totalAvailableDays: number; activeLeaves: CompLeaveItem[]; allLeaves: CompLeaveItem[] }
interface TimeAdjItem {
  id: string; adjustedAt: string; hours: number; note: string | null;
  compensatoryLeave: { id: string; grantedAt: string } | null;
  sourceSchedule: { id: string; title: string | null; activityDescription: string; startDate: string } | null;
  confirmedBy: { id: string; name: string } | null; confirmedAt: string | null;
}
interface LeaveSummary {
  fiscalYear: number; paid: PaidLeaveData; unpaid: UnpaidLeaveData;
  compensatory: CompData; timeAdjustment: { totalHours: number; entries: TimeAdjItem[] };
}

const fmt = (d: string) => format(parseISO(d), 'yyyy/M/d', { locale: ja });
const urgencyColor = (days: number) =>
  days <= 7 ? 'text-red-600 dark:text-red-400' : days <= 21 ? 'text-orange-500 dark:text-orange-400' : 'text-gray-600 dark:text-gray-400';
const urgencyBg = (days: number) =>
  days <= 7 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
  : days <= 21 ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
  : 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-700';

const StatCard: React.FC<{ label: string; value: string; sub?: string; highlight?: boolean }> = ({ label, value, sub, highlight }) => (
  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    <p className={`text-xl font-bold mt-0.5 ${highlight ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-gray-100'}`}>{value}</p>
    {sub && <p className={`text-xs mt-0.5 ${highlight ? 'text-orange-500' : 'text-gray-500 dark:text-gray-400'}`}>{sub}</p>}
  </div>
);

export const LeaveManagement: React.FC = () => {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isStaff = user?.role === 'MASTER' || user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT';

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showCompDetail, setShowCompDetail] = useState(false);
  const [showAllComp, setShowAllComp] = useState(false);

  // 有給設定フォーム
  const [allocDays, setAllocDays] = useState('');
  const [allocMemo, setAllocMemo] = useState('');
  const [allocFiscalYear, setAllocFiscalYear] = useState(() => {
    const now = new Date(); const m = now.getMonth() + 1;
    return m >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  });

  // 有給使用フォーム
  const [paidDate, setPaidDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [paidDays, setPaidDays] = useState('1');
  const [paidNote, setPaidNote] = useState('');

  // 無休フォーム
  const [unpaidDate, setUnpaidDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [unpaidDays, setUnpaidDays] = useState('1');
  const [unpaidNote, setUnpaidNote] = useState('');

  // 代休フォーム
  const [compGrantedAt, setCompGrantedAt] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [compHours, setCompHours] = useState('');
  const [compLeaveType, setCompLeaveType] = useState<'FULL_DAY' | 'TIME_ADJUST'>('FULL_DAY');
  const [compNote, setCompNote] = useState('');

  // 代休使用フォーム
  const [usageLeaveId, setUsageLeaveId] = useState('');
  const [usageDate, setUsageDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [usageDays, setUsageDays] = useState('1');

  // 時間調整フォーム
  const [taDate, setTaDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [taHours, setTaHours] = useState('');
  const [taCompId, setTaCompId] = useState('');
  const [taNote, setTaNote] = useState('');

  const effectiveUserId = isStaff ? selectedMemberId : user?.id ?? null;
  const invalidate = () => qc.invalidateQueries({ queryKey: ['leave'] });

  const { data: members = [] } = useQuery<User[]>({
    queryKey: ['leave', 'members'],
    queryFn: async () => (await api.get<User[]>('/api/users?role=MEMBER')).data || [],
    enabled: isStaff,
  });

  const { data: summary, isLoading } = useQuery<LeaveSummary>({
    queryKey: ['leave', 'summary', effectiveUserId],
    queryFn: async () => {
      const params = isStaff ? { userId: effectiveUserId } : {};
      return (await api.get<LeaveSummary>('/api/leave/summary', { params })).data;
    },
    enabled: Boolean(effectiveUserId),
  });

  React.useEffect(() => {
    if (summary && isStaff) {
      setAllocDays(String(summary.paid.totalDays));
      setAllocMemo(summary.paid.memo || '');
    }
  }, [summary?.paid.totalDays, summary?.paid.memo, isStaff, effectiveUserId]);

  const allocMut = useMutation({
    mutationFn: () => api.put('/api/leave/paid-leave/allocation', { userId: effectiveUserId, fiscalYear: allocFiscalYear, totalDays: parseFloat(allocDays), memo: allocMemo || null }),
    onSuccess: invalidate,
  });
  const paidEntryMut = useMutation({
    mutationFn: () => api.post('/api/leave/paid-leave/entries', { userId: effectiveUserId, usedAt: paidDate, days: parseFloat(paidDays), note: paidNote || null }),
    onSuccess: () => { invalidate(); setPaidNote(''); },
  });
  const paidDeleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/leave/paid-leave/entries/${id}`),
    onSuccess: invalidate,
  });
  const unpaidMut = useMutation({
    mutationFn: () => api.post('/api/leave/unpaid-leave/entries', { userId: isStaff ? effectiveUserId : undefined, usedAt: unpaidDate, days: parseFloat(unpaidDays), note: unpaidNote || null }),
    onSuccess: () => { invalidate(); setUnpaidNote(''); },
  });
  const unpaidDeleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/leave/unpaid-leave/entries/${id}`),
    onSuccess: invalidate,
  });
  const compMut = useMutation({
    mutationFn: () => api.post('/api/leave/compensatory', { userId: isStaff ? effectiveUserId : undefined, grantedAt: compGrantedAt, totalHours: compHours ? parseFloat(compHours) : null, leaveType: compLeaveType, note: compNote || null }),
    onSuccess: () => { invalidate(); setCompNote(''); setCompHours(''); },
  });
  const compDeleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/leave/compensatory/${id}`),
    onSuccess: invalidate,
  });
  const compConfirmMut = useMutation({
    mutationFn: (id: string) => api.post(`/api/leave/compensatory/${id}/confirm`),
    onSuccess: invalidate,
  });
  const usageMut = useMutation({
    mutationFn: () => api.post(`/api/leave/compensatory/${usageLeaveId}/usage`, { usedAt: usageDate, days: parseFloat(usageDays) }),
    onSuccess: () => { invalidate(); setUsageLeaveId(''); },
  });
  const taMut = useMutation({
    mutationFn: () => api.post('/api/leave/time-adjustments', { userId: isStaff ? effectiveUserId : undefined, compensatoryLeaveId: taCompId || null, adjustedAt: taDate, hours: parseFloat(taHours), note: taNote || null }),
    onSuccess: () => { invalidate(); setTaNote(''); setTaHours(''); setTaCompId(''); },
  });
  const taDeleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/api/leave/time-adjustments/${id}`),
    onSuccess: invalidate,
  });
  const taConfirmMut = useMutation({
    mutationFn: (id: string) => api.post(`/api/leave/time-adjustments/${id}/confirm`),
    onSuccess: invalidate,
  });

  if (!user) return null;

  const activeLeaves = summary?.compensatory.activeLeaves ?? [];
  const pendingSchedules = summary?.compensatory.allLeaves.filter(cl => cl.schedule?.id && cl.status === 'PENDING') ?? [];

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">有給・代休</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">有給・無休・代休・時間調整の残日数と履歴を確認できます。</p>
      </div>

      {isStaff && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">隊員</label>
          <select value={selectedMemberId || ''} onChange={e => setSelectedMemberId(e.target.value || null)}
            className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm">
            <option value="">選択してください</option>
            {[...members].sort((a, b) => a.name.localeCompare(b.name, 'ja')).map(m => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      )}

      {!effectiveUserId && isStaff && <p className="text-center text-gray-500 py-12">隊員を選ぶと表示されます。</p>}
      {effectiveUserId && isLoading && <div className="flex justify-center py-16"><LoadingSpinner /></div>}

      {effectiveUserId && summary && !isLoading && (
        <>
          {pendingSchedules.length > 0 && (
            <section className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                <h2 className="text-sm font-semibold text-orange-800 dark:text-orange-200">代休未取得のタスク</h2>
              </div>
              <ul className="space-y-1">
                {pendingSchedules.map(cl => (
                  <li key={cl.id} className="text-sm text-orange-700 dark:text-orange-300">
                    {fmt(cl.grantedAt)}：{cl.schedule?.title || cl.schedule?.activityDescription || 'タスク'}（期限：{fmt(cl.expiresAt)}、残{cl.daysLeft}日）
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 有給 */}
          <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">有給</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="付与日数" value={`${summary.paid.totalDays}日`} />
              <StatCard label="使用日数" value={`${summary.paid.usedDays}日`} />
              <StatCard label="残り" value={`${summary.paid.remainingDays}日`}
                sub={`有効期限まで残り${summary.paid.daysUntilExpiry}日（${fmt(summary.paid.expiresAt)}）`}
                highlight={summary.paid.daysUntilExpiry <= 30} />
            </div>
            {summary.paid.memo && <p className="text-sm text-gray-600 dark:text-gray-300 border-l-4 border-blue-300 pl-3">{summary.paid.memo}</p>}
            {isStaff && (
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-blue-800 dark:text-blue-200">有給日数の設定（行政・サポート・マスター）</p>
                <div className="flex flex-wrap gap-2 items-end">
                  <div><label className="block text-xs mb-1">年度</label><input type="number" value={allocFiscalYear} onChange={e => setAllocFiscalYear(Number(e.target.value))} className="w-24 px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                  <div><label className="block text-xs mb-1">付与日数</label><input type="number" step="0.5" value={allocDays} onChange={e => setAllocDays(e.target.value)} className="w-24 px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" placeholder="例: 10" /></div>
                  <div className="flex-1 min-w-[160px]"><label className="block text-xs mb-1">メモ（任意）</label><input type="text" value={allocMemo} onChange={e => setAllocMemo(e.target.value)} className="w-full px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                  <Button size="sm" type="button" onClick={() => { if (!allocDays) { alert('日数を入力してください'); return; } allocMut.mutate(); }} disabled={allocMut.isPending}>保存</Button>
                </div>
                {summary.paid.updatedAt && <p className="text-xs text-gray-500">最終更新: {format(parseISO(summary.paid.updatedAt), 'yyyy/M/d HH:mm', { locale: ja })}{summary.paid.updatedBy && ` · ${summary.paid.updatedBy.name}`}</p>}
              </div>
            )}
            {isStaff && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">有給使用を記録</p>
                <div className="flex flex-wrap gap-2 items-end">
                  <div><label className="block text-xs mb-1">日付</label><input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} className="px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                  <div><label className="block text-xs mb-1">日数</label><input type="number" step="0.5" min="0.5" value={paidDays} onChange={e => setPaidDays(e.target.value)} className="w-20 px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                  <div className="flex-1 min-w-[140px]"><label className="block text-xs mb-1">メモ</label><input type="text" value={paidNote} onChange={e => setPaidNote(e.target.value)} className="w-full px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                  <Button size="sm" type="button" onClick={() => paidEntryMut.mutate()} disabled={paidEntryMut.isPending}>追加</Button>
                </div>
              </div>
            )}
            {summary.paid.entries.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">使用履歴</p>
                <div className="space-y-1">
                  {summary.paid.entries.map(e => (
                    <div key={e.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-100 dark:border-gray-700">
                      <span className="text-gray-700 dark:text-gray-300">{fmt(e.usedAt)}　{e.days}日{e.note && `　${e.note}`}</span>
                      {isStaff && <button type="button" onClick={() => { if (confirm('削除しますか？')) paidDeleteMut.mutate(e.id); }} className="text-red-500 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></button>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* 無休 */}
          <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">無休</h2>
            <StatCard label="使用日数（累計）" value={`${summary.unpaid.totalUsedDays}日`} />
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">無休を記録</p>
              <div className="flex flex-wrap gap-2 items-end">
                <div><label className="block text-xs mb-1">日付</label><input type="date" value={unpaidDate} onChange={e => setUnpaidDate(e.target.value)} className="px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                <div><label className="block text-xs mb-1">日数</label><input type="number" step="0.5" min="0.5" value={unpaidDays} onChange={e => setUnpaidDays(e.target.value)} className="w-20 px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                <div className="flex-1 min-w-[140px]"><label className="block text-xs mb-1">メモ</label><input type="text" value={unpaidNote} onChange={e => setUnpaidNote(e.target.value)} className="w-full px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                <Button size="sm" type="button" onClick={() => unpaidMut.mutate()} disabled={unpaidMut.isPending}>追加</Button>
              </div>
            </div>
            {summary.unpaid.entries.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">使用履歴</p>
                <div className="space-y-1">
                  {summary.unpaid.entries.map(e => (
                    <div key={e.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-100 dark:border-gray-700">
                      <span className="text-gray-700 dark:text-gray-300">{fmt(e.usedAt)}　{e.days}日{e.note && `　${e.note}`}</span>
                      <button type="button" onClick={() => { if (confirm('削除しますか？')) unpaidDeleteMut.mutate(e.id); }} className="text-red-500 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* 代休 */}
          <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">代休</h2>
              <button type="button" onClick={() => setShowCompDetail(!showCompDetail)}
                className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline">
                {showCompDetail ? <><ChevronUp className="h-4 w-4" />内訳を閉じる</> : <><ChevronDown className="h-4 w-4" />内訳を見る</>}
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <StatCard label="使える代休（合計）" value={`${summary.compensatory.totalAvailableDays}日`} />
              {activeLeaves.length > 0 && (
                <div className={`rounded-lg p-3 border ${urgencyBg(activeLeaves[0].daysLeft)}`}>
                  <p className="text-xs text-gray-500 dark:text-gray-400">最も期限が近い代休</p>
                  <p className={`text-xl font-bold mt-0.5 ${urgencyColor(activeLeaves[0].daysLeft)}`}>残{activeLeaves[0].daysLeft}日以内</p>
                  <p className="text-xs text-gray-500 mt-0.5">期限：{fmt(activeLeaves[0].expiresAt)}</p>
                </div>
              )}
            </div>
            {showCompDetail && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500">代休の内訳（使用可能なもの）</p>
                {activeLeaves.length === 0 ? (
                  <p className="text-sm text-gray-500">現在使える代休はありません。</p>
                ) : (
                  activeLeaves.map(cl => (
                    <div key={cl.id} className={`rounded-lg p-3 border ${urgencyBg(cl.daysLeft)}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-semibold ${urgencyColor(cl.daysLeft)}`}>残{cl.daysLeft}日以内に使用</span>
                            <span className="text-xs text-gray-500">（期限：{fmt(cl.expiresAt)}）</span>
                            {cl.confirmedBy && (
                              <span className="flex items-center gap-0.5 text-xs text-green-600 dark:text-green-400">
                                <CheckCircle className="h-3 w-3" />{cl.confirmedBy.name}が確認済み
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            付与日：{fmt(cl.grantedAt)}{cl.totalHours && `　${cl.totalHours}時間`}{cl.note && `　${cl.note}`}
                          </p>
                          {cl.schedule && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                              紐づくタスク：{cl.schedule.title || cl.schedule.activityDescription}（{fmt(cl.schedule.startDate)}　{cl.schedule.startTime}〜{cl.schedule.endTime}）
                            </p>
                          )}
                          {cl.usages.length > 0 && (
                            <p className="text-xs text-gray-500 mt-0.5">使用済み：{cl.usages.map(u => `${fmt(u.usedAt)} ${u.days}日`).join('、')}</p>
                          )}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          {isStaff && !cl.confirmedBy && (
                            <button type="button" onClick={() => compConfirmMut.mutate(cl.id)}
                              className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200">
                              <Check className="h-3 w-3" />確認
                            </button>
                          )}
                          <button type="button" onClick={() => { if (confirm('削除しますか？')) compDeleteMut.mutate(cl.id); }}
                            className="text-red-500 hover:text-red-700 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <button type="button" onClick={() => setShowAllComp(!showAllComp)}
                  className="text-xs text-gray-500 hover:text-gray-700 underline">
                  {showAllComp ? '過去の代休を閉じる' : '過去の代休（使用済み・期限切れ）を見る'}
                </button>
                {showAllComp && (
                  <div className="space-y-1">
                    {summary.compensatory.allLeaves.filter(cl => cl.status !== 'PENDING').map(cl => (
                      <div key={cl.id} className="text-sm text-gray-500 dark:text-gray-400 py-1 border-b border-gray-100 dark:border-gray-700">
                        {fmt(cl.grantedAt)}　{cl.status === 'USED' ? '使用済み' : '期限切れ'}
                        {cl.schedule && `　${cl.schedule.title || cl.schedule.activityDescription}`}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {activeLeaves.length > 0 && (
              <div className="space-y-2 border-t dark:border-gray-700 pt-3">
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">代休を使用する</p>
                <div className="flex flex-wrap gap-2 items-end">
                  <div>
                    <label className="block text-xs mb-1">代休を選択</label>
                    <select value={usageLeaveId} onChange={e => setUsageLeaveId(e.target.value)}
                      className="px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm">
                      <option value="">選択</option>
                      {activeLeaves.map(cl => (
                        <option key={cl.id} value={cl.id}>{fmt(cl.grantedAt)}付与（残{cl.daysLeft}日）</option>
                      ))}
                    </select>
                  </div>
                  <div><label className="block text-xs mb-1">使用日</label><input type="date" value={usageDate} onChange={e => setUsageDate(e.target.value)} className="px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                  <div><label className="block text-xs mb-1">日数</label><input type="number" step="0.5" min="0.5" max="1" value={usageDays} onChange={e => setUsageDays(e.target.value)} className="w-20 px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                  <Button size="sm" type="button" onClick={() => { if (!usageLeaveId) { alert('代休を選択してください'); return; } usageMut.mutate(); }} disabled={usageMut.isPending}>記録</Button>
                </div>
              </div>
            )}
            <div className="space-y-2 border-t dark:border-gray-700 pt-3">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">代休を追加</p>
              <div className="flex flex-wrap gap-2 items-end">
                <div><label className="block text-xs mb-1">付与された日</label><input type="date" value={compGrantedAt} onChange={e => setCompGrantedAt(e.target.value)} className="px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                <div>
                  <label className="block text-xs mb-1">種別</label>
                  <select value={compLeaveType} onChange={e => setCompLeaveType(e.target.value as 'FULL_DAY' | 'TIME_ADJUST')}
                    className="px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm">
                    <option value="FULL_DAY">代休（1日）</option>
                    <option value="TIME_ADJUST">時間調整</option>
                  </select>
                </div>
                <div><label className="block text-xs mb-1">時間数（任意）</label><input type="number" step="0.5" min="0" value={compHours} onChange={e => setCompHours(e.target.value)} className="w-20 px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" placeholder="例: 4" /></div>
                <div className="flex-1 min-w-[140px]"><label className="block text-xs mb-1">メモ</label><input type="text" value={compNote} onChange={e => setCompNote(e.target.value)} className="w-full px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                <Button size="sm" type="button" onClick={() => compMut.mutate()} disabled={compMut.isPending}><Plus className="h-3.5 w-3.5 mr-1" />追加</Button>
              </div>
            </div>
          </section>

          {/* 時間調整 */}
          <section className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">時間調整</h2>
            <StatCard label="調整済み時間（累計）" value={`${summary.timeAdjustment.totalHours}時間`} />
            {summary.timeAdjustment.entries.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 mb-1">時間調整の履歴</p>
                <div className="space-y-2">
                  {summary.timeAdjustment.entries.map(ta => (
                    <div key={ta.id} className="flex items-start justify-between gap-2 py-2 border-b border-gray-100 dark:border-gray-700">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-gray-800 dark:text-gray-200">{fmt(ta.adjustedAt)}　{ta.hours}時間早上がり</span>
                          {ta.confirmedBy && (
                            <span className="flex items-center gap-0.5 text-xs text-green-600 dark:text-green-400">
                              <CheckCircle className="h-3 w-3" />{ta.confirmedBy.name}が確認済み
                            </span>
                          )}
                        </div>
                        {ta.compensatoryLeave && <p className="text-xs text-gray-500 mt-0.5">代休：{fmt(ta.compensatoryLeave.grantedAt)}付与分</p>}
                        {ta.sourceSchedule && <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">元タスク：{ta.sourceSchedule.title || ta.sourceSchedule.activityDescription}（{fmt(ta.sourceSchedule.startDate)}）</p>}
                        {ta.note && <p className="text-xs text-gray-500 mt-0.5">{ta.note}</p>}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        {isStaff && !ta.confirmedBy && (
                          <button type="button" onClick={() => taConfirmMut.mutate(ta.id)}
                            className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200">
                            <Check className="h-3 w-3" />確認
                          </button>
                        )}
                        <button type="button" onClick={() => { if (confirm('削除しますか？')) taDeleteMut.mutate(ta.id); }}
                          className="text-red-500 hover:text-red-700 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2 border-t dark:border-gray-700 pt-3">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">時間調整を記録</p>
              <div className="flex flex-wrap gap-2 items-end">
                <div><label className="block text-xs mb-1">早上がりした日</label><input type="date" value={taDate} onChange={e => setTaDate(e.target.value)} className="px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                <div><label className="block text-xs mb-1">時間数</label><input type="number" step="0.5" min="0.5" value={taHours} onChange={e => setTaHours(e.target.value)} className="w-20 px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" placeholder="例: 2" /></div>
                {activeLeaves.length > 0 && (
                  <div>
                    <label className="block text-xs mb-1">紐づく代休（任意）</label>
                    <select value={taCompId} onChange={e => setTaCompId(e.target.value)}
                      className="px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm">
                      <option value="">なし</option>
                      {activeLeaves.map(cl => <option key={cl.id} value={cl.id}>{fmt(cl.grantedAt)}付与</option>)}
                    </select>
                  </div>
                )}
                <div className="flex-1 min-w-[140px]"><label className="block text-xs mb-1">メモ</label><input type="text" value={taNote} onChange={e => setTaNote(e.target.value)} className="w-full px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                <Button size="sm" type="button" onClick={() => { if (!taHours) { alert('時間数を入力してください'); return; } taMut.mutate(); }} disabled={taMut.isPending}><Plus className="h-3.5 w-3.5 mr-1" />追加</Button>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
