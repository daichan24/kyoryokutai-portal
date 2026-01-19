import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { format, startOfWeek, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { ja } from 'date-fns/locale';
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

interface MemberStatus {
  userId: string;
  userName: string;
  hasFeed: boolean;
  hasStory: boolean;
  feedPost?: SNSPost;
  storyPost?: SNSPost;
}

export const SNSPosts: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<SNSPost | null>(null);
  const [viewMode, setViewMode] = useState<'personal' | 'view'>(user?.role === 'MEMBER' ? 'personal' : 'view'); // 表示モード（メンバー以外はデフォルトで「閲覧」）
  const [selectedMonth, setSelectedMonth] = useState<string>(''); // 月のフィルタ（閲覧モード用）
  const [selectedUserId, setSelectedUserId] = useState<string>(''); // ユーザーのフィルタ（閲覧モード用）

  // 現在の週の境界を計算（月曜9:00 JST基準）
  const getCurrentWeekBoundary = () => {
    const now = new Date();
    const nowJST = new Date(now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }));
    
    const dayOfWeek = nowJST.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    
    const monday9amJST = new Date(nowJST);
    monday9amJST.setDate(nowJST.getDate() + mondayOffset);
    monday9amJST.setHours(9, 0, 0, 0);
    
    if (nowJST < monday9amJST) {
      monday9amJST.setDate(monday9amJST.getDate() - 7);
    }
    
    const nextMonday9amJST = new Date(monday9amJST);
    nextMonday9amJST.setDate(monday9amJST.getDate() + 7);
    
    return {
      weekStart: monday9amJST,
      weekEnd: nextMonday9amJST,
    };
  };

  const { weekStart, weekEnd } = getCurrentWeekBoundary();

  // メンバー一覧の取得（閲覧モード用）
  const { data: members = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['users', 'members'],
    queryFn: async () => {
      const response = await api.get('/api/users');
      return response.data.filter((u: any) => 
        u.role === 'MEMBER' && u.name !== '佐藤大地'
      ).sort((a: any, b: any) => {
        // displayOrderでソート（小さい順）、同じ場合は名前でソート
        const orderA = a.displayOrder || 0;
        const orderB = b.displayOrder || 0;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        return (a.name || '').localeCompare(b.name || '');
      });
    },
    enabled: user?.role !== 'MEMBER',
  });

  // 個人タブ用の投稿取得
  const { data: personalPosts, isLoading: isLoadingPersonal } = useQuery<SNSPost[]>({
    queryKey: ['sns-posts', 'personal', user?.id],
    queryFn: async () => {
      const url = `/api/sns-posts?userId=${user?.id}`;
      const response = await api.get(url);
      return response.data;
    },
    enabled: viewMode === 'personal',
  });

  // 閲覧タブ用の投稿取得（全員分）
  const { data: allPosts, isLoading: isLoadingView } = useQuery<SNSPost[]>({
    queryKey: ['sns-posts', 'view', selectedMonth, selectedUserId],
    queryFn: async () => {
      let url = '/api/sns-posts';
      const params = new URLSearchParams();
      
      if (selectedMonth) {
        const monthStart = startOfMonth(new Date(`${selectedMonth}-01`));
        const monthEnd = endOfMonth(new Date(`${selectedMonth}-01`));
        params.append('from', format(monthStart, 'yyyy-MM-dd'));
        params.append('to', format(monthEnd, 'yyyy-MM-dd'));
      }
      
      if (selectedUserId) {
        params.append('userId', selectedUserId);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await api.get(url);
      return response.data;
    },
    enabled: viewMode === 'view',
  });

  // 現在の週の投稿状況を計算（閲覧モード用）
  const currentWeekStatus = useMemo<MemberStatus[]>(() => {
    if (!members.length) return [];

    // すべてのメンバーを表示（投稿がない場合も含む）
    return members.map(member => {
      const memberPosts = (allPosts || []).filter(p => 
        p.userId === member.id && 
        p.postedAt &&
        new Date(p.postedAt) >= weekStart &&
        new Date(p.postedAt) < weekEnd
      );

      const feedPost = memberPosts.find(p => p.postType === 'FEED');
      const storyPost = memberPosts.find(p => p.postType === 'STORY');

      return {
        userId: member.id,
        userName: member.name,
        hasFeed: !!feedPost,
        hasStory: !!storyPost,
        feedPost,
        storyPost,
      };
    });
  }, [allPosts, members, weekStart, weekEnd]);

  // 過去の記録（閲覧モード用、月別・ユーザー別ソート）
  const historicalPosts = useMemo(() => {
    if (!allPosts) return [];
    
    return allPosts
      .filter(p => p.postedAt)
      .sort((a, b) => {
        const dateA = new Date(a.postedAt).getTime();
        const dateB = new Date(b.postedAt).getTime();
        return dateB - dateA; // 新しい順
      });
  }, [allPosts]);

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

  const isLoading = viewMode === 'personal' ? isLoadingPersonal : isLoadingView;
  const posts = viewMode === 'personal' ? personalPosts : historicalPosts;

  // 利用可能な月の一覧（年度単位、3ヶ月遡れるように）
  const availableMonths = useMemo(() => {
    if (!allPosts) return [];
    
    const months = new Set<string>();
    allPosts.forEach(post => {
      if (post.postedAt) {
        const month = format(new Date(post.postedAt), 'yyyy-MM');
        months.add(month);
      }
    });
    
    // 現在の年度を計算（4月〜翌年3月）
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const fiscalYearStart = currentMonth >= 4 ? currentYear : currentYear - 1;
    const fiscalYearEnd = fiscalYearStart + 1;
    
    // 現在の年度の月を追加（4月〜翌年3月）
    for (let month = 4; month <= 12; month++) {
      months.add(`${fiscalYearStart}-${String(month).padStart(2, '0')}`);
    }
    for (let month = 1; month <= 3; month++) {
      months.add(`${fiscalYearEnd}-${String(month).padStart(2, '0')}`);
    }
    
    // 前年度の最後の3ヶ月を追加（1月、2月、3月）
    const prevFiscalYearStart = fiscalYearStart - 1;
    for (let month = 1; month <= 3; month++) {
      months.add(`${prevFiscalYearStart + 1}-${String(month).padStart(2, '0')}`);
    }
    
    // 年度が変わっても3ヶ月は遡れるように（前年度の最後の3ヶ月）
    // 既に追加済み
    
    return Array.from(months).sort().reverse();
  }, [allPosts]);

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
        {viewMode === 'personal' && (
          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            投稿を追加
          </Button>
        )}
      </div>

      {/* タブ切り替え（メンバー以外のみ） */}
      {user?.role !== 'MEMBER' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-4">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('personal')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'personal'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              個人
            </button>
            <button
              onClick={() => setViewMode('view')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'view'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              閲覧
            </button>
          </div>
        </div>
      )}

      {/* 週次アラート（個人タブのみ） */}
      {viewMode === 'personal' && <WeeklyStatusAlert />}

      {viewMode === 'view' ? (
        <>
          {/* 閲覧モード: フィルタ */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  対象月で絞り込み
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">全ての月</option>
                  {availableMonths.map(month => (
                    <option key={month} value={month}>
                      {format(new Date(`${month}-01`), 'yyyy年M月', { locale: ja })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  メンバーで絞り込み
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">全てのメンバー</option>
                  {members.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 閲覧モード: 現在の週の投稿状況（テーブル形式） */}
          {!selectedMonth && !selectedUserId && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                現在の週の投稿状況
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                  ({format(weekStart, 'M月d日', { locale: ja })} 〜 {format(addDays(weekEnd, -1), 'M月d日', { locale: ja })})
                </span>
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-gray-100">メンバー</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-900 dark:text-gray-100">フィード</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-900 dark:text-gray-100">ストーリーズ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentWeekStatus.map((status) => (
                      <tr key={status.userId} className="border-b border-gray-200 dark:border-gray-700">
                        <td className="py-3 px-4 text-gray-900 dark:text-gray-100">{status.userName}</td>
                        <td className="py-3 px-4 text-center">
                          {status.hasFeed ? (
                            <span className="text-green-600 dark:text-green-400 font-medium">✓ 投稿済み</span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400 font-medium">未投稿</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {status.hasStory ? (
                            <span className="text-green-600 dark:text-green-400 font-medium">✓ 投稿済み</span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400 font-medium">未投稿</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 閲覧モード: 過去の記録 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {selectedMonth || selectedUserId ? '投稿履歴' : '過去の記録'}
            </h2>
            {historicalPosts && historicalPosts.length > 0 ? (
              <div className="space-y-3">
                {historicalPosts.map((post) => (
                  <div
                    key={post.id}
                    className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
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
        </>
      ) : (
        <>
          {/* 個人タブ: 投稿履歴 */}
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
        </>
      )}

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
