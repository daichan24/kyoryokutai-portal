import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, MessageSquare } from 'lucide-react';
import { api } from '../../utils/api';
import { Button } from '../common/Button';
import { Wish, WishCheckin, WishCheckinType } from '../../types';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface WishDetailModalProps {
  wish: Wish;
  onClose: () => void;
  onUpdated?: () => void;
}

export const WishDetailModal: React.FC<WishDetailModalProps> = ({
  wish,
  onClose,
  onUpdated,
}) => {
  const queryClient = useQueryClient();
  const [checkinType, setCheckinType] = useState<WishCheckinType>('REFLECTION');
  const [checkinContent, setCheckinContent] = useState('');
  const [isAddingCheckin, setIsAddingCheckin] = useState(false);

  const { data: checkins, refetch: refetchCheckins } = useQuery<WishCheckin[]>({
    queryKey: ['wishes', wish.id, 'checkins'],
    queryFn: async () => {
      const response = await api.get(`/api/wishes/${wish.id}/checkins`);
      return response.data;
    },
  });

  const addCheckinMutation = useMutation({
    mutationFn: async (data: { type: WishCheckinType; content: string }) => {
      return api.post(`/api/wishes/${wish.id}/checkins`, data);
    },
    onSuccess: () => {
      refetchCheckins();
      setCheckinContent('');
      setIsAddingCheckin(false);
      if (onUpdated) onUpdated();
    },
  });

  const handleAddCheckin = async () => {
    if (!checkinContent.trim()) {
      alert('内容を入力してください');
      return;
    }

    addCheckinMutation.mutate({
      type: checkinType,
      content: checkinContent.trim(),
    });
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'DONE':
        return '完了';
      case 'PAUSED':
        return '中断';
      default:
        return '進行中';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h2 className="text-2xl font-bold dark:text-gray-100">{wish.title}</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 基本情報 */}
          <div className="space-y-3">
            <div>
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">ステータス:</span>
              <span className="ml-2 text-gray-900 dark:text-gray-100">{getStatusLabel(wish.status)}</span>
            </div>
            {wish.category && (
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">カテゴリ:</span>
                <span className="ml-2 text-gray-900 dark:text-gray-100">{wish.category}</span>
              </div>
            )}
            <div className="grid grid-cols-3 gap-4 text-sm">
              {wish.difficulty && (
                <div>
                  <span className="font-medium text-gray-600 dark:text-gray-400">難易度:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">{getDifficultyLabel(wish.difficulty)}</span>
                </div>
              )}
              {wish.estimate && (
                <div>
                  <span className="font-medium text-gray-600 dark:text-gray-400">所要感:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">{getEstimateLabel(wish.estimate)}</span>
                </div>
              )}
              {wish.priority && (
                <div>
                  <span className="font-medium text-gray-600 dark:text-gray-400">優先度:</span>
                  <span className="ml-2 text-gray-900 dark:text-gray-100">{getPriorityLabel(wish.priority)}</span>
                </div>
              )}
            </div>
            {wish.dueMonth && (
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">期限:</span>
                <span className="ml-2 text-gray-900 dark:text-gray-100">{wish.dueMonth}月</span>
              </div>
            )}
            {wish.tags && wish.tags.length > 0 && (
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">タグ:</span>
                <div className="flex flex-wrap gap-2 mt-1">
                  {wish.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {wish.memo && (
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">メモ:</span>
                <p className="mt-1 text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{wish.memo}</p>
              </div>
            )}
            {wish.completedAt && (
              <div>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">完了日:</span>
                <span className="ml-2 text-gray-900 dark:text-gray-100">
                  {format(new Date(wish.completedAt), 'yyyy年M月d日', { locale: ja })}
                </span>
              </div>
            )}
          </div>

          {/* 途中経過 */}
          <div className="border-t dark:border-gray-700 pt-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold dark:text-gray-100">途中経過</h3>
              <Button
                onClick={() => setIsAddingCheckin(true)}
                variant="outline"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                追加
              </Button>
            </div>

            {isAddingCheckin && (
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    種類
                  </label>
                  <select
                    value={checkinType}
                    onChange={(e) => setCheckinType(e.target.value as WishCheckinType)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="REFLECTION">振り返り</option>
                    <option value="NOTE">メモ</option>
                  </select>
                </div>
                <div className="mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    内容
                  </label>
                  <textarea
                    value={checkinContent}
                    onChange={(e) => setCheckinContent(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    placeholder={checkinType === 'REFLECTION' ? '何が良かった？次もやるなら一言' : 'メモを入力...'}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleAddCheckin}
                    size="sm"
                    disabled={addCheckinMutation.isPending}
                  >
                    {addCheckinMutation.isPending ? '追加中...' : '追加'}
                  </Button>
                  <Button
                    onClick={() => {
                      setIsAddingCheckin(false);
                      setCheckinContent('');
                    }}
                    variant="outline"
                    size="sm"
                  >
                    キャンセル
                  </Button>
                </div>
              </div>
            )}

            {checkins && checkins.length > 0 ? (
              <div className="space-y-3">
                {checkins.map((checkin) => (
                  <div
                    key={checkin.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        checkin.type === 'REFLECTION'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                          : 'bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300'
                      }`}>
                        {checkin.type === 'REFLECTION' ? '振り返り' : 'メモ'}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {format(new Date(checkin.createdAt), 'yyyy年M月d日 H:mm', { locale: ja })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                      {checkin.content}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                途中経過がありません
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end p-6 border-t dark:border-gray-700">
          <Button onClick={onClose} variant="outline">
            閉じる
          </Button>
        </div>
      </div>
    </div>
  );
};

