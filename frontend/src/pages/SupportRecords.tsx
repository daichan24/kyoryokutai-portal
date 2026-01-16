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

  const { data: records = [], isLoading } = useQuery<SupportRecord[]>({
    queryKey: ['support-records'],
    queryFn: async () => {
      const response = await api.get('/api/support-records');
      return response.data;
    },
  });

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
        <h1 className="text-3xl font-bold text-gray-900">支援内容</h1>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          新規作成
        </Button>
      </div>

      <div className="space-y-4">
        {records.map((record) => (
          <div
            key={record.id}
            className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
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
                    {record.user.name.charAt(0)}
                  </div>
                  <h3 className="font-semibold text-lg text-gray-900">{record.user.name}</h3>
                </div>
                <p className="text-sm text-gray-600">
                  {format(new Date(record.supportDate), 'yyyy年M月d日')}
                </p>
                {record.monthlyReport && (
                  <p className="text-xs text-gray-500 mt-1">
                    月次報告: {record.monthlyReport.month}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleEdit(record)}
                  className="p-2 text-gray-500 hover:text-blue-600 transition-colors"
                  title="編集"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(record)}
                  className="p-2 text-gray-500 hover:text-red-600 transition-colors"
                  title="削除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2 mb-3">
              <div>
                <span className="text-sm font-medium text-gray-700">支援内容:</span>
                <p className="text-gray-900 mt-1 whitespace-pre-wrap">{record.supportContent}</p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">支援者:</span>
                <p className="text-gray-900 mt-1">{record.supportBy}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {records.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          支援記録がありません
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

