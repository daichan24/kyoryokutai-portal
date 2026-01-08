import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { format } from 'date-fns';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

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
  const queryClient = useQueryClient();

  const { data: posts, isLoading } = useQuery<SNSPost[]>({
    queryKey: ['sns-posts'],
    queryFn: async () => {
      const response = await api.get('/api/sns-posts');
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
      <h1 className="text-2xl font-bold text-gray-900">SNS投稿管理</h1>

      {/* 今週の投稿状況 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
        <h2 className="font-semibold mb-3 text-gray-900">今週の投稿</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">ストーリーズ</span>
              {thisWeekStory?.isPosted ? (
                <span className="text-green-600 text-xl">✓</span>
              ) : (
                <span className="text-red-600 text-xl">✗</span>
              )}
            </div>
            {thisWeekStory?.postDate && (
              <div className="text-xs text-gray-500">
                {format(new Date(thisWeekStory.postDate), 'M/d HH:mm')}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">フィード投稿</span>
              {thisWeekFeed?.isPosted ? (
                <span className="text-green-600 text-xl">✓</span>
              ) : (
                <span className="text-red-600 text-xl">✗</span>
              )}
            </div>
            {thisWeekFeed?.postDate && (
              <div className="text-xs text-gray-500">
                {format(new Date(thisWeekFeed.postDate), 'M/d HH:mm')}
              </div>
            )}
          </div>
        </div>

        {(!thisWeekStory?.isPosted || !thisWeekFeed?.isPosted) && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
            ⚠️ 今週の投稿が完了していません
          </div>
        )}
      </div>

      {/* 週ごとの履歴 */}
      <div className="space-y-4">
        <h2 className="font-semibold text-lg text-gray-900">投稿履歴</h2>
        
        {postsByWeek && Object.entries(postsByWeek)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([week, weekPosts]: [string, SNSPost[]]) => {
            const storyPost = weekPosts.find((p: SNSPost) => p.postType === 'STORY' || p.postType === 'BOTH');
            const feedPost = weekPosts.find((p: SNSPost) => p.postType === 'FEED' || p.postType === 'BOTH');

            return (
              <div key={week} className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium mb-3 text-gray-900">{week}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <span className="text-sm text-gray-700">ストーリーズ</span>
                    <input
                      type="checkbox"
                      checked={storyPost?.isPosted || false}
                      onChange={(e) => handlePostCheck(week, 'STORY', e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <span className="text-sm text-gray-700">フィード投稿</span>
                    <input
                      type="checkbox"
                      checked={feedPost?.isPosted || false}
                      onChange={(e) => handlePostCheck(week, 'FEED', e.target.checked)}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </label>
                </div>

                <div className="mt-3 pt-3 border-t flex gap-4 text-xs text-gray-500">
                  {storyPost?.postDate && (
                    <span>ストーリーズ: {format(new Date(storyPost.postDate), 'M/d HH:mm')}</span>
                  )}
                  {feedPost?.postDate && (
                    <span>フィード: {format(new Date(feedPost.postDate), 'M/d HH:mm')}</span>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
};