import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { formatTime } from '../utils/date';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { X, CheckCircle, Clock } from 'lucide-react';

interface ReceptionData {
  scheduleInvites: Array<{
    id: string;
    status: string;
    createdAt: string;
    schedule: {
      id: string;
      activityDescription: string;
      date: string;
      startTime: string;
      endTime: string;
      user: { id: string; name: string };
    };
    user?: { id: string; name: string };
  }>;
  consultations: Array<{
    id: string;
    subject: string | null;
    body: string;
    status: string;
    createdAt: string;
    resolvedAt?: string | null;
    resolvedBy?: { id: string; name: string } | null;
    resolutionNote?: string | null;
    member: { id: string; name: string };
    targetUser?: { id: string; name: string } | null;
  }>;
  expenses: Array<{
    id: string;
    amount: number;
    description: string;
    spentAt: string;
    createdAt: string;
    updatedAt: string;
    status: string;
    rejectionReason?: string | null;
    user: { id: string; name: string };
    project?: { id: string; projectName: string } | null;
    updatedBy?: { id: string; name: string } | null;
  }>;
  weeklyReports: Array<{
    id: string;
    week: string;
    submittedAt: string;
    user: { id: string; name: string };
  }>;
  inspections: Array<{
    id: string;
    destination: string;
    date: string;
    createdAt: string;
    user: { id: string; name: string };
  }>;
  monthlyReports: Array<{
    id: string;
    month: string;
    submittedAt: string;
    approvalStatus?: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
    approvedAt?: string | null;
    creator: { id: string; name: string };
    approver?: { id: string; name: string } | null;
  }>;
}

// ポップアップで表示するアイテムの型
type PopupItem =
  | { type: 'consultation'; data: ReceptionData['consultations'][0] }
  | { type: 'weeklyReport'; data: ReceptionData['weeklyReports'][0] }
  | { type: 'inspection'; data: ReceptionData['inspections'][0] }
  | { type: 'monthlyReport'; data: ReceptionData['monthlyReports'][0] }
  | { type: 'expense'; data: ReceptionData['expenses'][0] }
  | { type: 'scheduleInvite'; data: ReceptionData['scheduleInvites'][0] };

