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
  goalName?: string; // 後方互換性
  missionName?: string;
  goalType?: 'PRIMARY' | 'SUB'; // 後方互換性
  missionType?: 'PRIMARY' | 'SUB';
  progress: number;
  user: { id: string; name: string; avatarColor?: string };
}

type DisplayMode = 'view-only' | 'view-with-add' | 'add-only';

interface GoalsWidgetProps {
  displayMode?: DisplayMode;
  showAddButton?: boolean;
  onAddClick?: () => void;
  viewMode?: 'personal' | 'view'; // 個人 or 閲覧
}

export const GoalsWidget: React.FC<GoalsWidgetProps> = ({
  displayMode = 'view-only',
  showAddButton = false,
  onAddClick,
  viewMode = 'personal', // デフォルトは個人
}) => {
  const { user } = useAuthStore();
  const { data: goals, isLoading } = useQuery<Goal[]>({
    queryKey: ['goals-widget', viewMode, user?.id],
    queryFn: async () => {
      let url = '/api/missions';
      
      // 閲覧モード: 選択したユーザーのミッションを表示（MEMBERは自分のみ）
      if (viewMode === 'view') {
        if (user?.role === 'MEMBER') {
          url = `/api/missions?userId=${user.id}`;
        } else {
          // 非メンバーの場合は全員のミッションを表示
          url = '/api/missions';
        }
      } else {
        // 個人モード: 自分のミッションのみ表示
        url = `/api/missions?userId=${user?.id}`;
      }
      
      const response = await api.get(url);
      return (response.data || []).slice(0, 5); // 最新5件
    },
  });

  // 追加ボタンのみモード
  if (displayMode === 'add-only') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6 flex items-center justify-center min-h-[200px]">
        <Link to="/missions">
          <Button className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            ミッションを追加
          </Button>
        </Link>
      </div>
    );
  }

  // 表示のみ or 表示+追加ボタンモード
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          ミッション{viewMode === 'view' ? '（閲覧）' : '（個人）'}
        </h3>
        {(displayMode === 'view-with-add' || showAddButton) && (user?.role === 'MEMBER' || user?.role === 'MASTER') && (
          <Link to="/missions">
            <Button size="sm" className="flex items-center gap-1">
              <Plus className="w-4 h-4" />
              追加
            </Button>
          </Link>
        )}
      </div>

      {displayMode === 'view-only' || displayMode === 'view-with-add' ? (
        <>
          {isLoading ? (
            <LoadingSpinner />
          ) : !goals || goals.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">ミッションがありません</p>
          ) : (
            <div className="space-y-2">
              {goals.map((goal) => (
                <Link
                  key={goal.id}
                  to="/missions"
                  className="block p-2 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {goal.missionName || goal.goalName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{goal.user.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 dark:bg-blue-400 transition-all"
                          style={{ width: `${goal.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 dark:text-gray-400 font-medium w-10 text-right">
                        {goal.progress}%
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

