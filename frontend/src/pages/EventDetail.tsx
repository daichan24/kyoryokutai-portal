import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { format } from 'date-fns';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ArrowLeft, Edit2, Trash2, Plus, X } from 'lucide-react';
import { Button } from '../components/common/Button';
import { EventModal } from '../components/event/EventModal';
import { useAuthStore } from '../stores/authStore';

interface EventDetail {
  id: string;
  eventName: string;
  eventType: 'TOWN_OFFICIAL' | 'TEAM' | 'OTHER';
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  description?: string | null;
  location?: { id: string; name: string } | null;
  locationText?: string | null;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    name: string;
    avatarColor?: string;
    avatarLetter?: string;
  };
  updater?: {
    id: string;
    name: string;
    avatarColor?: string;
    avatarLetter?: string;
  } | null;
  project?: { id: string; projectName: string } | null;
  participations: Array<{
    id: string;
    participationType: string;
    status?: 'PENDING' | 'APPROVED' | 'REJECTED';
    user: {
      id: string;
      name: string;
      avatarColor?: string;
      avatarLetter?: string;
    };
  }>;
}

interface User {
  id: string;
  name: string;
  avatarColor?: string;
  avatarLetter?: string;
}

export const EventDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuthStore();
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddParticipantsOpen, setIsAddParticipantsOpen] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [participationType, setParticipationType] = useState<'PARTICIPATION' | 'PREPARATION'>('PARTICIPATION');
  const [addingParticipants, setAddingParticipants] = useState(false);

  const { data: event, isLoading } = useQuery<EventDetail>({
    queryKey: ['event', id],
    queryFn: async () => {
      const response = await api.get(`/api/events/${id}`);
      return response.data;
    },
    enabled: !!id,
  });

  const { data: users } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/api/users');
      // 既に参加しているメンバーを除外し、表示順0番目のユーザーも除外（テストユーザー）
      const participationUserIds = event?.participations.map(p => p.user.id) || [];
      return (response.data || []).filter((u: User) => 
        !participationUserIds.includes(u.id) && (u.displayOrder ?? 0) !== 0
      );
    },
    enabled: !!event,
  });

  const getTypeLabel = (type: string) => {
    const labels = {
      TOWN_OFFICIAL: '町主催',
      TEAM: '協力隊主催',
      OTHER: 'その他',
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getTypeColor = (type: string) => {
    const colors = {
      TOWN_OFFICIAL: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
      TEAM: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
      OTHER: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 dark:bg-gray-700';
  };

  const handleDelete = async () => {
    if (!event || !confirm('このイベントを削除しますか？')) return;

    try {
      await api.delete(`/api/events/${event.id}`);
      queryClient.invalidateQueries({ queryKey: ['events'] });
      navigate('/events');
    } catch (error) {
      console.error('Failed to delete event:', error);
      alert('削除に失敗しました');
    }
  };

  const handleAddParticipants = async () => {
    if (!event || selectedUserIds.length === 0) return;

    setAddingParticipants(true);
    try {
      await api.post(`/api/events/${event.id}/participants`, {
        userIds: selectedUserIds,
        participationType,
      });
      queryClient.invalidateQueries({ queryKey: ['event', id] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      setSelectedUserIds([]);
      setIsAddParticipantsOpen(false);
      alert('参加メンバーを追加しました。各メンバーのスケジュールにも追加されました。');
    } catch (error: any) {
      console.error('Failed to add participants:', error);
      alert(error?.response?.data?.error || '参加メンバーの追加に失敗しました');
    } finally {
      setAddingParticipants(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">イベントが見つかりません</p>
        <Button onClick={() => navigate('/events')} className="mt-4">
          イベント一覧に戻る
        </Button>
      </div>
    );
  }

  // endAtを計算
  let endAt: Date;
  if (event.endTime) {
    const [hours, minutes] = event.endTime.split(':').map(Number);
    endAt = new Date(event.date);
    endAt.setHours(hours, minutes, 0, 0);
  } else {
    endAt = new Date(event.date);
    endAt.setHours(23, 59, 59, 999);
  }
  const isCompleted = endAt < new Date();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/events')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            一覧に戻る
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{event.eventName}</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsEditModalOpen(true)}>
            <Edit2 className="h-4 w-4 mr-2" />
            編集
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            削除
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className={`text-sm px-3 py-1 rounded-full ${getTypeColor(event.eventType)}`}>
              {getTypeLabel(event.eventType)}
            </span>
            {isCompleted && (
              <span className="text-sm px-3 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                実施済み
              </span>
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">開催日時</h2>
            <p className="text-gray-900 dark:text-gray-100">
              {format(new Date(event.date), 'yyyy年M月d日')}
              {event.startTime && ` ${event.startTime}〜`}
              {event.endTime && event.endTime}
            </p>
          </div>

          {(event.location || event.locationText) && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">場所</h2>
              <p className="text-gray-900 dark:text-gray-100">
                {event.location ? event.location.name : event.locationText}
              </p>
            </div>
          )}

          {event.description && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">詳細説明</h2>
              <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          {event.project && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">関連プロジェクト</h2>
              <p className="text-gray-900 dark:text-gray-100">{event.project.projectName}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">作成者</h2>
              <div className="flex items-center gap-2">
                {event.creator.avatarColor && (
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: event.creator.avatarColor }}
                  >
                    {(event.creator.avatarLetter || event.creator.name || '').charAt(0)}
                  </div>
                )}
                <div>
                  <span className="text-gray-900 dark:text-gray-100">{event.creator.name}</span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {format(new Date(event.createdAt), 'yyyy年M月d日 H:mm')}
                  </p>
                </div>
              </div>
            </div>
            {event.updater && (
              <div>
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">最終更新者</h2>
                <div className="flex items-center gap-2">
                  {event.updater.avatarColor && (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                      style={{ backgroundColor: event.updater.avatarColor }}
                    >
                      {(event.updater.avatarLetter || event.updater.name || '').charAt(0)}
                    </div>
                  )}
                  <div>
                    <span className="text-gray-900 dark:text-gray-100">{event.updater.name}</span>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {format(new Date(event.updatedAt), 'yyyy年M月d日 H:mm')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t dark:border-gray-700 pt-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">参加メンバー</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsAddParticipantsOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                メンバーを追加
              </Button>
            </div>
            {event.participations && event.participations.length > 0 ? (
              <div className="space-y-2">
                {event.participations.map((participation) => {
                  const isCurrentUser = participation.user.id === currentUser?.id;
                  const isPending = participation.status === 'PENDING';
                  const isApproved = participation.status === 'APPROVED';
                  
                  return (
                    <div
                      key={participation.id}
                      className="flex items-center gap-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                    >
                      {participation.user.avatarColor && (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                          style={{ backgroundColor: participation.user.avatarColor }}
                        >
                          {(participation.user.avatarLetter || participation.user.name || '').charAt(0)}
                        </div>
                      )}
                      <span className="text-gray-900 dark:text-gray-100 flex-1">{participation.user.name}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {participation.participationType === 'PARTICIPATION' ? '参加' : '準備'}
                      </span>
                      {isPending && (
                        <span className="text-xs px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 rounded">
                          承認待ち
                        </span>
                      )}
                      {isApproved && (
                        <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                          承認済み
                        </span>
                      )}
                      {isCurrentUser && isPending && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleRespondToInvite('APPROVED')}
                          >
                            承認
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRespondToInvite('REJECTED')}
                          >
                            却下
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">参加メンバーはいません</p>
            )}
          </div>
        </div>
      </div>

      {/* 編集モーダル */}
      {isEditModalOpen && (
        <EventModal
          event={event}
          onClose={() => {
            setIsEditModalOpen(false);
            queryClient.invalidateQueries({ queryKey: ['event', id] });
          }}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['event', id] });
            queryClient.invalidateQueries({ queryKey: ['events'] });
            setIsEditModalOpen(false);
          }}
        />
      )}

      {/* 参加メンバー追加モーダル */}
      {isAddParticipantsOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full m-4">
            <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
              <h2 className="text-2xl font-bold dark:text-gray-100">参加メンバーを追加</h2>
              <button
                onClick={() => setIsAddParticipantsOpen(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  参加タイプ
                </label>
                <select
                  value={participationType}
                  onChange={(e) => setParticipationType(e.target.value as 'PARTICIPATION' | 'PREPARATION')}
                  className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="PARTICIPATION">参加</option>
                  <option value="PREPARATION">準備</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  追加するメンバー
                </label>
                <select
                  multiple
                  value={selectedUserIds}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    setSelectedUserIds(selected);
                  }}
                  className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 min-h-[120px]"
                  size={5}
                >
                  {users?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {selectedUserIds.length > 0 && `${selectedUserIds.length}人選択中`}
                  <br />
                  選択したメンバーのスケジュールにも同じ時間でイベントが追加されます。
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                <Button variant="outline" onClick={() => setIsAddParticipantsOpen(false)}>
                  キャンセル
                </Button>
                <Button
                  onClick={handleAddParticipants}
                  disabled={selectedUserIds.length === 0 || addingParticipants}
                >
                  {addingParticipants ? '追加中...' : '追加'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
