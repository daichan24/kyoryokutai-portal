import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { Wish, WishStatus } from '../types';
import { Plus, Search, Filter, CheckCircle2, Pause, Circle, Calendar, Tag, Edit2, Trash2, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { WishModal } from '../components/wish/WishModal';
import { WishDetailModal } from '../components/wish/WishDetailModal';

const CATEGORY_SUGGESTIONS = [
  '体験（旅・イベント）',
  '学び（資格・読書・スキル）',
  '健康（運動・食・睡眠）',
  '仕事（収益・制作・発信）',
  '人間関係（家族・友人・地域）',
  'お金（貯蓄・投資・買い物）',
  '生活（家・整理・ルーティン）',
  '創作（動画・文章・作品）',
  '地域貢献（協力隊活動・企画）',
  'その他',
];

export const Wishes: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<'personal' | 'view'>(
    user?.role === 'MEMBER' ? 'personal' : 'view'
  );
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<WishStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('default');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedWish, setSelectedWish] = useState<Wish | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailWish, setDetailWish] = useState<Wish | null>(null);
  const [showReflectionModal, setShowReflectionModal] = useState(false);
  const [completedWish, setCompletedWish] = useState<Wish | null>(null);
  const [members, setMembers] = useState<Array<{ id: string; name: string }>>([]);

  // 統計情報を取得
  const { data: stats } = useQuery({
    queryKey: ['wishes', 'stats'],
    queryFn: async () => {
      const response = await api.get('/api/wishes/stats');
      return response.data;
    },
  });

  // やりたいこと一覧を取得
  const { data: wishes, isLoading } = useQuery<Wish[]>({
    queryKey: ['wishes', statusFilter, categoryFilter, searchQuery, sortBy],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (categoryFilter !== 'all') params.append('category', categoryFilter);
      if (searchQuery) params.append('search', searchQuery);
      if (sortBy !== 'default') params.append('sort', sortBy);
      
      const url = `/api/wishes${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await api.get(url);
      return response.data;
    },
  });

  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.post(`/api/wishes/${id}/complete`);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['wishes'] });
      queryClient.invalidateQueries({ queryKey: ['wishes', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['wishes', 'next'] });
      // 完了後に振り返りモーダルを表示
      setCompletedWish(data.data);
      setShowReflectionModal(true);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/api/wishes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wishes'] });
      queryClient.invalidateQueries({ queryKey: ['wishes', 'stats'] });
    },
  });

  // カテゴリ一覧を取得
  const categories = useMemo(() => {
    if (!wishes) return [];
    const categorySet = new Set<string>();
    wishes.forEach(wish => {
      if (wish.category) categorySet.add(wish.category);
    });
    return Array.from(categorySet).sort();
  }, [wishes]);

  const filteredWishes = useMemo(() => {
    if (!wishes) return [];
    return wishes;
  }, [wishes]);

  const handleComplete = async (wish: Wish) => {
    if (confirm('このやりたいことを完了にしますか？')) {
      completeMutation.mutate(wish.id);
    }
  };

  const handleDelete = async (wish: Wish) => {
    if (confirm('このやりたいことを削除しますか？')) {
      deleteMutation.mutate(wish.id);
    }
  };

  const handleCreate = () => {
    setSelectedWish(null);
    setIsModalOpen(true);
  };

  const handleEdit = (wish: Wish) => {
    setSelectedWish(wish);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedWish(null);
  };

  const getStatusIcon = (status: WishStatus) => {
    switch (status) {
      case 'DONE':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'PAUSED':
        return <Pause className="h-5 w-5 text-yellow-500" />;
      default:
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: WishStatus) => {
    switch (status) {
      case 'DONE':
        return '完了';
      case 'PAUSED':
        return '中断';
      default:
        return '進行中';
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

  const getPriorityLabel = (priority?: string) => {
    switch (priority) {
      case 'HIGH':
        return '高';
      case 'MID':
        return '中';
      case 'LOW':
        return '低';
      default:
        return '-';
    }
  };

  const getMonthLabel = (month?: number) => {
    if (!month) return '-';
    return `${month}月`;
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">やりたいこと100</h1>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          新規追加
        </Button>
      </div>

      {/* 統計情報 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">達成数 / 100</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {stats.done} / {stats.total}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0}% 達成
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">今月達成数</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {stats.thisMonthDone}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">進行中</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {stats.active}
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">中断中</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {stats.total - stats.done - stats.active}
            </div>
          </div>
        </div>
      )}

      {/* フィルタ・検索 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Search className="h-4 w-4 inline mr-1" />
              検索
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="タイトル、メモ、タグで検索..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Filter className="h-4 w-4 inline mr-1" />
              ステータス
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as WishStatus | 'all')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="all">すべて</option>
              <option value="ACTIVE">進行中</option>
              <option value="DONE">完了</option>
              <option value="PAUSED">中断</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              カテゴリ
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="all">すべて</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              並び替え
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="default">デフォルト（次にやる気が出る順）</option>
              <option value="priority">優先度順</option>
              <option value="dueMonth">期限月順</option>
              <option value="created">作成日順</option>
            </select>
          </div>
        </div>
      </div>

      {/* やりたいこと一覧 */}
      <div className="space-y-3">
        {filteredWishes && filteredWishes.length > 0 ? (
          filteredWishes.map((wish) => (
            <div
              key={wish.id}
              className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    {getStatusIcon(wish.status)}
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {wish.title}
                    </h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      wish.status === 'DONE'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                        : wish.status === 'PAUSED'
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                    }`}>
                      {getStatusLabel(wish.status)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {wish.category && (
                      <div>
                        <span className="font-medium">カテゴリ:</span> {wish.category}
                      </div>
                    )}
                    {wish.difficulty && (
                      <div>
                        <span className="font-medium">難易度:</span> {getDifficultyLabel(wish.difficulty)}
                      </div>
                    )}
                    {wish.estimate && (
                      <div>
                        <span className="font-medium">所要感:</span> {getEstimateLabel(wish.estimate)}
                      </div>
                    )}
                    {wish.priority && (
                      <div>
                        <span className="font-medium">優先度:</span> {getPriorityLabel(wish.priority)}
                      </div>
                    )}
                    {wish.dueMonth && (
                      <div>
                        <Calendar className="h-4 w-4 inline mr-1" />
                        <span className="font-medium">期限:</span> {getMonthLabel(wish.dueMonth)}
                      </div>
                    )}
                  </div>

                  {wish.tags && wish.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {wish.tags.map((tag, index) => (
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

                  {wish.memo && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                      {wish.memo}
                    </p>
                  )}

                  {wish.completedAt && (
                    <div className="text-xs text-gray-500 dark:text-gray-500">
                      完了日: {format(new Date(wish.completedAt), 'yyyy年M月d日', { locale: ja })}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 ml-4">
                  <button
                    onClick={() => {
                      setDetailWish(wish);
                      setIsDetailModalOpen(true);
                    }}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                    title="詳細"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  {viewMode === 'personal' && wish.status === 'ACTIVE' && (
                    <button
                      onClick={() => handleComplete(wish)}
                      className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 p-2 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                      title="完了"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                  {viewMode === 'personal' && (
                    <>
                      <button
                        onClick={() => handleEdit(wish)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                        title="編集"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(wish)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        title="削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p>やりたいことがありません。</p>
            <p className="text-sm mt-2">「新規追加」ボタンから追加してください。</p>
          </div>
        )}
      </div>

      {/* 編集モーダル */}
      {isModalOpen && (
        <WishModal
          wish={selectedWish}
          onClose={handleCloseModal}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['wishes'] });
            queryClient.invalidateQueries({ queryKey: ['wishes', 'stats'] });
            queryClient.invalidateQueries({ queryKey: ['wishes', 'next'] });
            handleCloseModal();
          }}
        />
      )}

      {/* 詳細モーダル */}
      {isDetailModalOpen && detailWish && (
        <WishDetailModal
          wish={detailWish}
          onClose={() => {
            setIsDetailModalOpen(false);
            setDetailWish(null);
          }}
          onUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['wishes'] });
            queryClient.invalidateQueries({ queryKey: ['wishes', 'stats'] });
          }}
        />
      )}

      {/* 完了時の振り返りモーダル */}
      {showReflectionModal && completedWish && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full m-4 p-6">
            <h3 className="text-lg font-bold dark:text-gray-100 mb-4">おめでとうございます！</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">
              「{completedWish.title}」を完了しました。
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              振り返りを記録しますか？（任意）
            </p>
            <div className="space-y-3">
              <textarea
                id="reflection-input"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="何が良かった？次もやるなら一言"
              />
              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    const input = document.getElementById('reflection-input') as HTMLTextAreaElement;
                    const content = input?.value?.trim();
                    if (content) {
                      try {
                        await api.post(`/api/wishes/${completedWish.id}/checkins`, {
                          type: 'REFLECTION',
                          content,
                        });
                        queryClient.invalidateQueries({ queryKey: ['wishes'] });
                        queryClient.invalidateQueries({ queryKey: ['wishes', completedWish.id, 'checkins'] });
                      } catch (error) {
                        console.error('Failed to add reflection:', error);
                      }
                    }
                    setShowReflectionModal(false);
                    setCompletedWish(null);
                  }}
                  variant="primary"
                  className="flex-1"
                >
                  記録する
                </Button>
                <Button
                  onClick={() => {
                    setShowReflectionModal(false);
                    setCompletedWish(null);
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  スキップ
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