// ポップアップコンポーネント
const ItemPopup: React.FC<{
  item: PopupItem;
  onClose: () => void;
  onAction?: (action: string) => void;
  actionLoading?: boolean;
}> = ({ item, onClose, onAction, actionLoading }) => {
  const { user } = useAuthStore();
  const isStaff = user?.role !== 'MEMBER';

  const renderContent = () => {
    switch (item.type) {
      case 'scheduleInvite':
        return (
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">スケジュール招待</h3>
            <p className="text-gray-700 dark:text-gray-300">
              <span className="font-medium">{item.data.schedule.user.name}</span>さんから招待されています
            </p>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-1 text-sm">
              <p><span className="text-gray-500">内容:</span> {item.data.schedule.activityDescription}</p>
              <p><span className="text-gray-500">日時:</span> {format(new Date(item.data.schedule.date), 'yyyy年M月d日', { locale: ja })} {formatTime(item.data.schedule.startTime)}〜{formatTime(item.data.schedule.endTime)}</p>
            </div>
            <div className="flex gap-2 pt-2">
              <Button size="sm" onClick={() => onAction?.('APPROVED')} disabled={actionLoading}>
                承認する
              </Button>
              <Button size="sm" variant="outline" onClick={() => onAction?.('REJECTED')} disabled={actionLoading}>
                断る
              </Button>
            </div>
          </div>
        );
      case 'consultation':
        return (
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">相談内容</h3>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2 text-sm">
              <p><span className="text-gray-500">送信者:</span> {item.data.member.name}</p>
              {item.data.subject && <p><span className="text-gray-500">件名:</span> {item.data.subject}</p>}
              <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">{item.data.body}</p>
              <p className="text-xs text-gray-400">{format(new Date(item.data.createdAt), 'yyyy/MM/dd HH:mm', { locale: ja })}</p>
            </div>
            {item.data.status === 'RESOLVED' && item.data.resolvedBy && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-sm">
                <p className="text-green-700 dark:text-green-300 font-medium">✓ 対応済み</p>
                <p className="text-gray-600 dark:text-gray-400">対応者: {item.data.resolvedBy.name}</p>
                {item.data.resolvedAt && <p className="text-gray-400 text-xs">{format(new Date(item.data.resolvedAt), 'yyyy/MM/dd HH:mm', { locale: ja })}</p>}
                {item.data.resolutionNote && <p className="mt-1 text-gray-700 dark:text-gray-300">{item.data.resolutionNote}</p>}
              </div>
            )}
            {isStaff && item.data.status === 'OPEN' && (
              <Button size="sm" onClick={() => onAction?.('resolve')} disabled={actionLoading}>
                完了にする
              </Button>
            )}
          </div>
        );
      case 'weeklyReport':
        return (
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">週次報告</h3>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-1 text-sm">
              <p><span className="text-gray-500">提出者:</span> {item.data.user.name}</p>
              <p><span className="text-gray-500">対象週:</span> {item.data.week}</p>
              <p><span className="text-gray-500">提出日時:</span> {format(new Date(item.data.submittedAt), 'yyyy/MM/dd HH:mm', { locale: ja })}</p>
            </div>
            {isStaff && (
              <Button size="sm" onClick={() => onAction?.('confirm')} disabled={actionLoading}>
                確認済みにする
              </Button>
            )}
          </div>
        );
      case 'inspection':
        return (
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">復命書・視察</h3>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-1 text-sm">
              <p><span className="text-gray-500">提出者:</span> {item.data.user.name}</p>
              <p><span className="text-gray-500">視察先:</span> {item.data.destination || '未記入'}</p>
              <p><span className="text-gray-500">日付:</span> {format(new Date(item.data.date), 'yyyy/MM/dd', { locale: ja })}</p>
            </div>
            {isStaff && (
              <Button size="sm" onClick={() => onAction?.('confirm')} disabled={actionLoading}>
                確認済みにする
              </Button>
            )}
          </div>
        );
      case 'monthlyReport':
        return (
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">月次報告</h3>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-1 text-sm">
              <p><span className="text-gray-500">提出者:</span> {item.data.creator.name}</p>
              <p><span className="text-gray-500">対象月:</span> {item.data.month}</p>
              <p><span className="text-gray-500">提出日時:</span> {format(new Date(item.data.submittedAt), 'yyyy/MM/dd HH:mm', { locale: ja })}</p>
            </div>
            {isStaff && (
              <Button size="sm" onClick={() => onAction?.('confirm')} disabled={actionLoading}>
                確認済みにする
              </Button>
            )}
          </div>
        );
      case 'expense':
        return (
          <div className="space-y-3">
            <h3 className="font-semibold text-lg">活動経費</h3>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-1 text-sm">
              <p><span className="text-gray-500">申請者:</span> {item.data.user.name}</p>
              <p><span className="text-gray-500">内容:</span> {item.data.description}</p>
              <p><span className="text-gray-500">金額:</span> ¥{item.data.amount.toLocaleString()}</p>
              {item.data.project && <p><span className="text-gray-500">プロジェクト:</span> {item.data.project.projectName}</p>}
              <p><span className="text-gray-500">支出日:</span> {format(new Date(item.data.spentAt), 'yyyy/MM/dd', { locale: ja })}</p>
              <p><span className="text-gray-500">登録日:</span> {format(new Date(item.data.createdAt), 'yyyy/MM/dd HH:mm', { locale: ja })}</p>
            </div>
            {isStaff && item.data.status === 'PENDING' && (
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={() => onAction?.('approveExpense')} disabled={actionLoading}>
                  承認する
                </Button>
                <Button size="sm" variant="outline" onClick={() => onAction?.('rejectExpense')} disabled={actionLoading}>
                  差し戻す
                </Button>
              </div>
            )}
            {item.data.status === 'APPROVED' && (
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-sm mt-2 space-y-1">
                <p className="text-green-700 dark:text-green-300 font-medium">✓ 承認済み</p>
                {item.data.updatedBy && (
                  <p className="text-gray-600 dark:text-gray-400">承認者: {item.data.updatedBy.name}</p>
                )}
                <p className="text-gray-400 text-xs">{format(new Date(item.data.updatedAt), 'yyyy/MM/dd HH:mm', { locale: ja })}</p>
              </div>
            )}
            {item.data.status === 'REJECTED' && (
              <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-sm mt-2 space-y-1">
                <p className="text-red-700 dark:text-red-300 font-medium">✗ 差し戻し</p>
                {item.data.updatedBy && (
                  <p className="text-gray-600 dark:text-gray-400">差し戻し者: {item.data.updatedBy.name}</p>
                )}
                {item.data.rejectionReason && (
                  <p className="text-gray-700 dark:text-gray-300">理由: {item.data.rejectionReason}</p>
                )}
                <p className="text-gray-400 text-xs">{format(new Date(item.data.updatedAt), 'yyyy/MM/dd HH:mm', { locale: ja })}</p>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg min-w-0 max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
          <span className="text-sm text-gray-500 dark:text-gray-400">詳細</span>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <div className="p-4 sm:p-5 min-w-0 break-words">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export const ReceptionBox: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isMember = user?.role === 'MEMBER';
  const [activeTab, setActiveTab] = useState<'pending' | 'unapproved' | 'resolved'>(isMember ? 'unapproved' : 'pending');
  const [popupItem, setPopupItem] = useState<PopupItem | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const { data, isLoading } = useQuery<ReceptionData>({
    queryKey: ['reception-box', 'list'],
    queryFn: async () => {
      const response = await api.get('/api/reception-box');
      return response.data;
    },
  });

  const handleAction = async (action: string) => {
    if (!popupItem) return;
    setActionLoading(true);
    try {
      if (popupItem.type === 'scheduleInvite') {
        await api.post(`/api/schedules/${popupItem.data.schedule.id}/respond`, { decision: action });
        queryClient.invalidateQueries({ queryKey: ['reception-box'] });
        queryClient.invalidateQueries({ queryKey: ['reception-box', 'unread-count'] });
        setPopupItem(null);
      } else if (popupItem.type === 'consultation' && action === 'resolve') {
        const note = window.prompt('対応内容を入力してください（任意）') ?? '';
        await api.patch(`/api/consultations/${popupItem.data.id}/resolve`, { resolutionNote: note || '対応済み' });
        queryClient.invalidateQueries({ queryKey: ['reception-box'] });
        setPopupItem(null);
      } else if (popupItem.type === 'expense') {
        if (action === 'approveExpense') {
          await api.post(`/api/activity-expenses/entries/${popupItem.data.id}/approve`);
          queryClient.invalidateQueries({ queryKey: ['reception-box'] });
          queryClient.invalidateQueries({ queryKey: ['reception-box', 'unread-count'] });
          queryClient.invalidateQueries({ queryKey: ['activity-expenses'] });
          setPopupItem(null);
        } else if (action === 'rejectExpense') {
          const reason = window.prompt('差し戻し理由を入力してください（任意）') ?? '';
          await api.post(`/api/activity-expenses/entries/${popupItem.data.id}/reject`, { reason });
          queryClient.invalidateQueries({ queryKey: ['reception-box'] });
          queryClient.invalidateQueries({ queryKey: ['reception-box', 'unread-count'] });
          queryClient.invalidateQueries({ queryKey: ['activity-expenses'] });
          setPopupItem(null);
        }
      } else if (action === 'confirm') {
        // モーダルを閉じるだけ（プレビュー確認済みとして扱う）
        setPopupItem(null);
      }
    } catch (e: any) {
      alert(`操作に失敗しました: ${e.response?.data?.error || e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><LoadingSpinner /></div>;
  }

  if (!data) return null;

  // 未対応（相談）件数
  const pendingCount = data.consultations.filter(c => c.status === 'OPEN').length;

  // 未承認（報告書・経費・スケジュール招待）件数
  const unapprovedCount =
    data.scheduleInvites.filter(s => s.status === 'PENDING').length +
    data.expenses.filter(e => e.status === 'PENDING').length +
    data.weeklyReports.length +
    data.inspections.length +
    data.monthlyReports.filter(m => m.approvalStatus !== 'APPROVED' && m.approvalStatus !== 'REJECTED').length;

  // 解決済み件数
  const resolvedCount =
    data.consultations.filter(c => c.status === 'RESOLVED').length +
    data.expenses.filter(e => e.status === 'APPROVED' || e.status === 'REJECTED').length;

  // 未対応タブ（相談のみ）
  const renderPending = () => (
    <div className="space-y-4">
      {data.consultations.filter(c => c.status === 'OPEN').map((c) => (
        <div key={c.id} className="w-full min-w-0 bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200">相談</span>
            </div>
            <p className="font-medium text-gray-900 dark:text-gray-100 text-sm break-words">{c.member.name}さん: {c.subject || '（件名なし）'}</p>
            <p className="text-xs text-gray-500 mt-0.5">{format(new Date(c.createdAt), 'M月d日 HH:mm', { locale: ja })}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setPopupItem({ type: 'consultation', data: c })}>
            確認・対応
          </Button>
        </div>
      ))}
      {pendingCount === 0 && (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg border border-gray-200 dark:border-gray-700 text-center text-gray-500">
          <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-400" />
          未対応の相談はありません
        </div>
      )}
    </div>
  );

  // 未承認タブ（報告書・経費・スケジュール招待）
  const renderUnapproved = () => (
    <div className="space-y-4">
      {/* スケジュール招待 */}
      {data.scheduleInvites.filter(s => s.status === 'PENDING').map((s) => (
        <div key={s.id} className="w-full min-w-0 bg-white dark:bg-gray-800 border border-teal-200 dark:border-teal-800 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200">スケジュール招待</span>
            </div>
            <p className="font-medium text-gray-900 dark:text-gray-100 text-sm break-words">{s.schedule.user.name}さんから: {s.schedule.activityDescription}</p>
            <p className="text-xs text-gray-500 mt-0.5">{format(new Date(s.schedule.date), 'M月d日', { locale: ja })} {formatTime(s.schedule.startTime)}〜{formatTime(s.schedule.endTime)}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setPopupItem({ type: 'scheduleInvite', data: s })}>
            確認・承認
          </Button>
        </div>
      ))}

      {/* 週次報告 */}
      {!isMember && data.weeklyReports.map((r) => (
        <div key={r.id} className="w-full min-w-0 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200">週次報告</span>
            </div>
            <p className="font-medium text-gray-900 dark:text-gray-100 text-sm break-words">{r.user.name}さん — {r.week}</p>
            <p className="text-xs text-gray-500 mt-0.5">提出: {format(new Date(r.submittedAt), 'M月d日 HH:mm', { locale: ja })}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setPopupItem({ type: 'weeklyReport', data: r })}>
            確認
          </Button>
        </div>
      ))}

      {/* 復命書 */}
      {!isMember && data.inspections.map((i) => (
        <div key={i.id} className="w-full min-w-0 bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200">復命書</span>
            </div>
            <p className="font-medium text-gray-900 dark:text-gray-100 text-sm break-words">{i.user.name}さん — {i.destination || '視察先未記入'}</p>
            <p className="text-xs text-gray-500 mt-0.5">{format(new Date(i.date), 'M月d日', { locale: ja })}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setPopupItem({ type: 'inspection', data: i })}>
            確認
          </Button>
        </div>
      ))}

      {/* 月次報告 */}
      {!isMember && data.monthlyReports.filter(m => m.approvalStatus !== 'APPROVED' && m.approvalStatus !== 'REJECTED').map((m) => (
        <div key={m.id} className="w-full min-w-0 bg-white dark:bg-gray-800 border border-purple-200 dark:border-purple-800 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200">月次報告</span>
            </div>
            <p className="font-medium text-gray-900 dark:text-gray-100 text-sm break-words">{m.creator.name}さん — {m.month}</p>
            <p className="text-xs text-gray-500 mt-0.5">提出: {format(new Date(m.submittedAt), 'M月d日 HH:mm', { locale: ja })}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setPopupItem({ type: 'monthlyReport', data: m })}>
            確認
          </Button>
        </div>
      ))}

      {/* 活動経費（PENDING） */}
      {!isMember && data.expenses.filter(e => e.status === 'PENDING').map((e) => (
        <div key={e.id} className="w-full min-w-0 bg-white dark:bg-gray-800 border border-rose-200 dark:border-rose-800 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200">活動経費</span>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200">承認待ち</span>
            </div>
            <p className="font-medium text-gray-900 dark:text-gray-100 text-sm break-words">{e.user.name}さん: {e.description} — ¥{e.amount.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-0.5">支出日: {format(new Date(e.spentAt), 'M月d日', { locale: ja })}</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setPopupItem({ type: 'expense', data: e })}>
            確認・承認
          </Button>
        </div>
      ))}

      {unapprovedCount === 0 && (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg border border-gray-200 dark:border-gray-700 text-center text-gray-500">
          <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-400" />
          未承認の項目はありません
        </div>
      )}
    </div>
  );

  // 解決済みタブ
  const renderResolved = () => (
    <div className="space-y-4">
      {data.consultations.filter(c => c.status === 'RESOLVED').map((c) => (
        <div key={c.id} className="w-full min-w-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">相談（解決済み）</span>
              </div>
              <p className="font-medium text-gray-900 dark:text-gray-100 text-sm break-words">{c.member.name}さん: {c.subject || '（件名なし）'}</p>
              {c.resolvedBy && (
                <p className="text-xs text-gray-500 mt-1">
                  対応: {c.resolvedBy.name}{c.resolvedAt && ` — ${format(new Date(c.resolvedAt), 'M月d日 HH:mm', { locale: ja })}`}
                </p>
              )}
              {c.resolutionNote && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 bg-gray-50 dark:bg-gray-700/50 rounded px-2 py-1 break-words">{c.resolutionNote}</p>}
            </div>
            <button onClick={() => setPopupItem({ type: 'consultation', data: c })} className="text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap">詳細</button>
          </div>
        </div>
      ))}
      {data.expenses.filter(e => e.status === 'APPROVED' || e.status === 'REJECTED').map((e) => (
        <div key={e.id} className="w-full min-w-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${e.status === 'APPROVED' ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200'}`}>
                  活動経費（{e.status === 'APPROVED' ? '承認済み' : '差し戻し'}）
                </span>
              </div>
              <p className="font-medium text-gray-900 dark:text-gray-100 text-sm break-words">{e.user.name}さん: {e.description}</p>
              <p className="text-xs text-gray-500 mt-1">支出日: {format(new Date(e.spentAt), 'M月d日', { locale: ja })} — ¥{e.amount.toLocaleString()}</p>
            </div>
            <button onClick={() => setPopupItem({ type: 'expense', data: e })} className="text-xs text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap">詳細</button>
          </div>
        </div>
      ))}
      {resolvedCount === 0 && (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg border border-gray-200 dark:border-gray-700 text-center text-gray-500">
          解決済みの項目はまだありません
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto min-w-0">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">受付ボックス</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {!isMember && `未対応 ${pendingCount} 件 / `}未承認 {unapprovedCount} 件 / 解決済み {resolvedCount} 件
        </p>
      </div>

      {/* タブ */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {/* 未対応タブ（スタッフのみ） */}
        {!isMember && (
          <button
            onClick={() => setActiveTab('pending')}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'pending' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            <Clock className="h-4 w-4" />
            未対応
            {pendingCount > 0 && <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">{pendingCount}</span>}
          </button>
        )}
        {/* 未承認タブ */}
        <button
          onClick={() => setActiveTab('unapproved')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'unapproved' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
        >
          <Clock className="h-4 w-4" />
          未承認
          {unapprovedCount > 0 && <span className="ml-1 bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">{unapprovedCount}</span>}
        </button>
        {/* 解決済みタブ */}
        <button
          onClick={() => setActiveTab('resolved')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === 'resolved' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
        >
          <CheckCircle className="h-4 w-4" />
          解決済み
          {resolvedCount > 0 && <span className="ml-1 bg-gray-400 text-white text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center">{resolvedCount}</span>}
        </button>
      </div>

      {activeTab === 'pending' && renderPending()}
      {activeTab === 'unapproved' && renderUnapproved()}
      {activeTab === 'resolved' && renderResolved()}

      {/* ポップアップ */}
      {popupItem && (
        <ItemPopup
          item={popupItem}
          onClose={() => setPopupItem(null)}
          onAction={handleAction}
          actionLoading={actionLoading}
        />
      )}
    </div>
  );
};
