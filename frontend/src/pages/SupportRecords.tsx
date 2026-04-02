import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Plus, Edit2, Trash2, CalendarClock, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { SupportRecordModal } from '../components/support/SupportRecordModal';
import type { User } from '../types';

interface SupportRecord {
  id: string;
  supportDate: string;
  supportContent: string;
  supportBy: string;
  userId: string;
  user: {
    id: string;
    name: string;
    avatarColor?: string;
    avatarLetter?: string | null;
  };
  monthlyReportId?: string;
  monthlyReport?: {
    id: string;
    month: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface MemberTimelineItem {
  kind: string;
  occurredAt: string;
  title: string;
  detail: string;
  link?: string;
}

interface MemberTimelineResponse {
  user: {
    id: string;
    name: string;
    avatarColor: string;
    avatarLetter?: string | null;
  };
  range: { from: string; to: string; days: number };
  items: MemberTimelineItem[];
}

const TIMELINE_KIND_LABELS: Record<string, string> = {
  SCHEDULE: 'スケジュール',
  EVENT: 'イベント',
  WEEKLY_REPORT: '週次報告',
  SUPPORT_RECORD: '支援記録',
  SNS_POST: 'SNS',
  CONTACT_HISTORY: '町民',
  INSPECTION: '視察',
};

export const SupportRecords: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<SupportRecord | null>(null);
  const [sortByMonth, setSortByMonth] = useState<string>('all');
  const [sortByUser, setSortByUser] = useState<string>('all');

  const { data: records = [], isLoading } = useQuery<SupportRecord[]>({
    queryKey: ['support-records'],
    queryFn: async () => {
      const response = await api.get('/api/support-records');
      return response.data;
    },
  });

  const { data: members = [], isLoading: membersLoading } = useQuery<User[]>({
    queryKey: ['support-records', 'members', user?.role],
    queryFn: async () => {
      const response = await api.get<User[]>('/api/users?role=MEMBER');
      const list = response.data || [];
      return list.filter(
        (u) =>
          !(
            user?.role === 'SUPPORT' ||
            user?.role === 'GOVERNMENT' ||
            user?.role === 'MASTER'
          ) || (u.displayOrder ?? 0) !== 0
      );
    },
  });

  const sortedMembers = React.useMemo(
    () => [...members].sort((a, b) => a.name.localeCompare(b.name, 'ja')),
    [members]
  );

  const { data: memberTimeline, isLoading: timelineLoading } = useQuery<MemberTimelineResponse>({
    queryKey: ['support-records', 'member-timeline', sortByUser],
    queryFn: async () => {
      const response = await api.get<MemberTimelineResponse>(
        '/api/support-records/member-timeline',
        { params: { userId: sortByUser } }
      );
      return response.data;
    },
    enabled: sortByUser !== 'all',
  });

  // ソート機能
  const filteredRecords = React.useMemo(() => {
    let filtered = [...records];

    // 月でフィルタ
    if (sortByMonth !== 'all') {
      filtered = filtered.filter(record => {
        const recordMonth = format(new Date(record.supportDate), 'yyyy-MM');
        return recordMonth === sortByMonth;
      });
    }

    // ユーザーでフィルタ
    if (sortByUser !== 'all') {
      filtered = filtered.filter(record => record.userId === sortByUser);
    }

    // 日付順でソート（新しい順）
    filtered.sort((a, b) => {
      return new Date(b.supportDate).getTime() - new Date(a.supportDate).getTime();
    });

    return filtered;
  }, [records, sortByMonth, sortByUser]);

  // 利用可能な月の一覧
  const availableMonths = React.useMemo(() => {
    const months = new Set<string>();
    records.forEach(record => {
      const month = format(new Date(record.supportDate), 'yyyy-MM');
      months.add(month);
    });
    return Array.from(months).sort().reverse();
  }, [records]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/support-records/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-records'] });
    },
  });

  const handleCreate = () => {
    setSelectedRecord(null);
    setIsModalOpen(true);
  };

  const handleEdit = (record: SupportRecord) => {
    setSelectedRecord(record);
    setIsModalOpen(true);
  };

  const handleDelete = async (record: SupportRecord) => {
    if (!confirm('この支援記録を削除しますか？')) return;
    deleteMutation.mutate(record.id);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRecord(null);
  };

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['support-records'] });
    handleCloseModal();
  };

  if (isLoading || membersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl sm:text-3xl whitespace-nowrap font-bold text-gray-900 dark:text-gray-100">支援内容</h1>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          新規作成
        </Button>
      </div>

      {/* ソート・フィルタ */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              対応月で絞り込み
            </label>
            <select
              value={sortByMonth}
              onChange={(e) => setSortByMonth(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="all">全ての月</option>
              {availableMonths.map(month => (
                <option key={month} value={month}>
                  {format(new Date(`${month}-01`), 'yyyy年M月')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              対象者で絞り込み
            </label>
            <select
              value={sortByUser}
              onChange={(e) => setSortByUser(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="all">全ての対象者</option>
              {sortedMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              隊員を選ぶと、面談用に直近{memberTimeline?.range.days ?? 30}日間の出来事（スケジュール・イベント・週次報告など）を下に表示します。
            </p>
          </div>
        </div>
      </div>

      {sortByUser !== 'all' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 overflow-hidden">
          <div className="border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-2 bg-gray-50 dark:bg-gray-800/80">
            <CalendarClock className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                {memberTimeline?.user.name ?? '…'}さんの直近の出来事
              </h2>
              {memberTimeline && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {format(new Date(memberTimeline.range.from), 'yyyy年M月d日')}
                  〜
                  {format(new Date(memberTimeline.range.to), 'yyyy年M月d日')}
                  （{memberTimeline.range.days}日間）
                </p>
              )}
            </div>
          </div>
          <div className="p-4">
            {timelineLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : !memberTimeline || memberTimeline.items.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
                この期間に表示できる出来事はまだありません。
              </p>
            ) : (
              <ol className="space-y-3 max-h-[min(28rem,55vh)] overflow-y-auto pr-1">
                {memberTimeline.items.map((item, idx) => (
                  <li
                    key={`${item.kind}-${item.occurredAt}-${idx}`}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50/80 dark:bg-gray-900/40"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 tabular-nums">
                        {format(new Date(item.occurredAt), 'M/d（EEE）', { locale: ja })}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200">
                        {TIMELINE_KIND_LABELS[item.kind] ?? item.kind}
                      </span>
                      {item.link && (
                        <Link
                          to={item.link}
                          className="ml-auto inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          開く
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                    <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{item.title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 whitespace-pre-wrap break-words">
                      {item.detail}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {filteredRecords.map((record) => (
          <div
            key={record.id}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start mb-3 gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0"
                    style={{ backgroundColor: record.user.avatarColor || '#6B7280' }}
                  >
                    {(record.user.avatarLetter || record.user.name || '').charAt(0)}
                  </div>
                  <h3 className="font-semibold text-base text-gray-900 dark:text-gray-100 truncate">{record.user.name}</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {format(new Date(record.supportDate), 'yyyy年M月d日')}
                </p>
                {record.monthlyReport && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    月次報告: {record.monthlyReport.month}
                  </p>
                )}
              </div>
              {/* PC: 横並び / スマホ: 縦並び */}
              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2 flex-shrink-0">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleEdit(record)}
                  title="編集"
                >
                  <Edit2 className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">編集</span>
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(record)}
                  title="削除"
                >
                  <Trash2 className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">削除</span>
                </Button>
              </div>
            </div>

            <div className="space-y-2 mb-3">
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">支援内容:</span>
                <div 
                  className="text-gray-900 dark:text-gray-100 mt-1 prose max-w-none dark:prose-invert text-sm"
                  dangerouslySetInnerHTML={{ __html: record.supportContent }}
                />
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">支援者:</span>
                <p className="text-gray-900 dark:text-gray-100 mt-0.5 text-sm">{record.supportBy}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredRecords.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {records.length === 0 ? '支援記録がありません' : '該当する支援記録がありません'}
        </div>
      )}

      {isModalOpen && (
        <SupportRecordModal
          record={selectedRecord}
          onClose={handleCloseModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

