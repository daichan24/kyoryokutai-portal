import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { useAuthStore } from '../../stores/authStore';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { Button } from '../common/Button';
import { Link } from 'react-router-dom';

interface TaskRequest {
  id: string;
  requestTitle: string;
  requestDescription: string;
  deadline?: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  requester: { id: string; name: string; avatarColor?: string };
  project?: { id: string; projectName: string };
  createdAt: string;
}

interface TaskRequestsWidgetProps {
  showAddButton?: boolean;
  onAddClick?: () => void;
}

export const TaskRequestsWidget: React.FC<TaskRequestsWidgetProps> = ({
  showAddButton = false,
  onAddClick,
}) => {
  const { user } = useAuthStore();

  const { data: requests, isLoading } = useQuery<TaskRequest[]>({
    queryKey: ['requests-widget', user?.id],
    queryFn: async () => {
      const url = user?.role === 'MEMBER' 
        ? `/api/requests?requestedTo=${user.id}`
        : '/api/requests';
      const response = await api.get(url);
      const allRequests = response.data || [];
      // 未処理（PENDING）のみ表示
      return allRequests.filter((r: TaskRequest) => r.approvalStatus === 'PENDING').slice(0, 5);
    },
  });

  const widgetTitle = user?.role === 'MEMBER' ? '依頼ボックス' : '依頼';

  return (
    <div className="bg-white rounded-lg shadow border border-border p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-900">{widgetTitle}</h3>
        {showAddButton && onAddClick && (
          <Button size="sm" onClick={onAddClick} className="flex items-center gap-1">
            <Plus className="w-4 h-4" />
            追加
          </Button>
        )}
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : !requests || requests.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">
          {user?.role === 'MEMBER' ? '未処理のタスクがありません' : '未処理の依頼がありません'}
        </p>
      ) : (
        <div className="space-y-2">
          {requests.map((request) => (
            <Link
              key={request.id}
              to="/task-requests"
              className="block p-2 border border-gray-200 rounded hover:bg-gray-50"
            >
              <div className="flex items-start gap-2">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                  style={{ backgroundColor: request.requester.avatarColor || '#6B7280' }}
                >
                  {request.requester.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {request.requestTitle}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {request.requester.name}さんから
                  </p>
                  {request.deadline && (
                    <p className="text-xs text-gray-400 mt-1">
                      期限: {format(new Date(request.deadline), 'M月d日')}
                    </p>
                  )}
                </div>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded flex-shrink-0">
                  未処理
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

