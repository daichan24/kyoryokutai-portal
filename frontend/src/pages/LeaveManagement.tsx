import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import { AlertTriangle, CheckCircle, Plus, Trash2, Check } from 'lucide-react';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import type { User } from '../types';

// ─── 型定義 ──────────────────────────────────────────────────────────────────
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
  compensatoryLeave: { id: string; grantedAt: string; expiresAt: string } | null;
  sourceSchedule: { id: string; title: string | null; activityDescription: string; startDate: string } | null;
  confirmedBy: { id: string; name: string } | null; confirmedAt: string | null;
  // 使用記録
  usedAt: string | null; usedStartTime: string | null; usedEndTime: string | null;
}
interface LeaveSummary {
  fiscalYear: number; paid: PaidLeaveData; unpaid: UnpaidLeaveData;
  compensatory: CompData;
  timeAdjustment: {
    totalGrantedHours: number;
    totalUsedHours: number;
    remainingHours: number;
    entries: TimeAdjItem[];
  };
}

// ─── カラーテーマ（モダン・落ち着いた色） ────────────────────────────────────
const THEME = {
  paid: {
    accent: 'bg-sky-500',
    light: 'bg-sky-50 dark:bg-sky-900/20',
    border: 'border-sky-200 dark:border-sky-800',
    text: 'text-sky-700 dark:text-sky-300',
    badge: 'bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300',
    header: 'bg-sky-50 dark:bg-sky-900/30 border-sky-200 dark:border-sky-800',
    dot: 'bg-sky-400',
  },
  unpaid: {
    accent: 'bg-slate-500',
    light: 'bg-slate-50 dark:bg-slate-800/40',
    border: 'border-slate-200 dark:border-slate-700',
    text: 'text-slate-600 dark:text-slate-400',
    badge: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400',
    header: 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700',
    dot: 'bg-slate-400',
  },
  comp: {
    accent: 'bg-violet-500',
    light: 'bg-violet-50 dark:bg-violet-900/20',
    border: 'border-violet-200 dark:border-violet-800',
    text: 'text-violet-700 dark:text-violet-300',
    badge: 'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300',
    header: 'bg-violet-50 dark:bg-violet-900/30 border-violet-200 dark:border-violet-800',
    dot: 'bg-violet-400',
  },
  ta: {
    accent: 'bg-teal-500',
    light: 'bg-teal-50 dark:bg-teal-900/20',
    border: 'border-teal-200 dark:border-teal-800',
    text: 'text-teal-700 dark:text-teal-300',
    badge: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
    header: 'bg-teal-50 dark:bg-teal-900/30 border-teal-200 dark:border-teal-800',
    dot: 'bg-teal-400',
  },
} as const;

// ─── ユーティリティ ───────────────────────────────────────────────────────────
const fmt = (d: string) => format(parseISO(d), 'M/d（E）', { locale: ja });
const fmtFull = (d: string) => format(parseISO(d), 'yyyy/M/d', { locale: ja });
const urgencyText = (days: number) =>
  days <= 7 ? 'text-rose-600 dark:text-rose-400'
  : days <= 21 ? 'text-amber-600 dark:text-amber-400'
  : 'text-emerald-600 dark:text-emerald-400';
const urgencyBorder = (days: number) =>
  days <= 7 ? 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20'
  : days <= 21 ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
  : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20';

