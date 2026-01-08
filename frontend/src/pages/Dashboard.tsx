import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, FileText, Clock } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../utils/api';
import { Schedule } from '../types';
import { formatDate, getWeekRange } from '../utils/date';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

export const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchThisWeekSchedules();
  }, []);

  const fetchThisWeekSchedules = async () => {
    try {
      const { start, end } = getWeekRange();
      const params = new URLSearchParams({
        startDate: formatDate(start),
        endDate: formatDate(end),
      });

      const data = await api.get<Schedule[]>(`/api/schedules?${params}`);
      setSchedules(data);
    } catch (error) {
      console.error('Failed to fetch schedules:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">ダッシュボード</h1>
        <p className="mt-2 text-gray-600">ようこそ、{user?.name}さん</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          to="/schedule"
          className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow border border-border"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-gray-600">スケジュール</p>
              <p className="text-2xl font-bold text-gray-900">
                {schedules.length}件
              </p>
            </div>
          </div>
        </Link>

        <Link
          to="/reports/weekly"
          className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow border border-border"
        >
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-secondary/10 rounded-lg">
              <FileText className="h-6 w-6 text-secondary" />
            </div>
            <div>
              <p className="text-sm text-gray-600">週次報告</p>
              <p className="text-2xl font-bold text-gray-900">今週</p>
            </div>
          </div>
        </Link>

        <div className="bg-white p-6 rounded-lg shadow border border-border">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-accent/10 rounded-lg">
              <Clock className="h-6 w-6 text-accent" />
            </div>
            <div>
              <p className="text-sm text-gray-600">今週の活動時間</p>
              <p className="text-2xl font-bold text-gray-900">
                {schedules.length * 8}h
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-border p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900">今週のスケジュール</h2>
          <Link to="/schedule">
            <Button variant="outline" size="sm">
              すべて見る
            </Button>
          </Link>
        </div>

        {loading ? (
          <LoadingSpinner />
        ) : schedules.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            今週のスケジュールはありません
          </p>
        ) : (
          <div className="space-y-3">
            {schedules.slice(0, 5).map((schedule) => (
              <div
                key={schedule.id}
                className="flex items-start space-x-4 p-4 border border-border rounded-lg hover:bg-gray-50"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium"
                  style={{ backgroundColor: schedule.user?.avatarColor }}
                >
                  {schedule.user?.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {schedule.activityDescription}
                  </p>
                  <p className="text-sm text-gray-600">
                    {formatDate(schedule.date, 'M月d日(E)')} {schedule.startTime} -{' '}
                    {schedule.endTime}
                  </p>
                  {schedule.locationText && (
                    <p className="text-sm text-gray-500">{schedule.locationText}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
