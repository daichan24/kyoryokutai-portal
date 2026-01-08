import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, MapPin, FileText } from 'lucide-react';

interface ScheduleTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  locationText?: string;
  activityDescription: string;
  activityType: string;
}

interface ScheduleTemplateModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: ScheduleTemplate) => void;
  userId: string;
}

export function ScheduleTemplateModal({
  open,
  onClose,
  onSelect,
  userId,
}: ScheduleTemplateModalProps) {
  const [templates, setTemplates] = useState<ScheduleTemplate[]>([]);

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open, userId]);

  const loadTemplates = () => {
    // LocalStorageからテンプレートを読み込み
    const savedTemplates = localStorage.getItem(`scheduleTemplates_${userId}`);
    if (savedTemplates) {
      setTemplates(JSON.parse(savedTemplates));
    } else {
      // デフォルトテンプレート
      setTemplates([
        {
          id: '1',
          name: '役場業務',
          startTime: '08:30',
          endTime: '17:15',
          locationText: '長沼町役場',
          activityDescription: '役場業務',
          activityType: 'TOWN_HALL_WORK',
        },
        {
          id: '2',
          name: '地域支援活動',
          startTime: '09:00',
          endTime: '12:00',
          locationText: '',
          activityDescription: '地域支援活動',
          activityType: 'REGIONAL_SUPPORT',
        },
        {
          id: '3',
          name: 'イベント準備',
          startTime: '13:00',
          endTime: '17:00',
          locationText: '',
          activityDescription: 'イベント準備',
          activityType: 'EVENT',
        },
      ]);
    }
  };

  const handleSelect = (template: ScheduleTemplate) => {
    onSelect(template);
    onClose();
  };

  const getActivityTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      STARTUP_PREP: '起業準備',
      TOWN_HALL_WORK: '役場業務',
      REGIONAL_SUPPORT: '地域支援',
      EVENT: 'イベント',
      SNS_PROMOTION: 'SNS発信',
      STUDY: '研修',
      OTHER: 'その他',
    };
    return labels[type] || type;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>テンプレートから作成</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {templates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>テンプレートがありません</p>
              <p className="text-sm mt-1">
                スケジュール作成時に「テンプレートとして保存」を選択してください
              </p>
            </div>
          ) : (
            templates.map((template) => (
              <Card
                key={template.id}
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => handleSelect(template)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{template.name}</h3>
                      <Badge variant="outline">{getActivityTypeLabel(template.activityType)}</Badge>
                    </div>

                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        {template.startTime} - {template.endTime}
                      </div>

                      {template.locationText && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4" />
                          {template.locationText}
                        </div>
                      )}

                      <p className="mt-2">{template.activityDescription}</p>
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            キャンセル
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
