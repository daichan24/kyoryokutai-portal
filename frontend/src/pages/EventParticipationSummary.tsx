import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { CalendarDays, Award, TrendingUp } from 'lucide-react';

interface ParticipationSummary {
  thisMonthCount: number;
  totalCount: number;
  totalPoints: number;
}

export const EventParticipationSummary: React.FC = () => {
  const { data: summary, isLoading } = useQuery<ParticipationSummary>({
    queryKey: ['event-participation-summary'],
    queryFn: async () => {
      const response = await api.get('/api/events/participation-summary');
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">イベント参加状況</h1>
        <p className="mt-2 text-gray-600">自分のイベント参加状況を確認できます</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 今月の参加回数 */}
        <div className="bg-white rounded-lg shadow border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <CalendarDays className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-gray-600">今月の参加回数</h2>
              <p className="text-3xl font-bold text-gray-900">
                {summary?.thisMonthCount || 0}
              </p>
            </div>
          </div>
        </div>

        {/* 累計参加回数 */}
        <div className="bg-white rounded-lg shadow border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-gray-600">累計参加回数</h2>
              <p className="text-3xl font-bold text-gray-900">
                {summary?.totalCount || 0}
              </p>
            </div>
          </div>
        </div>

        {/* 参加ポイント合計 */}
        <div className="bg-white rounded-lg shadow border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <Award className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <h2 className="text-sm font-medium text-gray-600">参加ポイント合計</h2>
              <p className="text-3xl font-bold text-gray-900">
                {summary?.totalPoints?.toFixed(1) || '0.0'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">参加状況について</h2>
        <div className="space-y-2 text-gray-600">
          <p>• 今月の参加回数: 今月1日から現在までのイベント参加回数です</p>
          <p>• 累計参加回数: これまでに参加したイベントの総数です</p>
          <p>• 参加ポイント: イベント参加で獲得したポイントの合計です（参加=1.0pt、準備=0.5pt）</p>
        </div>
      </div>
    </div>
  );
};

