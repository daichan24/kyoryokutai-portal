import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import {
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle,
  Plus, Trash2, Check, Calendar, Clock,
} from 'lucide-react';
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
  compensatoryLeave: { id: string; grantedAt: string } | null;
  sourceSchedule: { id: string; title: string | null; activityDescription: string; startDate: string } | null;
  confirmedBy: { id: string; name: string } | null; confirmedAt: string | null;
}
interface LeaveSummary {
  fiscalYear: number; paid: PaidLeaveData; unpaid: UnpaidLeaveData;
  compensatory: CompData; timeAdjustment: { totalHours: number; entries: TimeAdjItem[] };
}

// ─── ユーティリティ ───────────────────────────────────────────────────────────
const fmt = (d: string) => format(parseISO(d), 'M/d（E）', { locale: ja });
const fmtFull = (d: string) => format(parseISO(d), 'yyyy/M/d', { locale: ja });
const urgencyColor = (days: number) =>
  days <= 7 ? 'text-red-600 dark:text-red-400'
  : days <= 21 ? 'text-orange-500 dark:text-orange-400'
  : 'text-emerald-600 dark:text-emerald-400';
const urgencyBg = (days: number) =>
  days <= 7 ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
  : days <= 21 ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
  : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800';

// ─── サマリーカード ───────────────────────────────────────────────────────────
const SummaryCard: React.FC<{
  icon: React.ReactNode; label: string; main: string; sub?: string;
  badge?: string; badgeColor?: string; onClick?: () => void;
}> = ({ icon, label, main, sub, badge, badgeColor = 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300', onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 text-left w-full transition-shadow ${onClick ? 'hover:shadow-md cursor-pointer' : 'cursor-default'}`}
  >
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-2">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      {badge && <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColor}`}>{badge}</span>}
    </div>
    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{main}</p>
    {sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sub}</p>}
  </button>
);

