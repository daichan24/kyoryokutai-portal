import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { format } from 'date-fns';
import { EventModal } from '../components/event/EventModal';
import { useAuthStore } from '../stores/authStore';

interface Event {
  id: string;
  eventName: string;
  eventType: 'TOWN_OFFICIAL' | 'TEAM' | 'OTHER';
  date: string;
  startTime?: string;
  endTime?: string;
  endAt?: string; // 計算された終了日時
  isCompleted?: boolean; // 実施済みフラグ
  description?: string;
  participationPoint: number;
  preparationPoint: number;
  participations: any[];
  location?: { id: string; name: string } | null;
  locationText?: string | null;
}

export const Events: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [filterType, setFilterType] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all'); // 未実施/実施済み/すべて
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const queryClient = useQueryClient();

  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ['events', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      const response = await api.get(`/api/events?${params.toString()}`);
      return response.data;
    }
  });

  const filteredEvents = events?.filter(e => 
    filterType === 'all' || e.eventType === filterType
  );

  const getTypeLabel = (type: string) => {
    const labels = {
      TOWN_OFFICIAL: '町主催',
      TEAM: '協力隊主催',
      OTHER: 'その他'
    };
    return labels[type as keyof typeof labels] || type;
  };

  const getTypeColor = (type: string) => {
    const colors = {
      TOWN_OFFICIAL: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
      TEAM: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
      OTHER: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 dark:bg-gray-700';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">個人・チームイベント</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-xl">
            主催するイベントを登録し、他メンバーの応援参加を依頼できます。町が隊員参加を求める枠の集計は「状況」→「イベント参加状況」の隊員参加枠タブを利用してください。
          </p>
        </div>
        <button 
          onClick={() => {
            console.log('🔵 [UI] 新規イベントボタンがクリックされました');
            setSelectedEvent(null);
            setIsModalOpen(true);
          }}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
        >
          + 新規イベント
        </button>
      </div>

      <div className="flex gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="all">すべて</option>
          <option value="upcoming">未実施</option>
          <option value="past">実施済み</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        >
          <option value="all">全てのイベント</option>
          <option value="TOWN_OFFICIAL">町主催</option>
          <option value="TEAM">協力隊主催</option>
          <option value="OTHER">その他</option>
        </select>
      </div>

      <div className="space-y-3">
        {filteredEvents?.map((event) => (
          <div 
            key={event.id} 
            className={`bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg p-5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
              event.isCompleted ? 'opacity-60' : ''
            }`}
            onClick={() => {
              navigate(`/events/${event.id}`);
            }}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-lg dark:text-gray-100">{event.eventName}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${getTypeColor(event.eventType)}`}>
                    {getTypeLabel(event.eventType)}
                  </span>
                  {event.isCompleted && (
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      実施済み
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {format(new Date(event.date), 'yyyy年M月d日')}
                  {event.startTime && ` ${event.startTime}〜`}
                  {event.endTime && event.endTime}
                </div>
                {event.location && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    場所: {event.location.name}
                  </div>
                )}
                {event.locationText && !event.location && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    場所: {event.locationText}
                  </div>
                )}
              </div>
            </div>
            {event.description && (
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{event.description}</p>
            )}
          </div>
        ))}
      </div>

      {filteredEvents?.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          イベントがありません
        </div>
      )}

      {isModalOpen && (
        <EventModal
          event={selectedEvent}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedEvent(null);
          }}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['events'] });
            setIsModalOpen(false);
            setSelectedEvent(null);
          }}
        />
      )}
    </div>
  );
};