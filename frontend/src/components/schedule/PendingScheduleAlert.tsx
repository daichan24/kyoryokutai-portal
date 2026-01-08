import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Schedule } from '@/types';
import { api } from '@/utils/api';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { AlertCircle, Calendar, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PendingScheduleAlertProps {
  userId: string;
}

export function PendingScheduleAlert({ userId }: PendingScheduleAlertProps) {
  const [pendingSchedules, setPendingSchedules] = useState<Schedule[]>([]);
  const navigate = useNavigate();

  const loadPendingSchedules = async () => {
    try {
      const response = await api.get<Schedule[]>(`/api/schedules?userId=${userId}`);
      const data = response.data;
      const allSchedules = Array.isArray(data) ? data : [];
      const pending = allSchedules.filter(
        (s) => s.isPending && new Date(s.date) < new Date()
      );
      setPendingSchedules(pending);
    } catch (error) {
      console.error('Failed to load pending schedules:', error);
      setPendingSchedules([]);
    }
  };

  useEffect(() => {
    loadPendingSchedules();
  }, [userId]);

  if (pendingSchedules.length === 0) {
    return null;
  }

  return (
    <Card className="p-4 bg-yellow-50 border-yellow-200">
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-yellow-900">進捗未更新のスケジュール</h3>
            <Badge variant="outline" className="bg-white">
              {pendingSchedules.length}件
            </Badge>
          </div>

          <p className="text-sm text-yellow-800 mb-3">
            以下のスケジュールの進捗が未更新です。活動後は進捗を更新してください。
          </p>

          <div className="space-y-2 mb-3">
            {Array.isArray(pendingSchedules) && pendingSchedules.slice(0, 3).map((schedule) => (
              <div
                key={schedule.id}
                className="bg-white rounded p-2 text-sm border border-yellow-200"
              >
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(schedule.date), 'M月d日(E)', { locale: ja })}
                  <Clock className="w-4 h-4 ml-2" />
                  {schedule.startTime} - {schedule.endTime}
                </div>
                <p className="text-gray-900 mt-1">{schedule.activityDescription}</p>
              </div>
            ))}
          </div>

          {pendingSchedules.length > 3 && (
            <p className="text-sm text-yellow-700 mb-3">
              他{pendingSchedules.length - 3}件の未更新スケジュールがあります
            </p>
          )}

          <Button
            size="sm"
            onClick={() => navigate('/schedules')}
            className="bg-yellow-600 hover:bg-yellow-700"
          >
            スケジュールを確認
          </Button>
        </div>
      </div>
    </Card>
  );
}
