import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '../common/Button';
import { useAuthStore } from '../../stores/authStore';

interface Goal {
  id: string;
  goalName: string;
  goalType: 'PRIMARY' | 'SUB';
  progress: number;
  user: { id: string; name: string; avatarColor?: string };
}

interface GoalsWidgetProps {
  showAddButton?: boolean;
  onAddClick?: () => void;
}

export const GoalsWidget: React.FC<GoalsWidgetProps> = ({
  showAddButton = false,
  onAddClick,
}) => {
  const { user } = useAuthStore();
  const { data: goals, isLoading } = useQuery<Goal[]>({
    queryKey: ['goals-widget'],
    queryFn: async () => {
      const response = await api.get('/api/goals');
      return (response.data || []).slice(0, 5); // 最新5件
    },
  });

  return (
    <div className="bg-white rounded-lg shadow border border-border p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-900">目標</h3>
        {showAddButton && (user?.role === 'MEMBER' || user?.role === 'MASTER') && (
          <Link to="/goals">
            <Button size="sm" className="flex items-center gap-1">
              <Plus className="w-4 h-4" />
              追加
            </Button>
          </Link>
        )}
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : !goals || goals.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">目標がありません</p>
      ) : (
        <div className="space-y-2">
          {goals.map((goal) => (
            <Link
              key={goal.id}
              to="/goals"
              className="block p-2 border border-gray-200 rounded hover:bg-gray-50"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {goal.goalName}
                  </p>
                  <p className="text-xs text-gray-500">{goal.user.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 transition-all"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 font-medium w-10 text-right">
                    {goal.progress}%
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

