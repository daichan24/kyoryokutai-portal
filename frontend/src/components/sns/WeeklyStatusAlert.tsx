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

  const { data: status, isLoading, error } = useQuery<WeeklyStatus>({
    queryKey: ['sns-weekly-status', user?.id],
    queryFn: async () => {
      const response = await api.get('/api/sns-posts/weekly-status');
      return response.data;
    },
    refetchInterval: 60000, // 1分ごとに更新
    retry: 1,
  });

  // エラー時も表示（暫定で未完扱い）
  const hasStory = status?.hasStory ?? false;
  const hasFeed = status?.hasFeed ?? false;
  const hasError = !!error;

  // 4パターンのメッセージを判定
  let message = '';
  let variant: 'success' | 'warning' | 'error' = 'success';

  if (hasError) {
    message = '週次ステータスの取得に失敗しました（暫定: 未完了扱い）';
    variant = 'error';
  } else if (!hasStory && !hasFeed) {
    message = '今週のストーリーズとフィード投稿が完了していません';
    variant = 'error';
  } else if (!hasStory) {
    message = '今週のストーリーズが完了していません';
    variant = 'warning';
  } else if (!hasFeed) {
    message = '今週のフィード投稿が完了していません';
    variant = 'warning';
  } else {
    message = '今週の投稿は完了しています';
    variant = 'success';
  }

  const bgColor =
    variant === 'success'
      ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
      : variant === 'warning'
      ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200'
      : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200';

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

