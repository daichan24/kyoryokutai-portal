import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { format } from 'date-fns';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { Plus, Edit, Trash2, ExternalLink } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { WeeklyStatusAlert } from '../components/sns/WeeklyStatusAlert';
import { SNSPostDetailModal } from '../components/sns/SNSPostDetailModal';

interface SNSPost {
  id: string;
  week: string;
  postedAt: string;
  postType: 'STORY' | 'FEED';
  url?: string | null;
  theme?: string | null;
  followerDelta?: number | null;
  views?: number | null;
  likes?: number | null;
  note?: string | null;
  userId: string;
  user?: { id: string; name: string };
}

export const SNSPosts: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<SNSPost | null>(null);

  const { data: posts, isLoading } = useQuery<SNSPost[]>({
    queryKey: ['sns-posts', user?.id],
    queryFn: async () => {
      const url = user?.role === 'MEMBER' 
        ? `/api/sns-posts?userId=${user.id}`
        : '/api/sns-posts';
      const response = await api.get(url);
      return response.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => {
      return api.delete(`/api/sns-posts/${postId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sns-posts'] });
      queryClient.invalidateQueries({ queryKey: ['sns-weekly-status'] });
    },
  });

  const handleDelete = async (postId: string) => {
    if (!confirm('この投稿履歴を削除しますか？')) return;
    deleteMutation.mutate(postId);
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
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">SNS投稿管理</h1>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          投稿を追加
        </Button>
      </div>

      {/* 週次アラート */}
      <WeeklyStatusAlert />

      {/* 投稿履歴 */}
      <div className="space-y-4">
        <h2 className="font-semibold text-lg text-gray-900 dark:text-gray-100">投稿履歴</h2>
        
        {posts && posts.length > 0 ? (
          <div className="space-y-3">
            {posts
              .filter((p) => p.postedAt)
              .sort((a, b) => {
                const dateA = new Date(a.postedAt).getTime();
                const dateB = new Date(b.postedAt).getTime();
                return dateB - dateA; // 新しい順
              })
              .map((post) => (
                <div
                  key={post.id}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {format(new Date(post.postedAt), 'yyyy年M月d日 HH:mm')}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            post.postType === 'STORY'
                              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                          }`}
                        >
                          {post.postType === 'STORY' ? 'ストーリーズ' : 'フィード'}
                        </span>
                        {post.user && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">({post.user.name})</span>
                        )}
                      </div>

                      {post.theme && (
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">{post.theme}</p>
                      )}

                      {post.url && (
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 mb-2"
                        >
                          <ExternalLink className="w-3 h-3" />
                          投稿リンク
                        </a>
                      )}

                      {(post.followerDelta !== null ||
                        post.views !== null ||
                        post.likes !== null) && (
                        <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {post.followerDelta !== null && (
                            <span>フォロワー: {post.followerDelta > 0 ? '+' : ''}{post.followerDelta}</span>
                          )}
                          {post.views !== null && <span>閲覧数: {post.views.toLocaleString()}</span>}
                          {post.likes !== null && <span>いいね: {post.likes.toLocaleString()}</span>}
                        </div>
                      )}

                      {post.note && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{post.note}</p>
                      )}
                    </div>

                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => setEditingPost(post)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                        title="編集"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        title="削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            投稿履歴がありません
          </div>
        )}
      </div>

      {/* 追加モーダル */}
      {isAddModalOpen && (
        <SNSPostDetailModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSaved={() => {
            setIsAddModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['sns-posts'] });
            queryClient.invalidateQueries({ queryKey: ['sns-weekly-status'] });
          }}
        />
      )}

      {/* 編集モーダル */}
      {editingPost && (
        <SNSPostDetailModal
          isOpen={!!editingPost}
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSaved={() => {
            setEditingPost(null);
            queryClient.invalidateQueries({ queryKey: ['sns-posts'] });
            queryClient.invalidateQueries({ queryKey: ['sns-weekly-status'] });
          }}
        />
      )}
    </div>
  );
};
