import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Button } from '../common/Button';
import { Link } from 'react-router-dom';
import { Wish } from '../../types';
import { RefreshCw, CheckCircle2, Calendar, Tag } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface NextWishWidgetProps {
  showAddButton?: boolean;
  onAddClick?: () => void;
}

export const NextWishWidget: React.FC<NextWishWidgetProps> = ({
  showAddButton = false,
  onAddClick,
}) => {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data: nextWish, isLoading, refetch } = useQuery<Wish>({
    queryKey: ['wishes', 'next'],
    queryFn: async () => {
      const response = await api.get('/api/wishes/next');
      return response.data;
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.post(`/api/wishes/${id}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishes'] });
      queryClient.invalidateQueries({ queryKey: ['wishes', 'next'] });
      queryClient.invalidateQueries({ queryKey: ['wishes', 'stats'] });
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleComplete = async () => {
    if (!nextWish) return;
    if (confirm('このやりたいことを完了にしますか？')) {
      completeMutation.mutate(nextWish.id);
    }
  };

  const getDifficultyLabel = (difficulty?: string) => {
    switch (difficulty) {
      case 'EASY':
        return '簡単';
      case 'MEDIUM':
        return '普通';
      case 'HARD':
        return '難しい';
      default:
        return '-';
    }
  };

  const getEstimateLabel = (estimate?: string) => {
    switch (estimate) {
      case 'S':
        return '短';
      case 'M':
        return '中';
      case 'L':
        return '長';
      default:
        return '-';
    }
  };

  const getMonthLabel = (month?: number) => {
    if (!month) return null;
    return `${month}月`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">次にやる1つ</h3>
        <div className="flex gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 p-1"
            title="入れ替える"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          {showAddButton && onAddClick && (
            <Button onClick={onAddClick} size="sm" variant="outline">
              追加
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <LoadingSpinner />
        </div>
      ) : nextWish ? (
        <div className="space-y-3">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
              {nextWish.title}
            </h4>
            {nextWish.category && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                カテゴリ: {nextWish.category}
              </p>
            )}
            <div className="flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-400 mb-2">
              {nextWish.difficulty && (
                <span>難易度: {getDifficultyLabel(nextWish.difficulty)}</span>
              )}
              {nextWish.estimate && (
                <span>所要感: {getEstimateLabel(nextWish.estimate)}</span>
              )}
              {nextWish.dueMonth && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {getMonthLabel(nextWish.dueMonth)}
                </span>
              )}
            </div>
            {nextWish.tags && nextWish.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2">
                {nextWish.tags.slice(0, 3).map((tag, index) => (
                  <span
                    key={index}
                    className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full flex items-center gap-1"
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                  </span>
                ))}
              </div>
            )}
            {nextWish.memo && (
              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                {nextWish.memo}
              </p>
            )}
          </div>
          <div className="flex gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <Button
              onClick={handleComplete}
              size="sm"
              variant="primary"
              className="flex-1"
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              完了にする
            </Button>
            <Link
              to="/wishes"
              className="px-3 py-1.5 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              一覧を見る
            </Link>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <p className="text-sm mb-2">次にやるやりたいことがありません</p>
          {showAddButton && onAddClick ? (
            <Button onClick={onAddClick} size="sm" variant="outline">
              追加する
            </Button>
          ) : (
            <Link
              to="/wishes"
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              やりたいことを追加
            </Link>
          )}
        </div>
      )}
    </div>
  );
};

