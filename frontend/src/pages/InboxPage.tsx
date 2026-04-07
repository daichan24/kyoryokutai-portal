import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { formatTime } from '../utils/date';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { X, CheckCircle, Clock, MessageSquare, ShieldAlert, Inbox, Send, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { User } from '../types';

// ============================================================
// 型定義
// ============================================================
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
  assignedUsers?: Array<{ id: string; name: string; role: string }>;
  resolvedBy?: { id: string; name: string } | null;
}

interface ConsultationComment {
  id: string;
  body: string;
  isInternal: boolean;
  createdAt: string;
  author: { id: string; name: string; role: string; avatarColor: string };
}

interface ConsultationDetail extends ConsultationRow {
  assignedUsers: Array<{ id: string; name: string; role: string; avatarColor: string }>;
  comments: ConsultationComment[];
}

interface ReceptionData {
  scheduleInvites: Array<{
    id: string; status: string; createdAt: string;
    schedule: { id: string; activityDescription: string; date: string; startTime: string; endTime: string; user: { id: string; name: string } };
    user?: { id: string; name: string };
  }>;
  consultations: Array<{
    id: string; subject: string | null; body: string; status: string; createdAt: string;
    resolvedAt?: string | null; resolvedBy?: { id: string; name: string } | null;
    resolutionNote?: string | null; member: { id: string; name: string };
    targetUser?: { id: string; name: string } | null;
  }>;
  expenses: Array<{ id: string; amount: number; description: string; spentAt: string; createdAt: string; user: { id: string; name: string }; project?: { id: string; projectName: string } | null }>;
  weeklyReports: Array<{ id: string; week: string; submittedAt: string; user: { id: string; name: string } }>;
  inspections: Array<{ id: string; destination: string; date: string; createdAt: string; user: { id: string; name: string } }>;
  monthlyReports: Array<{ id: string; month: string; submittedAt: string; creator: { id: string; name: string } }>;
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

// タブ定義
type TabKey = 'all' | 'pending' | 'unapproved' | 'resolved';

// ============================================================
// 相談詳細モーダル
// ============================================================
const ConsultationDetailModal: React.FC<{
  consultationId: string;
  onClose: () => void;
  isStaff: boolean;
  onResolved: () => void;
}> = ({ consultationId, onClose, isStaff, onResolved }) => {
  const queryClient = useQueryClient();
  const [commentBody, setCommentBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [resolveNote, setResolveNote] = useState('');
  const [showResolve, setShowResolve] = useState(false);

  const { data: detail, isLoading } = useQuery({
    queryKey: ['consultation-detail', consultationId],
    queryFn: async () => {
      const r = await api.get<ConsultationDetail>(`/api/consultations/${consultationId}`);
      return r.data;
    },
  });

  const commentMut = useMutation({
    mutationFn: async () => {
      await api.post(`/api/consultations/${consultationId}/comments`, { body: commentBody, isInternal });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation-detail', consultationId] });
      setCommentBody('');
    },
  });

  const resolveMut = useMutation({
    mutationFn: async () => {
      await api.patch(`/api/consultations/${consultationId}/resolve`, { resolutionNote: resolveNote || '対応済み' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultation-detail', consultationId] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['reception-box'] });
      setShowResolve(false);
      onResolved();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full h-[95vh] sm:h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center shrink-0">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate pr-4">
            相談詳細: {detail?.subject || '（件名なし）'}
          </h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? <div className="flex justify-center py-12"><LoadingSpinner /></div> : detail ? (
            <>
              <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-lg border border-blue-100 dark:border-blue-800/50">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs shrink-0" style={{ backgroundColor: detail.member?.avatarColor || '#ccc' }}>
                    {detail.member?.name?.[0] || '？'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{detail.member?.name}さん</p>
                    <p className="text-xs text-gray-500">{format(new Date(detail.createdAt), 'yyyy/MM/dd HH:mm', { locale: ja })}</p>
                  </div>
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${detail.status === 'OPEN' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                    {detail.status === 'OPEN' ? '未対応' : '対応済み'}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{detail.body}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-3">宛先: {audienceLabel(detail.audience)}</p>
                {detail.status === 'RESOLVED' && detail.resolvedBy && (
                  <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700 text-xs text-green-700 dark:text-green-400">
                    ✓ 対応済み — {detail.resolvedBy.name}
                    {detail.resolvedAt && ` (${format(new Date(detail.resolvedAt), 'M/d HH:mm', { locale: ja })})`}
                    {detail.resolutionNote && <p className="mt-1 text-gray-600 dark:text-gray-400">{detail.resolutionNote}</p>}
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="text-sm font-bold text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> 相談履歴・返信
                </h4>
                {detail.comments?.length === 0 ? (
                  <p className="text-sm text-gray-500 italic text-center py-4">まだ返信はありません</p>
                ) : detail.comments?.map(c => (
                  <div key={c.id} className={`p-3 rounded-lg border text-sm ${c.isInternal ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200' : 'bg-gray-50 dark:bg-gray-700/30 border-gray-100 dark:border-gray-700'}`}>
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs">{c.author.name}</span>
                        {c.isInternal && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200 text-amber-700 flex items-center gap-1"><ShieldAlert className="w-3 h-3" />内部のみ</span>}
                      </div>
                      <span className="text-[10px] text-gray-400">{format(new Date(c.createdAt), 'M/d HH:mm', { locale: ja })}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-gray-800 dark:text-gray-200">{c.body}</p>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>

        <div className="p-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 shrink-0 space-y-3">
          {isStaff && detail?.status === 'OPEN' && !showResolve && (
            <Button size="sm" variant="outline" onClick={() => setShowResolve(true)}>対応済みにする</Button>
          )}
          {showResolve && (
            <div className="space-y-2">
              <textarea value={resolveNote} onChange={e => setResolveNote(e.target.value)} rows={2}
                className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm"
                placeholder="対応内容（任意）" />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => resolveMut.mutate()} disabled={resolveMut.isPending}>保存</Button>
                <Button size="sm" variant="outline" onClick={() => setShowResolve(false)}>キャンセル</Button>
              </div>
            </div>
          )}
          <textarea value={commentBody} onChange={e => setCommentBody(e.target.value)} rows={3}
            className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm"
            placeholder="返信・協議内容を入力..." />
          <div className="flex justify-between items-center">
            {isStaff ? (
              <label className="flex items-center gap-2 text-xs text-amber-600 cursor-pointer">
                <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)} className="rounded" />
                スタッフ間のみ（隊員には非表示）
              </label>
            ) : <div />}
            <Button size="sm" onClick={() => { if (!commentBody.trim()) return; commentMut.mutate(); }} disabled={commentMut.isPending || !commentBody.trim()}>
              送信
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// メインページ
// ============================================================
export const InboxPage: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isMember = user?.role === 'MEMBER';
  const isStaff = !isMember;

  const [activeTab, setActiveTab] = useState<TabKey>('pending');
  const [selectedConsultationId, setSelectedConsultationId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // 相談送信フォーム（メンバー用）
  const [showNewConsultation, setShowNewConsultation] = useState(false);
  const [audience, setAudience] = useState<ConsultationAudience>('ANY');
  const [targetUserIds, setTargetUserIds] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');

  // スタッフ用: 受付ボックスデータ
  const { data: receptionData, isLoading: receptionLoading } = useQuery<ReceptionData>({
    queryKey: ['reception-box', 'list'],
    queryFn: async () => (await api.get('/api/reception-box')).data,
    enabled: isStaff,
  });

  // スタッフ用: 相談inbox
  const { data: consultationInbox = [], isLoading: inboxLoading } = useQuery<ConsultationRow[]>({
    queryKey: ['consultations', 'inbox-all'],
    queryFn: async () => (await api.get<ConsultationRow[]>('/api/consultations/inbox?status=ALL')).data || [],
    enabled: isStaff,
  });

  // メンバー用: 自分の相談
  const { data: myConsultations = [], isLoading: myLoading } = useQuery<ConsultationRow[]>({
    queryKey: ['consultations', 'mine'],
    queryFn: async () => (await api.get<ConsultationRow[]>('/api/consultations/mine')).data || [],
    enabled: isMember,
  });

  // メンバー用: 受付ボックス（スケジュール招待）
  const { data: memberReception, isLoading: memberReceptionLoading } = useQuery<ReceptionData>({
    queryKey: ['reception-box', 'list'],
    queryFn: async () => (await api.get('/api/reception-box')).data,
    enabled: isMember,
  });

  // スタッフ用: 宛先ユーザー一覧
  const { data: staffUsers = [] } = useQuery<User[]>({
    queryKey: ['consultations', 'staff-users'],
    queryFn: async () => {
      const [s, g] = await Promise.all([api.get<User[]>('/api/users?role=SUPPORT'), api.get<User[]>('/api/users?role=GOVERNMENT')]);
      return [...(s.data || []), ...(g.data || [])].sort((a, b) => a.name.localeCompare(b.name, 'ja'));
    },
    enabled: isMember,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      await api.post('/api/consultations', {
        audience,
        targetUserIds: audience === 'SPECIFIC_USER' ? targetUserIds : undefined,
        subject: subject.trim() || undefined,
        body: body.trim(),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consultations'] });
      queryClient.invalidateQueries({ queryKey: ['reception-box'] });
      setBody(''); setSubject(''); setTargetUserIds([]); setAudience('ANY');
      setShowNewConsultation(false);
    },
  });

  const handleScheduleAction = async (scheduleId: string, participantId: string, decision: 'APPROVED' | 'REJECTED') => {
    setActionLoading(true);
    try {
      await api.post(`/api/schedules/${scheduleId}/respond`, { decision });
      queryClient.invalidateQueries({ queryKey: ['reception-box'] });
      queryClient.invalidateQueries({ queryKey: ['reception-box', 'unread-count'] });
    } catch (e: any) {
      alert(`操作に失敗しました: ${e.response?.data?.error || e.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const isLoading = isStaff ? (receptionLoading || inboxLoading) : (myLoading || memberReceptionLoading);
  if (isLoading) return <div className="flex justify-center p-8"><LoadingSpinner /></div>;

  // ============================================================
  // スタッフ用: 全アイテムを統合してフィルタリング
  // ============================================================
  type UnifiedItem = {
    id: string;
    type: 'scheduleInvite' | 'consultation' | 'weeklyReport' | 'inspection' | 'monthlyReport' | 'expense';
    status: 'pending' | 'unapproved' | 'resolved';
    from: string; // 誰から
    label: string; // 何月分・内容
    createdAt: string;
    raw: any;
  };

  const allItems: UnifiedItem[] = isStaff ? [
    ...(receptionData?.scheduleInvites || []).map(s => ({
      id: s.id, type: 'scheduleInvite' as const,
      status: s.status === 'PENDING' ? 'unapproved' as const : 'resolved' as const,
      from: s.schedule.user.name,
      label: `スケジュール招待: ${s.schedule.activityDescription} (${format(new Date(s.schedule.date), 'M月d日', { locale: ja })})`,
      createdAt: s.createdAt, raw: s,
    })),
    ...consultationInbox.map(c => ({
      id: c.id, type: 'consultation' as const,
      status: c.status === 'OPEN' ? 'pending' as const : 'resolved' as const,
      from: c.member?.name || '不明',
      label: `相談: ${c.subject || '（件名なし）'}`,
      createdAt: c.createdAt, raw: c,
    })),
    ...(receptionData?.weeklyReports || []).map(r => ({
      id: r.id, type: 'weeklyReport' as const, status: 'unapproved' as const,
      from: r.user.name, label: `週次報告: ${r.week}`,
      createdAt: r.submittedAt, raw: r,
    })),
    ...(receptionData?.inspections || []).map(i => ({
      id: i.id, type: 'inspection' as const, status: 'unapproved' as const,
      from: i.user.name, label: `復命書: ${i.destination || '視察先未記入'} (${format(new Date(i.date), 'M月d日', { locale: ja })})`,
      createdAt: i.createdAt, raw: i,
    })),
    ...(receptionData?.monthlyReports || []).map(m => ({
      id: m.id, type: 'monthlyReport' as const, status: 'unapproved' as const,
      from: m.creator.name, label: `月次報告: ${m.month}`,
      createdAt: m.submittedAt, raw: m,
    })),
    ...(receptionData?.expenses || []).map(e => ({
      id: e.id, type: 'expense' as const, status: 'unapproved' as const,
      from: e.user.name, label: `活動経費: ${e.description} ¥${e.amount.toLocaleString()}`,
      createdAt: e.createdAt, raw: e,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) : [];

  const filteredItems = allItems.filter(item => {
    if (activeTab === 'all') return true;
    if (activeTab === 'pending') return item.status === 'pending';
    if (activeTab === 'unapproved') return item.status === 'unapproved';
    if (activeTab === 'resolved') return item.status === 'resolved';
    return true;
  });

  const counts = {
    all: allItems.length,
    pending: allItems.filter(i => i.status === 'pending').length,
    unapproved: allItems.filter(i => i.status === 'unapproved').length,
    resolved: allItems.filter(i => i.status === 'resolved').length,
  };

  const typeColors: Record<string, string> = {
    scheduleInvite: 'bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200',
    consultation: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200',
    weeklyReport: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200',
    inspection: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200',
    monthlyReport: 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200',
    expense: 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200',
  };

  const typeLabels: Record<string, string> = {
    scheduleInvite: 'スケジュール招待', consultation: '相談',
    weeklyReport: '週次報告', inspection: '復命書',
    monthlyReport: '月次報告', expense: '活動経費',
  };

  const tabs: Array<{ key: TabKey; label: string; icon: React.ReactNode }> = [
    { key: 'all', label: 'すべて', icon: <Inbox className="h-4 w-4" /> },
    { key: 'pending', label: '未対応', icon: <MessageSquare className="h-4 w-4" /> },
    { key: 'unapproved', label: '未承認', icon: <Clock className="h-4 w-4" /> },
    { key: 'resolved', label: '解決済み', icon: <CheckCircle className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">受付ボックス・相談</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isStaff ? `未対応 ${counts.pending} 件 / 未承認 ${counts.unapproved} 件` : '相談の送信・確認'}
          </p>
        </div>
        {isMember && (
          <Button onClick={() => setShowNewConsultation(true)}>
            <Send className="h-4 w-4 mr-2" />新しい相談
          </Button>
        )}
      </div>

      {/* タブ（スタッフ用） */}
      {isStaff && (
        <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}>
              {tab.icon}{tab.label}
              {counts[tab.key] > 0 && (
                <span className={`ml-1 text-xs rounded-full px-1.5 py-0.5 min-w-[1.25rem] text-center ${
                  tab.key === 'pending' ? 'bg-red-500 text-white' : tab.key === 'unapproved' ? 'bg-amber-500 text-white' : 'bg-gray-400 text-white'
                }`}>{counts[tab.key]}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* スタッフ用: アイテム一覧 */}
      {isStaff && (
        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg border border-gray-200 dark:border-gray-700 text-center text-gray-500">
              <CheckCircle className="h-10 w-10 mx-auto mb-2 text-green-400" />
              {activeTab === 'resolved' ? '解決済みの項目はまだありません' : '該当する項目はありません'}
            </div>
          ) : filteredItems.map(item => (
            <div key={`${item.type}-${item.id}`}
              className={`bg-white dark:bg-gray-800 border rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
                item.status === 'resolved' ? 'border-gray-200 dark:border-gray-700 opacity-75' : 'border-gray-200 dark:border-gray-700'
              }`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColors[item.type]}`}>
                    {typeLabels[item.type]}
                  </span>
                  {item.status === 'resolved' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">解決済み</span>
                  )}
                </div>
                <p className="font-medium text-gray-900 dark:text-gray-100 text-sm truncate">
                  <span className="text-gray-500 mr-1">{item.from}さん:</span>{item.label.replace(/^[^:]+: /, '')}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{format(new Date(item.createdAt), 'M月d日 HH:mm', { locale: ja })}</p>
                {/* 解決済みの場合: 対応者を表示 */}
                {item.status === 'resolved' && item.type === 'consultation' && item.raw.resolvedBy && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                    対応: {item.raw.resolvedBy.name}
                    {item.raw.resolvedAt && ` — ${format(new Date(item.raw.resolvedAt), 'M/d HH:mm', { locale: ja })}`}
                  </p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {item.type === 'scheduleInvite' && item.status === 'unapproved' && (
                  <>
                    <Button size="sm" onClick={() => handleScheduleAction(item.raw.schedule.id, item.id, 'APPROVED')} disabled={actionLoading}>承認</Button>
                    <Button size="sm" variant="outline" onClick={() => handleScheduleAction(item.raw.schedule.id, item.id, 'REJECTED')} disabled={actionLoading}>断る</Button>
                  </>
                )}
                {item.type === 'consultation' && (
                  <Button size="sm" variant="outline" onClick={() => setSelectedConsultationId(item.id)}>
                    {item.status === 'pending' ? '確認・対応' : '詳細'}
                  </Button>
                )}
                {(item.type === 'weeklyReport' || item.type === 'inspection' || item.type === 'monthlyReport' || item.type === 'expense') && (
                  <Button size="sm" variant="outline" onClick={() => {
                    const routes: Record<string, string> = {
                      weeklyReport: '/reports/weekly',
                      inspection: '/inspections',
                      monthlyReport: '/reports/monthly',
                      expense: '/activity-expenses',
                    };
                    navigate(routes[item.type]);
                  }}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />確認
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* メンバー用: スケジュール招待 */}
      {isMember && (
        <div className="space-y-4">
          {(memberReception?.scheduleInvites || []).filter(s => s.status === 'PENDING').length > 0 && (
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">スケジュール招待</h2>
              {(memberReception?.scheduleInvites || []).filter(s => s.status === 'PENDING').map(s => (
                <div key={s.id} className="bg-white dark:bg-gray-800 border border-teal-200 dark:border-teal-800 rounded-lg p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <p className="font-medium text-sm">{s.schedule.user.name}さんから: {s.schedule.activityDescription}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{format(new Date(s.schedule.date), 'M月d日', { locale: ja })} {formatTime(s.schedule.startTime)}〜{formatTime(s.schedule.endTime)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleScheduleAction(s.schedule.id, s.id, 'APPROVED')} disabled={actionLoading}>承認</Button>
                    <Button size="sm" variant="outline" onClick={() => handleScheduleAction(s.schedule.id, s.id, 'REJECTED')} disabled={actionLoading}>断る</Button>
                  </div>
                </div>
              ))}
            </section>
          )}

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">送った相談</h2>
            </div>
            {myLoading ? <LoadingSpinner /> : myConsultations.length === 0 ? (
              <p className="text-sm text-gray-500">まだ相談はありません。</p>
            ) : (
              <div className="space-y-3">
                {myConsultations.map(c => (
                  <div key={c.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status === 'OPEN' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                            {c.status === 'OPEN' ? '未対応' : '対応済み'}
                          </span>
                        </div>
                        <p className="font-medium text-sm text-gray-900 dark:text-gray-100">{c.subject || '（件名なし）'}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{audienceLabel(c.audience)} · {format(new Date(c.createdAt), 'M/d HH:mm', { locale: ja })}</p>
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 line-clamp-2">{c.body}</p>
                        {c.status === 'RESOLVED' && c.resolutionNote && (
                          <div className="mt-2 pt-2 border-t border-dashed border-gray-200 dark:border-gray-600 text-xs">
                            <p className="text-green-600 dark:text-green-400">✓ 対応済み{c.resolvedBy && ` — ${c.resolvedBy.name}`}</p>
                            <p className="text-gray-600 dark:text-gray-400 mt-0.5">{c.resolutionNote}</p>
                          </div>
                        )}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setSelectedConsultationId(c.id)}>詳細</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* 新しい相談モーダル（メンバー用） */}
      {showNewConsultation && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowNewConsultation(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">新しい相談</h3>
              <button onClick={() => setShowNewConsultation(false)}><X className="h-5 w-5 text-gray-500" /></button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">相手</label>
              <select value={audience} onChange={e => setAudience(e.target.value as ConsultationAudience)}
                className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm">
                <option value="ANY">{audienceLabel('ANY')}</option>
                <option value="SUPPORT_ONLY">{audienceLabel('SUPPORT_ONLY')}</option>
                <option value="GOVERNMENT_ONLY">{audienceLabel('GOVERNMENT_ONLY')}</option>
                <option value="SPECIFIC_USER">{audienceLabel('SPECIFIC_USER')}</option>
              </select>
            </div>
            {audience === 'SPECIFIC_USER' && (
              <div>
                <label className="block text-sm font-medium mb-1">ユーザー</label>
                <select multiple value={targetUserIds} onChange={e => setTargetUserIds(Array.from(e.target.selectedOptions, o => o.value))}
                  className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 h-28 text-sm">
                  {staffUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">件名（任意）</label>
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)} maxLength={400}
                className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">内容</label>
              <textarea value={body} onChange={e => setBody(e.target.value)} rows={5}
                className="w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-sm"
                placeholder="相談内容を具体的に書いてください" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowNewConsultation(false)}>キャンセル</Button>
              <Button onClick={() => { if (!body.trim()) { alert('内容を入力してください'); return; } createMut.mutate(); }} disabled={createMut.isPending}>
                送信する
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 相談詳細モーダル */}
      {selectedConsultationId && (
        <ConsultationDetailModal
          consultationId={selectedConsultationId}
          onClose={() => setSelectedConsultationId(null)}
          isStaff={isStaff}
          onResolved={() => {
            queryClient.invalidateQueries({ queryKey: ['consultations'] });
            queryClient.invalidateQueries({ queryKey: ['reception-box'] });
          }}
        />
      )}
    </div>
  );
};
