import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import { format } from 'date-fns';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { TaskRequestModal } from '../components/taskRequest/TaskRequestModal';
import { Button } from '../components/common/Button';
import { Plus } from 'lucide-react';

interface TaskRequest {
  id: string;
  requestTitle: string;
  requestDescription: string;
  deadline?: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvalNote?: string;
  requester: { id: string; name: string };
  requestee: { id: string; name: string };
  project?: { id: string; projectName: string };
  createdAt: string;
}

export const TaskRequests: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: requests, isLoading } = useQuery({
    queryKey: ['task-requests', user?.id, user?.role],
    queryFn: async () => {
      // MEMBERの場合は自分宛の依頼のみ、他は全員の依頼
      const url = user?.role === 'MEMBER' 
        ? `/api/task-requests?requestedTo=${user.id}`
        : '/api/task-requests';
      const response = await api.get(url);
      return response.data as TaskRequest[];
    }
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: string; note?: string }) => {
      return api.post(`/api/task-requests/${id}/respond`, {
        approvalStatus: status,
        approvalNote: note
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-requests'] });
    }
  });

  const handleRespond = (id: string, status: 'APPROVED' | 'REJECTED') => {
    const note = prompt(status === 'REJECTED' ? '差し戻しの理由を入力してください' : '備考（任意）');
    if (status === 'REJECTED' && !note) return;
    
    respondMutation.mutate({ id, status, note: note || undefined });
  };

  const handleCreateRequest = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['task-requests'] });
    handleCloseModal();
  };

  const receivedRequests = requests?.filter(r => r.requestee.id === user?.id);
  const sentRequests = requests?.filter(r => r.requester.id === user?.id);

  const getStatusLabel = (status: string) => {
    const labels = {
      PENDING: '保留中',
      APPROVED: '承認済',
      REJECTED: '却下'
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100';
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
      {/* ヘッダー */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">
          {user?.role === 'MEMBER' ? 'タスクボックス' : 'タスク依頼'}
        </h1>
        {(user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT' || user?.role === 'MASTER') && (
          <Button onClick={handleCreateRequest}>
            <Plus className="h-4 w-4 mr-2" />
            新規依頼
          </Button>
        )}
      </div>

      {/* 受信したタスク（協力隊員） */}
      {user?.role === 'MEMBER' && (
        <section>
          <h2 className="text-xl font-semibold mb-4 text-gray-900">受信したタスク</h2>
          <div className="space-y-3">
            {receivedRequests?.map((request) => (
              <div key={request.id} className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-lg text-gray-900">{request.requestTitle}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(request.approvalStatus)}`}>
                    {getStatusLabel(request.approvalStatus)}
                  </span>
                </div>

                <p className="text-gray-600 text-sm mb-4">{request.requestDescription}</p>

                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                  <span>依頼元: {request.requester.name}さん</span>
                  {request.deadline && (
                    <span>期限: {format(new Date(request.deadline), 'yyyy/MM/dd')}</span>
                  )}
                  {request.project && (
                    <span>プロジェクト: {request.project.projectName}</span>
                  )}
                </div>

                {request.approvalStatus === 'PENDING' && (
                  <div className="flex gap-2 pt-4 border-t">
                    <button
                      onClick={() => handleRespond(request.id, 'APPROVED')}
                      className="flex-1 bg-green-500 text-white text-sm px-4 py-2 rounded hover:bg-green-600 transition-colors"
                    >
                      承認
                    </button>
                    <button
                      onClick={() => handleRespond(request.id, 'REJECTED')}
                      className="flex-1 border border-gray-300 text-sm px-4 py-2 rounded hover:bg-gray-50 transition-colors"
                    >
                      却下
                    </button>
                  </div>
                )}

                {request.approvalNote && (
                  <div className="mt-4 bg-gray-50 rounded p-3 text-sm">
                    <span className="font-medium">備考: </span>
                    {request.approvalNote}
                  </div>
                )}
              </div>
            ))}

            {receivedRequests?.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                受信したタスクはありません
              </div>
            )}
          </div>
        </section>
      )}

      {/* 送信した依頼（サポート・役場） */}
      {(user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT' || user?.role === 'MASTER') && (
        <section>
          <h2 className="text-xl font-semibold mb-4 text-gray-900">送信した依頼</h2>
          <div className="space-y-3">
            {sentRequests?.map((request) => (
              <div key={request.id} className="bg-white border border-gray-200 rounded-lg p-5">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-lg text-gray-900">{request.requestTitle}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(request.approvalStatus)}`}>
                    {getStatusLabel(request.approvalStatus)}
                  </span>
                </div>

                <p className="text-gray-600 text-sm mb-4">{request.requestDescription}</p>

                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span>依頼先: {request.requestee.name}</span>
                  {request.deadline && (
                    <span>期限: {format(new Date(request.deadline), 'yyyy/MM/dd')}</span>
                  )}
                  {request.project && (
                    <span>プロジェクト: {request.project.projectName}</span>
                  )}
                </div>

                {request.approvalNote && (
                  <div className="mt-4 bg-gray-50 rounded p-3 text-sm">
                    <span className="font-medium">備考: </span>
                    {request.approvalNote}
                  </div>
                )}
              </div>
            ))}

            {sentRequests?.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                送信した依頼はありません
              </div>
            )}
          </div>
        </section>
      )}

      {isModalOpen && (
        <TaskRequestModal
          onClose={handleCloseModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};