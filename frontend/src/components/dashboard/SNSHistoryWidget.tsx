import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { useAuthStore } from '../../stores/authStore';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { format } from 'date-fns';
import { Plus } from 'lucide-react';
import { Button } from '../common/Button';
import { Link } from 'react-router-dom';

interface SNSPost {
  id: string;
  week: string;
  postDate?: string | null;
  postType?: 'STORY' | 'FEED' | 'BOTH' | null;
  isPosted: boolean;
  userId: string;
  user?: { id: string; name: string };
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
    <div className="bg-white rounded-lg shadow border border-border p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-900">SNS投稿履歴</h3>
        {showAddButton && (
          <Link to="/sns-posts">
            <Button size="sm" className="flex items-center gap-1">
              <Plus className="w-4 h-4" />
              追加
            </Button>
          </Link>
        )}
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : !posts || posts.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">投稿履歴がありません</p>
      ) : (
        <div className="space-y-2">
          {posts.map((post) => (
            <div
              key={post.id}
              className="flex items-center justify-between p-2 border border-gray-200 rounded hover:bg-gray-50"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{post.week}</p>
                {post.postDate && (
                  <p className="text-xs text-gray-500">
                    {format(new Date(post.postDate), 'M月d日')}
                  </p>
                )}
                {post.postType && (
                  <span className="text-xs text-gray-500">
                    {post.postType === 'STORY' ? 'ストーリー' : 
                     post.postType === 'FEED' ? 'フィード' : '両方'}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {post.isPosted ? (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                    投稿済
                  </span>
                ) : (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    未投稿
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

