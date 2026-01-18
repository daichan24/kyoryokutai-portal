import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Plus, Edit2, Trash2, FileDown } from 'lucide-react';
import { format } from 'date-fns';
import { SupportRecordModal } from '../components/support/SupportRecordModal';

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
  };
  monthlyReportId?: string;
  monthlyReport?: {
    id: string;
    month: string;
  };
  createdAt: string;
  updatedAt: string;
}

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

  // 利用可能なユーザーの一覧
  const availableUsers = React.useMemo(() => {
    const usersMap = new Map<string, { id: string; name: string }>();
    records.forEach(record => {
      if (!usersMap.has(record.userId)) {
        usersMap.set(record.userId, { id: record.userId, name: record.user.name });
      }
    });
    return Array.from(usersMap.values());
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">支援内容</h1>
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
              {availableUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredRecords.map((record) => (
          <div
            key={record.id}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                    style={{
                      backgroundColor: record.user.avatarColor || '#6B7280',
                    }}
                  >
                    {(record.user.avatarLetter || record.user.name || '').charAt(0)}
                  </div>
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{record.user.name}</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {format(new Date(record.supportDate), 'yyyy年M月d日')}
                </p>
                {record.monthlyReport && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    月次報告: {record.monthlyReport.month}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleEdit(record)}
                  title="編集"
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  編集
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(record)}
                  title="削除"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  削除
                </Button>
              </div>
            </div>

            <div className="space-y-2 mb-3">
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">支援内容:</span>
                <div 
                  className="text-gray-900 dark:text-gray-100 mt-1 prose max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: record.supportContent }}
                />
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">支援者:</span>
                <p className="text-gray-900 dark:text-gray-100 mt-1">{record.supportBy}</p>
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