export const LeaveManagement: React.FC = () => {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const isStaff = user?.role === 'MASTER' || user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT';

  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  // 展開状態
  const [openSection, setOpenSection] = useState<'paid' | 'unpaid' | 'comp' | 'ta' | null>(null);
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

  const effectiveUserId = isStaff ? selectedMemberId : user?.id ?? null;
  const invalidate = () => qc.invalidateQueries({ queryKey: ['leave'] });
  const toggle = (s: typeof openSection) => setOpenSection(prev => prev === s ? null : s);

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

  // ─── Mutations ───────────────────────────────────────────────────────────────
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
          {/* ─── 代休未取得アラート ─── */}
          {pendingSchedules.length > 0 && (
            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-orange-500 flex-shrink-0" />
                <span className="text-sm font-semibold text-orange-800 dark:text-orange-200">代休未取得のタスクがあります</span>
              </div>
              <ul className="space-y-1 ml-7">
                {pendingSchedules.map(cl => (
                  <li key={cl.id} className="text-sm text-orange-700 dark:text-orange-300">
                    {fmtFull(cl.grantedAt)}：{cl.schedule?.title || cl.schedule?.activityDescription || 'タスク'}
                    <span className="ml-2 text-xs">（期限 {fmtFull(cl.expiresAt)}・残{cl.daysLeft}日）</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* ─── 全体サマリーグリッド ─── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* 有給 */}
            <SummaryCard
              icon={<Calendar className="h-4 w-4" />}
              label="有給"
              main={`残 ${summary.paid.remainingDays}日`}
              sub={`使用 ${summary.paid.usedDays}日 / 付与 ${summary.paid.totalDays}日`}
              badge={summary.paid.daysUntilExpiry <= 30 ? `期限${summary.paid.daysUntilExpiry}日前` : `${fmtFull(summary.paid.expiresAt)}まで`}
              badgeColor={summary.paid.daysUntilExpiry <= 30 ? 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300' : 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'}
              onClick={() => toggle('paid')}
            />
            {/* 無休 */}
            <SummaryCard
              icon={<Calendar className="h-4 w-4" />}
              label="無休"
              main={`${summary.unpaid.totalUsedDays}日`}
              sub="使用累計"
              onClick={() => toggle('unpaid')}
            />
            {/* 代休 */}
            <SummaryCard
              icon={<Calendar className="h-4 w-4" />}
              label="代休"
              main={`残 ${summary.compensatory.totalAvailableDays}日`}
              sub={nearestLeave ? `最短期限 残${nearestLeave.daysLeft}日（${fmtFull(nearestLeave.expiresAt)}）` : '使用可能な代休なし'}
              badge={nearestLeave ? (nearestLeave.daysLeft <= 7 ? '要注意' : nearestLeave.daysLeft <= 21 ? '期限近い' : undefined) : undefined}
              badgeColor={nearestLeave && nearestLeave.daysLeft <= 7 ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' : 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300'}
              onClick={() => toggle('comp')}
            />
            {/* 時間調整 */}
            <SummaryCard
              icon={<Clock className="h-4 w-4" />}
              label="時間調整"
              main={`${summary.timeAdjustment.totalHours}時間`}
              sub="調整済み累計"
              onClick={() => toggle('ta')}
            />
          </div>

          {/* ─── 有給 詳細 ─── */}
          {openSection === 'paid' && (
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">有給の詳細</h2>
                <button type="button" onClick={() => setOpenSection(null)} className="text-gray-400 hover:text-gray-600"><ChevronUp className="h-4 w-4" /></button>
              </div>
              <div className="p-4 space-y-4">
                {/* 有給残・期限 */}
                <div className="grid gap-3 sm:grid-cols-3 text-sm">
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
                    <p className="text-xs text-gray-500">付与日数</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{summary.paid.totalDays}日</p>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3">
                    <p className="text-xs text-gray-500">使用日数</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{summary.paid.usedDays}日</p>
                  </div>
                  <div className={`rounded-lg p-3 ${summary.paid.daysUntilExpiry <= 30 ? 'bg-orange-50 dark:bg-orange-900/20' : 'bg-gray-50 dark:bg-gray-700/30'}`}>
                    <p className="text-xs text-gray-500">残り</p>
                    <p className={`text-xl font-bold ${summary.paid.daysUntilExpiry <= 30 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-900 dark:text-gray-100'}`}>{summary.paid.remainingDays}日</p>
                    <p className="text-xs text-gray-500 mt-0.5">期限 {fmtFull(summary.paid.expiresAt)}（残{summary.paid.daysUntilExpiry}日）</p>
                  </div>
                </div>
                {summary.paid.memo && <p className="text-sm text-gray-600 dark:text-gray-300 border-l-4 border-blue-300 pl-3">{summary.paid.memo}</p>}

                {/* 使用履歴 */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">使用履歴</p>
                  {summary.paid.entries.length === 0 ? (
                    <p className="text-sm text-gray-400">まだ使用記録がありません。</p>
                  ) : (
                    <div className="space-y-1">
                      {[...summary.paid.entries].sort((a, b) => b.usedAt.localeCompare(a.usedAt)).map(e => (
                        <div key={e.id} className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-700">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 w-28">{fmt(e.usedAt)}</span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">{e.days}日</span>
                            {e.note && <span className="text-xs text-gray-400">{e.note}</span>}
                          </div>
                          {isStaff && <button type="button" onClick={() => { if (confirm('削除しますか？')) paidDeleteMut.mutate(e.id); }} className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 有給設定（スタッフのみ） */}
                {isStaff && (
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-3">
                    <p className="text-xs font-semibold text-blue-800 dark:text-blue-200">有給日数の設定（行政・サポート・マスター）</p>
                    <div className="flex flex-wrap gap-2 items-end">
                      <div><label className="block text-xs mb-1">年度</label><input type="number" value={allocFiscalYear} onChange={e => setAllocFiscalYear(Number(e.target.value))} className="w-24 px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                      <div><label className="block text-xs mb-1">付与日数</label><input type="number" step="0.5" value={allocDays} onChange={e => setAllocDays(e.target.value)} className="w-24 px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                      <div className="flex-1 min-w-[140px]"><label className="block text-xs mb-1">メモ</label><input type="text" value={allocMemo} onChange={e => setAllocMemo(e.target.value)} className="w-full px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                      <Button size="sm" type="button" onClick={() => { if (!allocDays) { alert('日数を入力してください'); return; } allocMut.mutate(); }} disabled={allocMut.isPending}>保存</Button>
                    </div>
                    <div className="border-t border-blue-200 dark:border-blue-800 pt-3">
                      <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">有給使用を記録</p>
                      <div className="flex flex-wrap gap-2 items-end">
                        <div><label className="block text-xs mb-1">日付</label><input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} className="px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                        <div><label className="block text-xs mb-1">日数</label><input type="number" step="0.5" min="0.5" value={paidDays} onChange={e => setPaidDays(e.target.value)} className="w-20 px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                        <div className="flex-1 min-w-[120px]"><label className="block text-xs mb-1">メモ</label><input type="text" value={paidNote} onChange={e => setPaidNote(e.target.value)} className="w-full px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                        <Button size="sm" type="button" onClick={() => paidEntryMut.mutate()} disabled={paidEntryMut.isPending}>追加</Button>
                      </div>
                    </div>
                    {summary.paid.updatedAt && <p className="text-xs text-gray-500">最終更新: {format(parseISO(summary.paid.updatedAt), 'yyyy/M/d HH:mm', { locale: ja })}{summary.paid.updatedBy && ` · ${summary.paid.updatedBy.name}`}</p>}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ─── 無休 詳細 ─── */}
          {openSection === 'unpaid' && (
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">無休の詳細</h2>
                <button type="button" onClick={() => setOpenSection(null)} className="text-gray-400 hover:text-gray-600"><ChevronUp className="h-4 w-4" /></button>
              </div>
              <div className="p-4 space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 inline-block">
                  <p className="text-xs text-gray-500">使用累計</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{summary.unpaid.totalUsedDays}日</p>
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
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 w-28">{fmt(e.usedAt)}</span>
                            <span className="text-sm text-gray-600 dark:text-gray-400">{e.days}日</span>
                            {e.note && <span className="text-xs text-gray-400">{e.note}</span>}
                          </div>
                          <button type="button" onClick={() => { if (confirm('削除しますか？')) unpaidDeleteMut.mutate(e.id); }} className="text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="border-t dark:border-gray-700 pt-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">無休を記録</p>
                  <div className="flex flex-wrap gap-2 items-end">
                    <div><label className="block text-xs mb-1">日付</label><input type="date" value={unpaidDate} onChange={e => setUnpaidDate(e.target.value)} className="px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                    <div><label className="block text-xs mb-1">日数</label><input type="number" step="0.5" min="0.5" value={unpaidDays} onChange={e => setUnpaidDays(e.target.value)} className="w-20 px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                    <div className="flex-1 min-w-[120px]"><label className="block text-xs mb-1">メモ</label><input type="text" value={unpaidNote} onChange={e => setUnpaidNote(e.target.value)} className="w-full px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                    <Button size="sm" type="button" onClick={() => unpaidMut.mutate()} disabled={unpaidMut.isPending}>追加</Button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ─── 代休 詳細 ─── */}
          {openSection === 'comp' && (
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">代休の詳細</h2>
                <button type="button" onClick={() => setOpenSection(null)} className="text-gray-400 hover:text-gray-600"><ChevronUp className="h-4 w-4" /></button>
              </div>
              <div className="p-4 space-y-4">
                {/* 使用可能な代休一覧 */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">使用可能な代休（{activeLeaves.length}件）</p>
                  {activeLeaves.length === 0 ? (
                    <p className="text-sm text-gray-400">現在使える代休はありません。</p>
                  ) : (
                    <div className="space-y-2">
                      {activeLeaves.map(cl => (
                        <div key={cl.id} className={`rounded-lg p-3 border ${urgencyBg(cl.daysLeft)}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-sm font-bold ${urgencyColor(cl.daysLeft)}`}>残{cl.daysLeft}日以内に使用</span>
                                <span className="text-xs text-gray-500">期限：{fmtFull(cl.expiresAt)}</span>
                                {cl.confirmedBy && (
                                  <span className="flex items-center gap-0.5 text-xs text-green-600 dark:text-green-400">
                                    <CheckCircle className="h-3 w-3" />{cl.confirmedBy.name}確認済み
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                付与日：{fmtFull(cl.grantedAt)}{cl.totalHours != null && `　${cl.totalHours}時間`}{cl.note && `　${cl.note}`}
                              </p>
                              {cl.schedule && (
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                                  紐づくタスク：{cl.schedule.title || cl.schedule.activityDescription}（{fmtFull(cl.schedule.startDate)}　{cl.schedule.startTime}〜{cl.schedule.endTime}）
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
                                className="text-red-400 hover:text-red-600 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 過去の代休 */}
                <div>
                  <button type="button" onClick={() => setShowAllComp(!showAllComp)}
                    className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                    {showAllComp ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    過去の代休（使用済み・期限切れ）
                  </button>
                  {showAllComp && (
                    <div className="mt-2 space-y-1">
                      {summary.compensatory.allLeaves.filter(cl => cl.status !== 'PENDING').map(cl => (
                        <div key={cl.id} className="text-sm text-gray-500 dark:text-gray-400 py-1.5 border-b border-gray-100 dark:border-gray-700 flex items-center gap-3">
                          <span className="w-24 text-xs">{fmtFull(cl.grantedAt)}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${cl.status === 'USED' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'}`}>
                            {cl.status === 'USED' ? '使用済み' : '期限切れ'}
                          </span>
                          {cl.schedule && <span className="text-xs truncate">{cl.schedule.title || cl.schedule.activityDescription}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 代休を使用する */}
                {activeLeaves.length > 0 && (
                  <div className="border-t dark:border-gray-700 pt-3 space-y-2">
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">代休を使用する</p>
                    <div className="flex flex-wrap gap-2 items-end">
                      <div>
                        <label className="block text-xs mb-1">代休を選択</label>
                        <select value={usageLeaveId} onChange={e => setUsageLeaveId(e.target.value)}
                          className="px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm">
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

                {/* 代休を追加 */}
                <div className="border-t dark:border-gray-700 pt-3 space-y-2">
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
                    <div className="flex-1 min-w-[120px]"><label className="block text-xs mb-1">メモ</label><input type="text" value={compNote} onChange={e => setCompNote(e.target.value)} className="w-full px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" /></div>
                    <Button size="sm" type="button" onClick={() => compMut.mutate()} disabled={compMut.isPending}><Plus className="h-3.5 w-3.5 mr-1" />追加</Button>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ─── 時間調整 詳細 ─── */}
          {openSection === 'ta' && (
            <section className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">時間調整の詳細</h2>
                <button type="button" onClick={() => setOpenSection(null)} className="text-gray-400 hover:text-gray-600"><ChevronUp className="h-4 w-4" /></button>
              </div>
              <div className="p-4 space-y-4">
                <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-3 inline-block">
                  <p className="text-xs text-gray-500">調整済み累計</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{summary.timeAdjustment.totalHours}時間</p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">時間調整の履歴</p>
                  {summary.timeAdjustment.entries.length === 0 ? (
                    <p className="text-sm text-gray-400">まだ記録がありません。</p>
                  ) : (
                    <div className="space-y-2">
                      {summary.timeAdjustment.entries.map(ta => (
                        <div key={ta.id} className="flex items-start justify-between gap-2 py-2 border-b border-gray-100 dark:border-gray-700">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-800 dark:text-gray-200 w-28">{fmt(ta.adjustedAt)}</span>
                              <span className="text-sm text-gray-700 dark:text-gray-300">{ta.hours}時間早上がり</span>
                              {ta.confirmedBy && (
                                <span className="flex items-center gap-0.5 text-xs text-green-600 dark:text-green-400">
                                  <CheckCircle className="h-3 w-3" />{ta.confirmedBy.name}確認済み
                                </span>
                              )}
                            </div>
                            {ta.compensatoryLeave && <p className="text-xs text-gray-500 mt-0.5 ml-28">代休：{fmtFull(ta.compensatoryLeave.grantedAt)}付与分</p>}
                            {ta.sourceSchedule && <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 ml-28">元タスク：{ta.sourceSchedule.title || ta.sourceSchedule.activityDescription}（{fmtFull(ta.sourceSchedule.startDate)}）</p>}
                            {ta.note && <p className="text-xs text-gray-400 mt-0.5 ml-28">{ta.note}</p>}
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            {isStaff && !ta.confirmedBy && (
                              <button type="button" onClick={() => taConfirmMut.mutate(ta.id)}
                                className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200">
                                <Check className="h-3 w-3" />確認
                              </button>
                            )}
                            <button type="button" onClick={() => { if (confirm('削除しますか？')) taDeleteMut.mutate(ta.id); }}
                              className="text-red-400 hover:text-red-600 p-1"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="border-t dark:border-gray-700 pt-3 space-y-2">
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
          )}
        </>
      )}
    </div>
  );
};
