import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScheduleSuggestion } from '@/types';
import { api } from '@/utils/api';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Calendar, Clock, MapPin, AlertTriangle, Check, X } from 'lucide-react';

interface ScheduleSuggestionNotificationProps {
  userId: string;
  onUpdate?: () => void;
}

export function ScheduleSuggestionNotification({
  userId,
  onUpdate,
}: ScheduleSuggestionNotificationProps) {
  const [suggestions, setSuggestions] = useState<ScheduleSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSuggestions = async () => {
    try {
      const response = await api.get<ScheduleSuggestion[]>('/api/schedule-suggestions/pending');
      setSuggestions(response.data || []);
    } catch (error) {
      console.error('Failed to load suggestions:', error);
      setSuggestions([]);
    }
  };

  const handleRespond = async (suggestionId: string, response: 'ACCEPTED' | 'DECLINED') => {
    setLoading(true);
    try {
      await api.post(`/api/schedule-suggestions/${suggestionId}/respond`, { response });
      await loadSuggestions();
      onUpdate?.();
    } catch (error) {
      console.error('Failed to respond to suggestion:', error);
      alert('応答に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSuggestions();
    // ポーリング: 30秒ごとに更新
    const interval = setInterval(loadSuggestions, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm flex items-center gap-2">
        <Badge variant="destructive" className="rounded-full">
          {suggestions.length}
        </Badge>
        スケジュール提案
      </h3>

      {suggestions.map((suggestion) => (
        <Card key={suggestion.id} className="p-4">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                    style={{ backgroundColor: suggestion.schedule.user?.avatarColor || '#6B7280' }}
                  >
                    {suggestion.schedule.user?.name.charAt(0) || '?'}
                  </div>
                  <span className="font-medium">{suggestion.schedule.user?.name}さんからの提案</span>
                </div>

                <div className="space-y-1 text-sm text-gray-600 ml-10">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {format(new Date(suggestion.schedule.date), 'M月d日(E)', { locale: ja })}
                  </div>

                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {suggestion.schedule.startTime} - {suggestion.schedule.endTime}
                  </div>

                  {suggestion.schedule.locationText && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {suggestion.schedule.locationText}
                    </div>
                  )}

                  <p className="mt-2">{suggestion.schedule.activityDescription}</p>
                </div>
              </div>
            </div>

            {suggestion.conflictingSchedules && suggestion.conflictingSchedules.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 ml-10">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-yellow-800 mb-1">スケジュール衝突あり</p>
                    {suggestion.conflictingSchedules.map((conflict) => (
                      <p key={conflict.id} className="text-yellow-700">
                        {conflict.startTime} - {conflict.endTime}: {conflict.description}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 ml-10">
              <Button
                size="sm"
                onClick={() => handleRespond(suggestion.id, 'ACCEPTED')}
                disabled={loading}
                className="flex items-center gap-1"
              >
                <Check className="w-4 h-4" />
                承認
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRespond(suggestion.id, 'DECLINED')}
                disabled={loading}
                className="flex items-center gap-1"
              >
                <X className="w-4 h-4" />
                拒否
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
