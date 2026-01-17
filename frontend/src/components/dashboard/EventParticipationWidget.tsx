import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { CalendarDays, Award, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../common/Button';

type DisplayMode = 'view-only' | 'view-with-add' | 'add-only';

interface ParticipationSummary {
  thisMonthCount: number;
  totalCount: number;
  totalPoints: number;
}

interface EventParticipationWidgetProps {
  displayMode?: DisplayMode;
  showAddButton?: boolean;
  onAddClick?: () => void;
}

export const EventParticipationWidget: React.FC<EventParticipationWidgetProps> = ({
  displayMode = 'view-only',
  showAddButton = false,
}) => {
  const { data: summary, isLoading } = useQuery<ParticipationSummary>({
    queryKey: ['event-participation-summary'],
    queryFn: async () => {
      const response = await api.get('/api/events/participation-summary');
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">イベント参加状況</h3>
        <Link to="/events/participation-summary">
          <Button variant="outline" size="sm">
            詳細を見る
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 今月の参加回数 */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
              <CalendarDays className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400">今月の参加回数</h4>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {summary?.thisMonthCount || 0}
              </p>
            </div>
          </div>
        </div>

        {/* 累計参加回数 */}
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400">累計参加回数</h4>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {summary?.totalCount || 0}
              </p>
            </div>
          </div>
        </div>

        {/* 累計ポイント */}
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
              <Award className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400">累計ポイント</h4>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {summary?.totalPoints || 0}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

