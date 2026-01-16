import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Plus, CalendarDays } from 'lucide-react';
import { Button } from '../common/Button';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { formatDate } from '../../utils/date';

interface Event {
  id: string;
  eventName: string;
  eventType: 'TOWN_OFFICIAL' | 'TEAM' | 'OTHER';
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  location?: string;
  description?: string;
  isCompleted?: boolean;
}

type DisplayMode = 'view-only' | 'view-with-add' | 'add-only';

interface EventsWidgetProps {
  displayMode?: DisplayMode;
  showAddButton?: boolean;
  onAddClick?: () => void;
}

export const EventsWidget: React.FC<EventsWidgetProps> = ({
  displayMode = 'view-with-add',
  showAddButton = false,
  onAddClick,
}) => {
  const { user } = useAuthStore();

  const { data: events, isLoading } = useQuery<Event[]>({
    queryKey: ['events-widget'],
    queryFn: async () => {
      const response = await api.get('/api/events?status=upcoming');
      const events = response.data || [];
      // 日付順にソートして最新5件を取得
      return events
        .sort((a: Event, b: Event) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 5);
    },
  });

  const getEventTypeLabel = (type: string) => {
    switch (type) {
      case 'TOWN_OFFICIAL':
        return '町公式';
      case 'TEAM':
        return 'チーム';
      case 'OTHER':
        return 'その他';
      default:
        return type;
    }
  };

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case 'TOWN_OFFICIAL':
        return 'bg-blue-100 text-blue-700';
      case 'TEAM':
        return 'bg-green-100 text-green-700';
      case 'OTHER':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // 追加ボタンのみモード
  if (displayMode === 'add-only') {
    return (
      <div className="bg-white rounded-lg shadow border border-border p-6 flex items-center justify-center min-h-[200px]">
        <Link to="/events">
          <Button className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            イベントを追加
          </Button>
        </Link>
      </div>
    );
  }

  // 表示のみ or 表示+追加ボタンモード
  return (
    <div className="bg-white rounded-lg shadow border border-border p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-900">イベント</h3>
        {(displayMode === 'view-with-add' || showAddButton) && (user?.role === 'MEMBER' || user?.role === 'SUPPORT' || user?.role === 'MASTER') && (
          <Link to="/events">
            <Button size="sm" className="flex items-center gap-1">
              <Plus className="w-4 h-4" />
              追加
            </Button>
          </Link>
        )}
      </div>

      {displayMode === 'view-only' || displayMode === 'view-with-add' ? (
        <>
          {isLoading ? (
            <LoadingSpinner />
          ) : !events || events.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">イベントがありません</p>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <Link
                  key={event.id}
                  to={`/events/${event.id}`}
                  className="block p-2 border border-gray-200 rounded hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {event.eventName}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <CalendarDays className="h-3 w-3 text-gray-400" />
                        <p className="text-xs text-gray-500">
                          {formatDate(new Date(event.date))}
                        </p>
                        {event.startTime && (
                          <p className="text-xs text-gray-500">
                            {event.startTime}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded ${getEventTypeColor(event.eventType)} ml-2`}>
                      {getEventTypeLabel(event.eventType)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

