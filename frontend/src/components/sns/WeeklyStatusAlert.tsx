import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { useAuthStore } from '../../stores/authStore';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface WeeklyStatus {
  weekStart: string;
  weekEnd: string;
  hasStory: boolean;
  hasFeed: boolean;
}

export const WeeklyStatusAlert: React.FC = () => {
  const { user } = useAuthStore();

  const { data: status, isLoading } = useQuery<WeeklyStatus>({
    queryKey: ['sns-weekly-status', user?.id],
    queryFn: async () => {
      const response = await api.get('/api/sns-posts/weekly-status');
      return response.data;
    },
    refetchInterval: 60000, // 1分ごとに更新
  });

  if (isLoading || !status) {
    return null;
  }

  // 4パターンのメッセージを判定
  let message = '';
  let variant: 'success' | 'warning' | 'error' = 'success';

  if (!status.hasStory && !status.hasFeed) {
    message = '今週のストーリーズとフィード投稿が完了していません';
    variant = 'error';
  } else if (!status.hasStory) {
    message = '今週のストーリーズが完了していません';
    variant = 'warning';
  } else if (!status.hasFeed) {
    message = '今週のフィード投稿が完了していません';
    variant = 'warning';
  } else {
    message = '今週の投稿は完了しています';
    variant = 'success';
  }

  const bgColor =
    variant === 'success'
      ? 'bg-green-50 border-green-200 text-green-800'
      : variant === 'warning'
      ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
      : 'bg-red-50 border-red-200 text-red-800';

  return (
    <div className={`${bgColor} border rounded-lg p-4 mb-6 flex items-center gap-3`}>
      {variant === 'success' ? (
        <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
      ) : (
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
      )}
      <p className="font-medium">{message}</p>
    </div>
  );
};

