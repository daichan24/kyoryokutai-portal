import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import { format } from 'date-fns';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { TaskRequestModal } from '../components/taskRequest/TaskRequestModal';
import { Button } from '../components/common/Button';
import { UserFilter } from '../components/common/UserFilter';
import { Plus, HelpCircle, X } from 'lucide-react';

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
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'view' | 'create'>('view');
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const { data: requests, isLoading } = useQuery({
    queryKey: ['requests', user?.id, user?.role, selectedUserId],
    queryFn: async () => {
      let url = '/api/requests';
      if (user?.role === 'MEMBER') {
        url = `/api/requests?requestedTo=${user.id}`;
      } else if (selectedUserId) {
        // メンバー以外は選択したユーザーの依頼を表示
        url = `/api/requests?requestedTo=${selectedUserId}`;
      }
      const response = await api.get(url);
      return response.data as TaskRequest[];
    }
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: string; note?: string }) => {
      return api.post(`/api/requests/${id}/respond`, {
        approvalStatus: status,
        approvalNote: note
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
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

  const handleShowGuide = () => setIsGuideOpen(true);
  const handleCloseGuide = () => setIsGuideOpen(false);

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
      PENDING: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
      APPROVED: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
      REJECTED: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 dark:bg-gray-700';
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
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">依頼ボックス</h1>
          <button
            type="button"
            onClick={handleShowGuide}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="依頼ボックスの使い方"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
        <div className="flex gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('view')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'view'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              閲覧
            </button>
            <button
              onClick={() => setViewMode('create')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'create'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              作成
            </button>
          </div>
          {viewMode === 'create' && (
            <Button onClick={handleCreateRequest}>
              <Plus className="h-4 w-4 mr-2" />
              新規依頼
            </Button>
          )}
        </div>
      </div>

      {viewMode === 'view' && (
        <>
          {/* 受信した依頼 */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">受信した依頼</h2>
            <div className="space-y-3">
              {receivedRequests?.map((request) => (
              <div key={request.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{request.requestTitle}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(request.approvalStatus)}`}>
                    {getStatusLabel(request.approvalStatus)}
                  </span>
                </div>

                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{request.requestDescription}</p>

                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
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
                      className="flex-1 border border-gray-300 dark:border-gray-600 text-sm px-4 py-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    >
                      却下
                    </button>
                  </div>
                )}

                {request.approvalNote && (
                  <div className="mt-4 bg-gray-50 dark:bg-gray-700 rounded p-3 text-sm">
                    <span className="font-medium dark:text-gray-300">備考: </span>
                    <span className="dark:text-gray-300">{request.approvalNote}</span>
                  </div>
                )}
              </div>
            ))}

              {receivedRequests?.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  受信した依頼はありません
                </div>
              )}
            </div>
          </section>

          {/* 送信した依頼 */}
          <section>
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">送信した依頼</h2>
            <div className="space-y-3">
              {sentRequests?.map((request) => (
              <div key={request.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{request.requestTitle}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(request.approvalStatus)}`}>
                    {getStatusLabel(request.approvalStatus)}
                  </span>
                </div>

                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{request.requestDescription}</p>

                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <span>依頼先: {request.requestee.name}</span>
                  {request.deadline && (
                    <span>期限: {format(new Date(request.deadline), 'yyyy/MM/dd')}</span>
                  )}
                  {request.project && (
                    <span>プロジェクト: {request.project.projectName}</span>
                  )}
                </div>

                {request.approvalNote && (
                  <div className="mt-4 bg-gray-50 dark:bg-gray-700 rounded p-3 text-sm">
                    <span className="font-medium">備考: </span>
                    {request.approvalNote}
                  </div>
                )}
              </div>
            ))}

              {sentRequests?.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  送信した依頼はありません
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {viewMode === 'create' && (
        <div className="text-center py-12 text-gray-500">
          新規依頼を作成するには、右上の「新規依頼」ボタンをクリックしてください。
        </div>
      )}

      {/* 使い方モーダル */}
      {isGuideOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4"
          onClick={handleCloseGuide}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-xl w-full mt-16 border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">依頼ボックスの使い方</h2>
              <button onClick={handleCloseGuide} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-2 text-sm text-gray-700 dark:text-gray-200">
              <p>• 受信した依頼: 自分宛ての依頼が表示され、承認/却下を行えます。</p>
              <p>• 送信した依頼: 自分が送信した依頼の進捗と結果を確認できます。</p>
              <p>• 新規依頼: 右上の「新規依頼」から、誰から誰へでも依頼を作成できます。</p>
              <p>• 備考: 却下時は理由を入力して送信してください。</p>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <Button variant="outline" onClick={handleCloseGuide}>
                閉じる
              </Button>
            </div>
          </div>
        </div>
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