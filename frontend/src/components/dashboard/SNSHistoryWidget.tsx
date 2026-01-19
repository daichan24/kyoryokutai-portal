import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { useAuthStore } from '../../stores/authStore';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { Button } from '../common/Button';
import { Link, useNavigate } from 'react-router-dom';

interface SNSPost {
  id: string;
  week: string;
  postedAt?: string;
  postDate?: string | null; // 後方互換性
  postType?: 'STORY' | 'FEED' | 'BOTH' | null;
  isPosted?: boolean; // 後方互換性
  userId: string;
  user?: { id: string; name: string };
  theme?: string | null;
}

interface SNSHistoryWidgetProps {
  showAddButton?: boolean;
  onAddClick?: () => void;
}

export const SNSHistoryWidget: React.FC<SNSHistoryWidgetProps> = ({
  showAddButton = false,
  onAddClick,
}) => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const { data: posts, isLoading } = useQuery<SNSPost[]>({
    queryKey: ['sns-posts-widget', user?.id],
    queryFn: async () => {
      const url = user?.role === 'MEMBER' 
        ? `/api/sns-posts?userId=${user.id}`
        : '/api/sns-posts';
      const response = await api.get(url);
      return (response.data || []).slice(0, 5); // 最新5件
    },
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">SNS投稿履歴</h3>
        {showAddButton && (
          <Button
            size="sm"
            className="flex items-center gap-1"
            onClick={() => {
              if (onAddClick) {
                onAddClick();
              } else {
                navigate('/sns-posts?add=true');
              }
            }}
          >
            <Plus className="w-4 h-4" />
            追加
          </Button>
        )}
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : !posts || posts.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">投稿履歴がありません</p>
      ) : (
        <div className="space-y-2">
          {posts
            .filter((p) => p.postedAt || p.postDate)
            .map((post) => {
              const postDate = post.postedAt || post.postDate;
              return (
                <div
                  key={post.id}
                  className="flex items-center justify-between p-2 border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div className="flex-1">
                    {post.theme && (
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">{post.theme}</p>
                    )}
                    {postDate && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {format(new Date(postDate), 'M月d日')}
                      </p>
                    )}
                    {post.postType && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          post.postType === 'STORY'
                            ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200'
                            : post.postType === 'FEED'
                            ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                        }`}
                      >
                        {post.postType === 'STORY' ? 'ストーリー' : 
                         post.postType === 'FEED' ? 'フィード' : '両方'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};

