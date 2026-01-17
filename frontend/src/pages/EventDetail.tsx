import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';
import { format } from 'date-fns';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/common/Button';

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
  creator: {
    id: string;
    name: string;
    avatarColor?: string;
  };
  project?: { id: string; projectName: string } | null;
  participations: Array<{
    id: string;
    participationType: string;
    user: {
      id: string;
      name: string;
      avatarColor?: string;
    };
  }>;
}

export const EventDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: event, isLoading } = useQuery<EventDetail>({
    queryKey: ['event', id],
    queryFn: async () => {
      const response = await api.get(`/api/events/${id}`);
      return response.data;
    },
    enabled: !!id,
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
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/events')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          一覧に戻る
        </Button>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{event.eventName}</h1>
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
              <span className="text-gray-900 dark:text-gray-100">{event.creator.name}</span>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">参加メンバー</h2>
            {event.participations && event.participations.length > 0 ? (
              <div className="space-y-2">
                {event.participations.map((participation) => (
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
                    <span className="text-gray-900 dark:text-gray-100">{participation.user.name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                      {participation.participationType === 'PARTICIPATION' ? '参加' : '準備'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">参加メンバーはいません</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