export const LeaveManagement: React.FC = () => {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isStaff = user?.role === 'MASTER' || user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT';

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showAllComp, setShowAllComp] = useState(false);

  // 有給設定フォーム
  const [allocDays, setAllocDays] = useState('');
  const [allocMemo, setAllocMemo] = useState('');
  const [allocFiscalYear, setAllocFiscalYear] = useState(() => {
    const now = new Date(); const m = now.getMonth() + 1;
    return m >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  });
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
  const [usageLeaveId, setUsageLeaveId] = useState('');
  const [usageDate, setUsageDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [usageDays, setUsageDays] = useState('1');

  // 時間調整フォーム
  const [taDate, setTaDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [taHours, setTaHours] = useState('');
  const [taCompId, setTaCompId] = useState('');
  const [taNote, setTaNote] = useState('');
  // 時間調整使用記録フォーム
  const [taUseId, setTaUseId] = useState('');
  const [taUseDate, setTaUseDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [taUseStart, setTaUseStart] = useState('');
  const [taUseEnd, setTaUseEnd] = useState('');

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
  const paidDeleteMut = useMutation({ mutationFn: (id: string) => api.delete(`/api/leave/paid-leave/entries/${id}`), onSuccess: invalidate });
  const unpaidMut = useMutation({
    mutationFn: () => api.post('/api/leave/unpaid-leave/entries', { userId: isStaff ? effectiveUserId : undefined, usedAt: unpaidDate, days: parseFloat(unpaidDays), note: unpaidNote || null }),
    onSuccess: () => { invalidate(); setUnpaidNote(''); },
  });
  const unpaidDeleteMut = useMutation({ mutationFn: (id: string) => api.delete(`/api/leave/unpaid-leave/entries/${id}`), onSuccess: invalidate });
  const compMut = useMutation({
    mutationFn: () => api.post('/api/leave/compensatory', { userId: isStaff ? effectiveUserId : undefined, grantedAt: compGrantedAt, totalHours: compHours ? parseFloat(compHours) : null, leaveType: compLeaveType, note: compNote || null }),
    onSuccess: () => { invalidate(); setCompNote(''); setCompHours(''); },
  });
  const compDeleteMut = useMutation({ mutationFn: (id: string) => api.delete(`/api/leave/compensatory/${id}`), onSuccess: invalidate });
  const compConfirmMut = useMutation({ mutationFn: (id: string) => api.post(`/api/leave/compensatory/${id}/confirm`), onSuccess: invalidate });
  const usageMut = useMutation({
    mutationFn: () => api.post(`/api/leave/compensatory/${usageLeaveId}/usage`, { usedAt: usageDate, days: parseFloat(usageDays) }),
    onSuccess: () => { invalidate(); setUsageLeaveId(''); },
  });
  const taMut = useMutation({
    mutationFn: () => api.post('/api/leave/time-adjustments', { userId: isStaff ? effectiveUserId : undefined, compensatoryLeaveId: taCompId || null, adjustedAt: taDate, hours: parseFloat(taHours), note: taNote || null }),
    onSuccess: () => { invalidate(); setTaNote(''); setTaHours(''); setTaCompId(''); },
  });
  const taDeleteMut = useMutation({ mutationFn: (id: string) => api.delete(`/api/leave/time-adjustments/${id}`), onSuccess: invalidate });
  const taConfirmMut = useMutation({ mutationFn: (id: string) => api.post(`/api/leave/time-adjustments/${id}/confirm`), onSuccess: invalidate });
  const taUseMut = useMutation({
    mutationFn: ({ id, usedAt, usedStartTime, usedEndTime }: { id: string; usedAt: string; usedStartTime: string; usedEndTime: string }) =>
      api.put(`/api/leave/time-adjustments/${id}`, { usedAt, usedStartTime, usedEndTime }),
    onSuccess: () => { invalidate(); setTaUseId(''); setTaUseDate(format(new Date(), 'yyyy-MM-dd')); setTaUseStart(''); setTaUseEnd(''); },
  });

  if (!user) return null;

  const activeLeaves = summary?.compensatory.activeLeaves ?? [];
  const pendingSchedules = summary?.compensatory.allLeaves.filter(cl => cl.schedule?.id && cl.status === 'PENDING') ?? [];
  const nearestLeave = activeLeaves[0] ?? null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">有給・代休</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">有給・無休・代休・時間調整の状況を確認・記録できます。</p>
      </div>

      {/* 隊員選択（スタッフのみ） */}
      {isStaff && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">隊員</label>
          <select value={selectedMemberId || ''} onChange={e => setSelectedMemberId(e.target.value || null)}
            className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-sm">
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
          {/* ─── 代休未取得アラート ─── */}
          {pendingSchedules.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">代休未取得のタスクがあります</span>
              </div>
              <ul className="space-y-1 ml-6">
                {pendingSchedules.map(cl => (
                  <li key={cl.id} className="text-sm text-amber-700 dark:text-amber-300">
                    {fmtFull(cl.grantedAt)}：{cl.schedule?.title || cl.schedule?.activityDescription || 'タスク'}
                    <span className="ml-2 text-xs opacity-80">（期限 {fmtFull(cl.expiresAt)}・残{cl.daysLeft}日）</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ─── 全体サマリーボックス（1つのカードに4色） ─── */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">全体サマリー</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-gray-100 dark:divide-gray-700">
              {/* 有給 */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${THEME.paid.dot}`} />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">有給</span>
                </div>
                <p className={`text-2xl font-bold ${THEME.paid.text}`}>{summary.paid.remainingDays}<span className="text-sm font-normal ml-1">日</span></p>
                <p className="text-xs text-gray-400 mt-1">使用 {summary.paid.usedDays}日 / 付与 {summary.paid.totalDays}日</p>
                <p className={`text-xs mt-1 ${summary.paid.daysUntilExpiry <= 30 ? 'text-amber-500' : 'text-gray-400'}`}>
                  期限 {fmtFull(summary.paid.expiresAt)}（残{summary.paid.daysUntilExpiry}日）
                </p>
              </div>
              {/* 無休 */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${THEME.unpaid.dot}`} />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">無休</span>
                </div>
                <p className={`text-2xl font-bold ${THEME.unpaid.text}`}>{summary.unpaid.totalUsedDays}<span className="text-sm font-normal ml-1">日</span></p>
                <p className="text-xs text-gray-400 mt-1">使用累計</p>
              </div>
              {/* 代休 */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${THEME.comp.dot}`} />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">代休</span>
                </div>
                <p className={`text-2xl font-bold ${THEME.comp.text}`}>{summary.compensatory.totalAvailableDays}<span className="text-sm font-normal ml-1">日</span></p>
                {nearestLeave ? (
                  <p className={`text-xs mt-1 ${urgencyText(nearestLeave.daysLeft)}`}>
                    最短期限 残{nearestLeave.daysLeft}日（{fmtFull(nearestLeave.expiresAt)}）
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-1">使用可能な代休なし</p>
                )}
              </div>
              {/* 時間調整 */}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${THEME.ta.dot}`} />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">時間調整</span>
                </div>
                <p className={`text-2xl font-bold ${THEME.ta.text}`}>{summary.timeAdjustment.remainingHours}<span className="text-sm font-normal ml-1">時間残</span></p>
                <p className="text-xs text-gray-400 mt-1">付与 {summary.timeAdjustment.totalGrantedHours}h / 使用 {summary.timeAdjustment.totalUsedHours}h</p>
              </div>
            </div>
          </div>

          {/* ─── 有給 詳細 ─── */}
          <section className={`rounded-xl border ${THEME.paid.border} overflow-hidden`}>
            <div className={`flex items-center gap-3 px-4 py-3 ${THEME.paid.header} border-b ${THEME.paid.border}`}>
              <span className={`w-3 h-3 rounded-full ${THEME.paid.dot}`} />
              <h2 className={`font-semibold ${THEME.paid.text}`}>有給</h2>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: '付与日数', val: `${summary.paid.totalDays}日` },
                  { label: '使用日数', val: `${summary.paid.usedDays}日` },
                  { label: '残り', val: `${summary.paid.remainingDays}日`, sub: `期限 ${fmtFull(summary.paid.expiresAt)}（残${summary.paid.daysUntilExpiry}日）`, warn: summary.paid.daysUntilExpiry <= 30 },
                ].map(c => (
                  <div key={c.label} className={`rounded-lg p-3 ${c.warn ? 'bg-amber-50 dark:bg-amber-900/20' : THEME.paid.light}`}>
                    <p className="text-xs text-gray-500">{c.label}</p>
                    <p className={`text-xl font-bold mt-0.5 ${c.warn ? 'text-amber-600 dark:text-amber-400' : THEME.paid.text}`}>{c.val}</p>
                    {c.sub && <p className={`text-xs mt-0.5 ${c.warn ? 'text-amber-500' : 'text-gray-400'}`}>{c.sub}</p>}
                  </div>
                ))}
              </div>
              {summary.paid.memo && <p className={`text-sm border-l-4 pl-3 ${THEME.paid.text} border-sky-300`}>{summary.paid.memo}</p>}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">使用履歴</p>
                {summary.paid.entries.length === 0 ? (
                  <p className="text-sm text-gray-400">まだ使用記録がありません。</p>
                ) : (
                  <div className="space-y-1">
                    {[...summary.paid.entries].sort((a, b) => b.usedAt.localeCompare(a.usedAt)).map(e => (
                      <div key={e.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-medium w-32 ${THEME.paid.text}`}>{fmt(e.usedAt)}</span>
                          <span className="text-sm text-gray-600 dark:text-gray-400">{e.days}日</span>
                          {e.note && <span className="text-xs text-gray-400">{e.note}</span>}
                        </div>
                        {isStaff && <button type="button" onClick={() => { if (confirm('削除しますか？')) paidDeleteMut.mutate(e.id); }} className="text-rose-400 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {isStaff && (
                <div className={`${THEME.paid.light} border ${THEME.paid.border} rounded-lg p-3 space-y-3`}>
                  <p className={`text-xs font-semibold ${THEME.paid.text}`}>有給日数の設定（行政・サポート・マスター）</p>
                  <div className="flex flex-wrap gap-2 items-end">
                    <div><label className="block text-xs mb-1">年度</label><input type="number" value={allocFiscalYear} onChange={e => setAllocFiscalYear(Number(e.target.value))} className="w-24 px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                    <div><label className="block text-xs mb-1">付与日数</label><input type="number" step="0.5" value={allocDays} onChange={e => setAllocDays(e.target.value)} className="w-24 px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                    <div className="flex-1 min-w-[140px]"><label className="block text-xs mb-1">メモ</label><input type="text" value={allocMemo} onChange={e => setAllocMemo(e.target.value)} className="w-full px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                    <Button size="sm" type="button" onClick={() => { if (!allocDays) { alert('日数を入力してください'); return; } allocMut.mutate(); }} disabled={allocMut.isPending}>保存</Button>
                  </div>
                  <div className={`border-t ${THEME.paid.border} pt-3`}>
                    <p className={`text-xs font-semibold ${THEME.paid.text} mb-2`}>有給使用を記録</p>
                    <div className="flex flex-wrap gap-2 items-end">
                      <div><label className="block text-xs mb-1">日付</label><input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} className="px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                      <div><label className="block text-xs mb-1">日数</label><input type="number" step="0.5" min="0.5" value={paidDays} onChange={e => setPaidDays(e.target.value)} className="w-20 px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                      <div className="flex-1 min-w-[120px]"><label className="block text-xs mb-1">メモ</label><input type="text" value={paidNote} onChange={e => setPaidNote(e.target.value)} className="w-full px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                      <Button size="sm" type="button" onClick={() => paidEntryMut.mutate()} disabled={paidEntryMut.isPending}>追加</Button>
                    </div>
                  </div>
                  {summary.paid.updatedAt && <p className="text-xs text-gray-400">最終更新: {format(parseISO(summary.paid.updatedAt), 'yyyy/M/d HH:mm', { locale: ja })}{summary.paid.updatedBy && ` · ${summary.paid.updatedBy.name}`}</p>}
                </div>
              )}
            </div>
          </section>

          {/* ─── 無休 詳細 ─── */}
          <section className={`rounded-xl border ${THEME.unpaid.border} overflow-hidden`}>
            <div className={`flex items-center gap-3 px-4 py-3 ${THEME.unpaid.header} border-b ${THEME.unpaid.border}`}>
              <span className={`w-3 h-3 rounded-full ${THEME.unpaid.dot}`} />
              <h2 className={`font-semibold ${THEME.unpaid.text}`}>無休</h2>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 space-y-4">
              <div className={`rounded-lg p-3 inline-block ${THEME.unpaid.light}`}>
                <p className="text-xs text-gray-500">使用累計</p>
                <p className={`text-xl font-bold mt-0.5 ${THEME.unpaid.text}`}>{summary.unpaid.totalUsedDays}日</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">使用履歴</p>
                {summary.unpaid.entries.length === 0 ? (
                  <p className="text-sm text-gray-400">まだ使用記録がありません。</p>
                ) : (
                  <div className="space-y-1">
                    {[...summary.unpaid.entries].sort((a, b) => b.usedAt.localeCompare(a.usedAt)).map(e => (
                      <div key={e.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-medium w-32 ${THEME.unpaid.text}`}>{fmt(e.usedAt)}</span>
                          <span className="text-sm text-gray-600 dark:text-gray-400">{e.days}日</span>
                          {e.note && <span className="text-xs text-gray-400">{e.note}</span>}
                        </div>
                        <button type="button" onClick={() => { if (confirm('削除しますか？')) unpaidDeleteMut.mutate(e.id); }} className="text-rose-400 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className={`border-t ${THEME.unpaid.border} pt-3 space-y-2`}>
                <p className={`text-xs font-semibold ${THEME.unpaid.text}`}>無休を記録</p>
                <div className="flex flex-wrap gap-2 items-end">
                  <div><label className="block text-xs mb-1">日付</label><input type="date" value={unpaidDate} onChange={e => setUnpaidDate(e.target.value)} className="px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                  <div><label className="block text-xs mb-1">日数</label><input type="number" step="0.5" min="0.5" value={unpaidDays} onChange={e => setUnpaidDays(e.target.value)} className="w-20 px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                  <div className="flex-1 min-w-[120px]"><label className="block text-xs mb-1">メモ</label><input type="text" value={unpaidNote} onChange={e => setUnpaidNote(e.target.value)} className="w-full px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                  <Button size="sm" type="button" onClick={() => unpaidMut.mutate()} disabled={unpaidMut.isPending}>追加</Button>
                </div>
              </div>
            </div>
          </section>

          {/* ─── 代休 詳細 ─── */}
          <section className={`rounded-xl border ${THEME.comp.border} overflow-hidden`}>
            <div className={`flex items-center gap-3 px-4 py-3 ${THEME.comp.header} border-b ${THEME.comp.border}`}>
              <span className={`w-3 h-3 rounded-full ${THEME.comp.dot}`} />
              <h2 className={`font-semibold ${THEME.comp.text}`}>代休</h2>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className={`rounded-lg p-3 ${THEME.comp.light}`}>
                  <p className="text-xs text-gray-500">使用可能（合計）</p>
                  <p className={`text-xl font-bold mt-0.5 ${THEME.comp.text}`}>{summary.compensatory.totalAvailableDays}日</p>
                </div>
                {nearestLeave && (
                  <div className={`rounded-lg p-3 border ${urgencyBorder(nearestLeave.daysLeft)}`}>
                    <p className="text-xs text-gray-500">最短期限の代休</p>
                    <p className={`text-xl font-bold mt-0.5 ${urgencyText(nearestLeave.daysLeft)}`}>残{nearestLeave.daysLeft}日以内</p>
                    <p className="text-xs text-gray-400 mt-0.5">期限：{fmtFull(nearestLeave.expiresAt)}</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">使用可能な代休（{activeLeaves.length}件）</p>
                {activeLeaves.length === 0 ? (
                  <p className="text-sm text-gray-400">現在使える代休はありません。</p>
                ) : (
                  <div className="space-y-2">
                    {activeLeaves.map(cl => (
                      <div key={cl.id} className={`rounded-lg p-3 border ${urgencyBorder(cl.daysLeft)}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-sm font-bold ${urgencyText(cl.daysLeft)}`}>残{cl.daysLeft}日以内に使用</span>
                              <span className="text-xs text-gray-500">期限：{fmtFull(cl.expiresAt)}</span>
                              {cl.confirmedBy && (
                                <span className="flex items-center gap-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle className="h-3 w-3" />{cl.confirmedBy.name}確認済み
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">付与日：{fmtFull(cl.grantedAt)}{cl.totalHours != null && `　${cl.totalHours}時間`}{cl.note && `　${cl.note}`}</p>
                            {cl.schedule && <p className={`text-xs mt-0.5 ${THEME.comp.text}`}>紐づくタスク：{cl.schedule.title || cl.schedule.activityDescription}（{fmtFull(cl.schedule.startDate)}　{cl.schedule.startTime}〜{cl.schedule.endTime}）</p>}
                            {cl.usages.length > 0 && <p className="text-xs text-gray-400 mt-0.5">使用済み：{cl.usages.map(u => `${fmt(u.usedAt)} ${u.days}日`).join('、')}</p>}
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            {isStaff && !cl.confirmedBy && (
                              <button type="button" onClick={() => compConfirmMut.mutate(cl.id)}
                                className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200">
                                <Check className="h-3 w-3" />確認
                              </button>
                            )}
                            <button type="button" onClick={() => { if (confirm('削除しますか？')) compDeleteMut.mutate(cl.id); }} className="text-rose-400 hover:text-rose-600 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <button type="button" onClick={() => setShowAllComp(!showAllComp)}
                  className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 underline">
                  {showAllComp ? '過去の代休を閉じる' : '過去の代休（使用済み・期限切れ）を見る'}
                </button>
                {showAllComp && (
                  <div className="mt-2 space-y-1">
                    {summary.compensatory.allLeaves.filter(cl => cl.status !== 'PENDING').map(cl => (
                      <div key={cl.id} className="flex items-center gap-3 py-1.5 border-b border-gray-100 dark:border-gray-700 text-sm">
                        <span className="text-gray-500 w-24 text-xs">{fmtFull(cl.grantedAt)}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${cl.status === 'USED' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                          {cl.status === 'USED' ? '使用済み' : '期限切れ'}
                        </span>
                        {cl.schedule && <span className="text-xs text-gray-400 truncate">{cl.schedule.title || cl.schedule.activityDescription}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {activeLeaves.length > 0 && (
                <div className={`border-t ${THEME.comp.border} pt-3 space-y-2`}>
                  <p className={`text-xs font-semibold ${THEME.comp.text}`}>代休を使用する</p>
                  <div className="flex flex-wrap gap-2 items-end">
                    <div><label className="block text-xs mb-1">代休を選択</label>
                      <select value={usageLeaveId} onChange={e => setUsageLeaveId(e.target.value)} className="px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm">
                        <option value="">選択</option>
                        {activeLeaves.map(cl => <option key={cl.id} value={cl.id}>{fmtFull(cl.grantedAt)}付与（残{cl.daysLeft}日）</option>)}
                      </select>
                    </div>
                    <div><label className="block text-xs mb-1">使用日</label><input type="date" value={usageDate} onChange={e => setUsageDate(e.target.value)} className="px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                    <div><label className="block text-xs mb-1">日数</label><input type="number" step="0.5" min="0.5" max="1" value={usageDays} onChange={e => setUsageDays(e.target.value)} className="w-20 px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                    <Button size="sm" type="button" onClick={() => { if (!usageLeaveId) { alert('代休を選択してください'); return; } usageMut.mutate(); }} disabled={usageMut.isPending}>記録</Button>
                  </div>
                </div>
              )}
              <div className={`border-t ${THEME.comp.border} pt-3 space-y-2`}>
                <p className={`text-xs font-semibold ${THEME.comp.text}`}>代休を追加</p>
                <div className="flex flex-wrap gap-2 items-end">
                  <div><label className="block text-xs mb-1">付与された日</label><input type="date" value={compGrantedAt} onChange={e => setCompGrantedAt(e.target.value)} className="px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                  <div><label className="block text-xs mb-1">種別</label>
                    <select value={compLeaveType} onChange={e => setCompLeaveType(e.target.value as 'FULL_DAY' | 'TIME_ADJUST')} className="px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm">
                      <option value="FULL_DAY">代休（1日）</option>
                      <option value="TIME_ADJUST">時間調整</option>
                    </select>
                  </div>
                  <div><label className="block text-xs mb-1">時間数（任意）</label><input type="number" step="0.5" min="0" value={compHours} onChange={e => setCompHours(e.target.value)} className="w-20 px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" placeholder="例: 4" /></div>
                  <div className="flex-1 min-w-[120px]"><label className="block text-xs mb-1">メモ</label><input type="text" value={compNote} onChange={e => setCompNote(e.target.value)} className="w-full px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                  <Button size="sm" type="button" onClick={() => compMut.mutate()} disabled={compMut.isPending}><Plus className="h-3.5 w-3.5 mr-1" />追加</Button>
                </div>
              </div>
            </div>
          </section>

          {/* ─── 時間調整 詳細 ─── */}
          <section className={`rounded-xl border ${THEME.ta.border} overflow-hidden`}>
            <div className={`flex items-center gap-3 px-4 py-3 ${THEME.ta.header} border-b ${THEME.ta.border}`}>
              <span className={`w-3 h-3 rounded-full ${THEME.ta.dot}`} />
              <h2 className={`font-semibold ${THEME.ta.text}`}>時間調整</h2>
            </div>
            <div className="bg-white dark:bg-gray-800 p-4 space-y-4">
              {/* 貸借対照表サマリー */}
              <div className="grid grid-cols-3 gap-3">
                <div className={`rounded-lg p-3 ${THEME.ta.light}`}>
                  <p className="text-xs text-gray-500">付与（累計）</p>
                  <p className={`text-xl font-bold mt-0.5 ${THEME.ta.text}`}>{summary.timeAdjustment.totalGrantedHours}<span className="text-sm font-normal ml-1">時間</span></p>
                </div>
                <div className="rounded-lg p-3 bg-gray-50 dark:bg-gray-700/30">
                  <p className="text-xs text-gray-500">使用（累計）</p>
                  <p className="text-xl font-bold mt-0.5 text-gray-700 dark:text-gray-300">{summary.timeAdjustment.totalUsedHours}<span className="text-sm font-normal ml-1">時間</span></p>
                </div>
                <div className={`rounded-lg p-3 ${summary.timeAdjustment.remainingHours > 0 ? THEME.ta.light : 'bg-gray-50 dark:bg-gray-700/30'}`}>
                  <p className="text-xs text-gray-500">残り</p>
                  <p className={`text-xl font-bold mt-0.5 ${summary.timeAdjustment.remainingHours > 0 ? THEME.ta.text : 'text-gray-400'}`}>{summary.timeAdjustment.remainingHours}<span className="text-sm font-normal ml-1">時間</span></p>
                </div>
              </div>

              {/* 付与履歴（貸方） */}
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">付与履歴（休日出勤タスクから発生）</p>
                {summary.timeAdjustment.entries.length === 0 ? (
                  <p className="text-sm text-gray-400">まだ記録がありません。</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 dark:border-gray-700">
                          <th className="text-left py-1.5 text-xs font-medium text-gray-400 w-28">付与日</th>
                          <th className="text-right py-1.5 text-xs font-medium text-gray-400 w-16">付与時間</th>
                          <th className="text-left py-1.5 text-xs font-medium text-gray-400 pl-3">使用記録</th>
                          <th className="text-left py-1.5 text-xs font-medium text-gray-400">紐づくタスク</th>
                          <th className="text-left py-1.5 text-xs font-medium text-gray-400">期限</th>
                          <th className="w-16"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.timeAdjustment.entries.map(ta => (
                          <tr key={ta.id} className="border-b border-gray-50 dark:border-gray-700/50">
                            <td className={`py-2 text-sm font-medium ${THEME.ta.text}`}>{fmt(ta.adjustedAt)}</td>
                            <td className="py-2 text-right font-bold text-gray-800 dark:text-gray-200">+{ta.hours}h</td>
                            <td className="py-2 pl-3">
                              {ta.usedAt ? (
                                <span className="text-xs text-gray-600 dark:text-gray-400">
                                  {fmt(ta.usedAt)}{ta.usedStartTime && ta.usedEndTime && ` ${ta.usedStartTime}〜${ta.usedEndTime}`}
                                  {ta.usedStartTime && ta.usedEndTime && (
                                    <span className="ml-1 text-rose-500 font-medium">
                                      -{(() => {
                                        const [eh, em] = ta.usedEndTime!.split(':').map(Number);
                                        const [sh, sm] = ta.usedStartTime!.split(':').map(Number);
                                        return Math.round((eh * 60 + em - sh * 60 - sm) / 60 * 10) / 10;
                                      })()}h
                                    </span>
                                  )}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">未使用</span>
                              )}
                            </td>
                            <td className="py-2 text-xs text-gray-500 max-w-[140px] truncate">
                              {ta.sourceSchedule ? `${ta.sourceSchedule.title || ta.sourceSchedule.activityDescription}（${fmtFull(ta.sourceSchedule.startDate)}）` : '-'}
                            </td>
                            <td className="py-2 text-xs">
                              {ta.compensatoryLeave?.expiresAt ? (
                                <span className={urgencyText(Math.ceil((new Date(ta.compensatoryLeave.expiresAt).getTime() - Date.now()) / 86400000))}>
                                  {fmtFull(ta.compensatoryLeave.expiresAt)}まで
                                </span>
                              ) : <span className="text-gray-400">-</span>}
                            </td>
                            <td className="py-2">
                              <div className="flex gap-1 justify-end">
                                {isStaff && !ta.confirmedBy && (
                                  <button type="button" onClick={() => taConfirmMut.mutate(ta.id)}
                                    className="text-xs px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200">
                                    <Check className="h-3 w-3" />
                                  </button>
                                )}
                                <button type="button" onClick={() => { if (confirm('削除しますか？')) taDeleteMut.mutate(ta.id); }} className="text-rose-400 hover:text-rose-600 p-0.5"><Trash2 className="h-3.5 w-3.5" /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* 時間調整を使用する */}
              {summary.timeAdjustment.entries.filter(t => !t.usedAt).length > 0 && (
                <div className={`border-t ${THEME.ta.border} pt-3 space-y-2`}>
                  <p className={`text-xs font-semibold ${THEME.ta.text}`}>時間調整を使用する（早上がり記録）</p>
                  <div className="flex flex-wrap gap-2 items-end">
                    <div>
                      <label className="block text-xs mb-1">対象の時間調整</label>
                      <select value={taUseId} onChange={e => setTaUseId(e.target.value)} className="px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm">
                        <option value="">選択</option>
                        {summary.timeAdjustment.entries.filter(t => !t.usedAt).map(ta => (
                          <option key={ta.id} value={ta.id}>{fmt(ta.adjustedAt)}付与 {ta.hours}h</option>
                        ))}
                      </select>
                    </div>
                    <div><label className="block text-xs mb-1">使用日</label><input type="date" value={taUseDate} onChange={e => setTaUseDate(e.target.value)} className="px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                    <div><label className="block text-xs mb-1">開始時刻</label><input type="time" value={taUseStart} onChange={e => setTaUseStart(e.target.value)} className="px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                    <div><label className="block text-xs mb-1">終了時刻</label><input type="time" value={taUseEnd} onChange={e => setTaUseEnd(e.target.value)} className="px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                    <Button size="sm" type="button" onClick={() => {
                      if (!taUseId) { alert('対象を選択してください'); return; }
                      if (!taUseDate || !taUseStart || !taUseEnd) { alert('日付・開始・終了時刻を入力してください'); return; }
                      taUseMut.mutate({ id: taUseId, usedAt: taUseDate, usedStartTime: taUseStart, usedEndTime: taUseEnd });
                    }} disabled={taUseMut.isPending}>記録</Button>
                  </div>
                </div>
              )}

              {/* 手動追加 */}
              <div className={`border-t ${THEME.ta.border} pt-3 space-y-2`}>
                <p className={`text-xs font-semibold ${THEME.ta.text}`}>時間調整を手動追加</p>
                <div className="flex flex-wrap gap-2 items-end">
                  <div><label className="block text-xs mb-1">付与日（休日出勤日）</label><input type="date" value={taDate} onChange={e => setTaDate(e.target.value)} className="px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                  <div><label className="block text-xs mb-1">時間数</label><input type="number" step="0.5" min="0.5" value={taHours} onChange={e => setTaHours(e.target.value)} className="w-20 px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" placeholder="例: 2" /></div>
                  {activeLeaves.length > 0 && (
                    <div><label className="block text-xs mb-1">紐づく代休（任意）</label>
                      <select value={taCompId} onChange={e => setTaCompId(e.target.value)} className="px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm">
                        <option value="">なし</option>
                        {activeLeaves.map(cl => <option key={cl.id} value={cl.id}>{fmtFull(cl.grantedAt)}付与</option>)}
                      </select>
                    </div>
                  )}
                  <div className="flex-1 min-w-[120px]"><label className="block text-xs mb-1">メモ</label><input type="text" value={taNote} onChange={e => setTaNote(e.target.value)} className="w-full px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                  <Button size="sm" type="button" onClick={() => { if (!taHours) { alert('時間数を入力してください'); return; } taMut.mutate(); }} disabled={taMut.isPending}><Plus className="h-3.5 w-3.5 mr-1" />追加</Button>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
