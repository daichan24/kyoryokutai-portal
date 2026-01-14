import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { format } from 'date-fns';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { Plus } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

interface SNSPost {
  id: string;
  week: string;
  postDate?: string | null;
  postType?: 'STORY' | 'FEED' | 'BOTH' | null;
  isPosted: boolean;
  userId: string;
  user?: { id: string; name: string };
}

export const SNSPosts: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [postDate, setPostDate] = useState('');
  const [postType, setPostType] = useState<'STORY' | 'FEED' | ''>('');

  const { data: posts, isLoading } = useQuery<SNSPost[]>({
    queryKey: ['sns-posts', user?.id],
    queryFn: async () => {
      // MEMBERの場合は自分の投稿のみ、他は全員の投稿
      const url = user?.role === 'MEMBER' 
        ? `/api/sns-posts?userId=${user.id}`
        : '/api/sns-posts';
      const response = await api.get(url);
      return response.data;
    }
  });

  const updatePostMutation = useMutation({
    mutationFn: async ({ week, data }: { week: string; data: Partial<SNSPost> }) => {
      return api.post('/api/sns-posts', {
        week,
        ...data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sns-posts'] });
    }
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      return api.delete(`/api/sns-posts/${postId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sns-posts'] });
    }
  });

  const handlePostCheck = (week: string, postType: 'STORY' | 'FEED', checked: boolean) => {
    updatePostMutation.mutate({
      week,
      data: {
        isPosted: checked,
        postDate: checked ? new Date().toISOString() : undefined,
        postType: checked ? postType : undefined
      }
    });
  };

  const handleCreatePost = () => {
    if (!postDate || !postType) {
      alert('投稿日と投稿種別を選択してください');
      return;
    }
    
    // 日付から週を計算（YYYY-WW形式）
    const date = new Date(postDate);
    const year = date.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    const weekStr = `${year}-W${week.toString().padStart(2, '0')}`;
    
    updatePostMutation.mutate({
      week: weekStr,
      data: {
        postDate: postDate,
        postType: postType as 'STORY' | 'FEED',
        isPosted: true
      }
    });
    setPostDate('');
    setPostType('');
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('この投稿履歴を削除しますか？')) return;
    deletePostMutation.mutate(postId);
  };

  // 現在の週（YYYY-WW形式、ISO週番号）
  const getCurrentWeek = () => {
    const now = new Date();
    const year = now.getFullYear();
    // ISO週番号を計算
    const startOfYear = new Date(year, 0, 1);
    const days = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
    const week = Math.ceil((days + startOfYear.getDay() + 1) / 7);
    return `${year}-W${week.toString().padStart(2, '0')}`;
  };
  
  const currentWeek = getCurrentWeek();
  
  // 週ごとにグループ化（ユーザーごと）
  const postsByWeek = posts?.reduce((acc: Record<string, SNSPost[]>, post: SNSPost) => {
    if (!acc[post.week]) {
      acc[post.week] = [];
    }
    acc[post.week].push(post);
    return acc;
  }, {});

  // 今週の投稿状況（現在のユーザーのみ）
  const thisWeekPosts = posts?.filter((p: SNSPost) => p.week === currentWeek) || [];
  const thisWeekStory = thisWeekPosts.find((p: SNSPost) => p.postType === 'STORY' || p.postType === 'BOTH');
  const thisWeekFeed = thisWeekPosts.find((p: SNSPost) => p.postType === 'FEED' || p.postType === 'BOTH');

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
        <h1 className="text-2xl font-bold text-gray-900">SNS投稿管理</h1>
        <div className="flex gap-2">
          <input
            type="date"
            value={postDate}
            onChange={(e) => setPostDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <select
            value={postType}
            onChange={(e) => setPostType(e.target.value as typeof postType)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">投稿種別を選択</option>
            <option value="STORY">ストーリーズ</option>
            <option value="FEED">フィード</option>
          </select>
          <Button onClick={handleCreatePost} disabled={!postDate || !postType}>
            <Plus className="h-4 w-4 mr-2" />
            追加
          </Button>
        </div>
      </div>

      {/* 今週の投稿状況 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
        <h2 className="font-semibold mb-3 text-gray-900">今週の投稿 ({currentWeek})</h2>
        <div className="grid grid-cols-2 gap-4">
          <label className="bg-white rounded-lg p-4 border border-gray-200 cursor-pointer hover:bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">ストーリーズ</span>
              <input
                type="checkbox"
                checked={thisWeekStory?.isPosted || false}
                onChange={(e) => handlePostCheck(currentWeek, 'STORY', e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {thisWeekStory?.postDate && (
              <div className="text-xs text-gray-500">
                {format(new Date(thisWeekStory.postDate), 'M/d HH:mm')}
              </div>
            )}
          </label>

          <label className="bg-white rounded-lg p-4 border border-gray-200 cursor-pointer hover:bg-gray-50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">フィード投稿</span>
              <input
                type="checkbox"
                checked={thisWeekFeed?.isPosted || false}
                onChange={(e) => handlePostCheck(currentWeek, 'FEED', e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {thisWeekFeed?.postDate && (
              <div className="text-xs text-gray-500">
                {format(new Date(thisWeekFeed.postDate), 'M/d HH:mm')}
              </div>
            )}
          </label>
        </div>

        {(!thisWeekStory?.isPosted || !thisWeekFeed?.isPosted) && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
            ⚠️ 今週の投稿が完了していません
          </div>
        )}
      </div>

      {/* 投稿履歴（日付順） */}
      <div className="space-y-4">
        <h2 className="font-semibold text-lg text-gray-900">投稿履歴</h2>
        
        {posts && posts.length > 0 ? (
          <div className="space-y-3">
            {posts
              .filter((p: SNSPost) => p.postDate)
              .sort((a: SNSPost, b: SNSPost) => {
                const dateA = a.postDate ? new Date(a.postDate).getTime() : 0;
                const dateB = b.postDate ? new Date(b.postDate).getTime() : 0;
                return dateB - dateA; // 新しい順
              })
              .map((post: SNSPost) => (
                <div key={post.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-900">
                        {post.postDate ? format(new Date(post.postDate), 'yyyy年M月d日') : '日付不明'}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        post.postType === 'STORY' ? 'bg-purple-100 text-purple-800' :
                        post.postType === 'FEED' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {post.postType === 'STORY' ? 'ストーリーズ' :
                         post.postType === 'FEED' ? 'フィード' :
                         post.postType === 'BOTH' ? '両方' : '不明'}
                      </span>
                      {post.user && (
                        <span className="text-xs text-gray-500">({post.user.name})</span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeletePost(post.id)}
                    className="text-red-600 hover:text-red-800 text-sm px-3 py-1 border border-red-300 rounded hover:bg-red-50"
                  >
                    削除
                  </button>
                </div>
              ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            投稿履歴がありません
          </div>
        )}
      </div>
    </div>
  );
};