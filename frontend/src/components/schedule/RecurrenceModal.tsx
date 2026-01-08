import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { addDays, addWeeks, addMonths, format } from 'date-fns';

interface RecurrenceConfig {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  interval: number;
  endDate: string;
  weekdays?: number[]; // 0=日曜, 1=月曜, ..., 6=土曜
}

interface RecurrenceModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (config: RecurrenceConfig) => void;
  startDate: Date;
}

export function RecurrenceModal({ open, onClose, onConfirm, startDate }: RecurrenceModalProps) {
  const [frequency, setFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('WEEKLY');
  const [interval, setInterval] = useState(1);
  const [endDate, setEndDate] = useState(
    format(addMonths(startDate, 3), 'yyyy-MM-dd')
  );
  const [weekdays, setWeekdays] = useState<number[]>([startDate.getDay()]);

  const handleWeekdayToggle = (day: number) => {
    if (weekdays.includes(day)) {
      setWeekdays(weekdays.filter((d) => d !== day));
    } else {
      setWeekdays([...weekdays, day].sort());
    }
  };

  const handleConfirm = () => {
    onConfirm({
      frequency,
      interval,
      endDate,
      weekdays: frequency === 'WEEKLY' ? weekdays : undefined,
    });
    onClose();
  };

  const getPreviewText = () => {
    const intervalText = interval > 1 ? `${interval}` : '';
    const frequencyText =
      frequency === 'DAILY'
        ? `${intervalText}日ごと`
        : frequency === 'WEEKLY'
        ? `${intervalText}週間ごと`
        : `${intervalText}ヶ月ごと`;

    const weekdayText =
      frequency === 'WEEKLY' && weekdays.length > 0
        ? `（${weekdays.map((d) => ['日', '月', '火', '水', '木', '金', '土'][d]).join('、')}曜日）`
        : '';

    return `${frequencyText}${weekdayText}に繰り返し、${format(new Date(endDate), 'yyyy年M月d日')}まで`;
  };

  const weekdayNames = ['日', '月', '火', '水', '木', '金', '土'];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>繰り返し設定</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>繰り返し頻度</Label>
            <RadioGroup value={frequency} onValueChange={(v: any) => setFrequency(v)} className="mt-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="DAILY" id="daily" />
                <Label htmlFor="daily" className="cursor-pointer">
                  毎日
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="WEEKLY" id="weekly" />
                <Label htmlFor="weekly" className="cursor-pointer">
                  毎週
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="MONTHLY" id="monthly" />
                <Label htmlFor="monthly" className="cursor-pointer">
                  毎月
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="interval">間隔</Label>
            <div className="flex items-center gap-2 mt-1">
              <Input
                id="interval"
                type="number"
                min={1}
                value={interval}
                onChange={(e) => setInterval(parseInt(e.target.value) || 1)}
                className="w-20"
              />
              <span className="text-sm text-gray-600">
                {frequency === 'DAILY' ? '日' : frequency === 'WEEKLY' ? '週間' : 'ヶ月'}ごと
              </span>
            </div>
          </div>

          {frequency === 'WEEKLY' && (
            <div>
              <Label>曜日</Label>
              <div className="flex gap-2 mt-2">
                {weekdayNames.map((name, index) => (
                  <div key={index} className="flex flex-col items-center">
                    <Checkbox
                      checked={weekdays.includes(index)}
                      onCheckedChange={() => handleWeekdayToggle(index)}
                      id={`weekday-${index}`}
                    />
                    <Label
                      htmlFor={`weekday-${index}`}
                      className="text-xs mt-1 cursor-pointer"
                    >
                      {name}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <Label htmlFor="endDate">終了日</Label>
            <Input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={format(startDate, 'yyyy-MM-dd')}
              className="mt-1"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded p-3">
            <p className="text-sm text-blue-900">
              <strong>プレビュー:</strong> {getPreviewText()}
            </p>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={frequency === 'WEEKLY' && weekdays.length === 0}
            >
              確定
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
