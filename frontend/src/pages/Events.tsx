import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  description?: string;
  participationPoint: number;
  preparationPoint: number;
  participations: any[];
}

export const Events: React.FC = () => {
  const { user } = useAuthStore();
  const [filterType, setFilterType] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const queryClient = useQueryClient();

  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ['events'],
    queryFn: async () => {
      const response = await api.get('/api/events');
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
      TOWN_OFFICIAL: 'bg-blue-100 text-blue-800',
      TEAM: 'bg-green-100 text-green-800',
      OTHER: 'bg-gray-100 text-gray-800'
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">イベント管理</h1>
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
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2"
        >
          <option value="all">全てのイベント</option>
          <option value="TOWN_OFFICIAL">町主催</option>
          <option value="TEAM">協力隊主催</option>
          <option value="OTHER">その他</option>
        </select>
      </div>

      <div className="space-y-3">
        {filteredEvents?.map((event) => (
          <div key={event.id} className="bg-white border rounded-lg p-5">
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-lg">{event.eventName}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${getTypeColor(event.eventType)}`}>
                    {getTypeLabel(event.eventType)}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  {format(new Date(event.date), 'yyyy年M月d日')}
                </div>
              </div>
            </div>
            {event.description && (
              <p className="text-sm text-gray-600 mb-3">{event.description}</p>
            )}
          </div>
        ))}
      </div>

      {filteredEvents?.length === 0 && (
        <div className="text-center py-12 text-gray-500">
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