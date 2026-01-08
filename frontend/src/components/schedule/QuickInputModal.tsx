import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { parseQuickInput } from '@/utils/quickInputParser';
import { Location, User, ParsedSchedule } from '@/types';
import { format } from 'date-fns';

interface QuickInputModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (schedule: ParsedSchedule) => void;
  locations: Location[];
  users: User[];
}

export function QuickInputModal({
  open,
  onClose,
  onSubmit,
  locations,
  users,
}: QuickInputModalProps) {
  const [quickText, setQuickText] = useState('');
  const [parsedData, setParsedData] = useState<ParsedSchedule | null>(null);

  const handleParse = () => {
    const parsed = parseQuickInput(quickText, locations, users, []);
    setParsedData(parsed);
  };

  const handleSubmit = () => {
    if (parsedData) {
      onSubmit(parsedData);
      setQuickText('');
      setParsedData(null);
      onClose();
    }
  };

  useEffect(() => {
    if (!open) {
      setQuickText('');
      setParsedData(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>クイック入力</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="quickText">自然文で入力</Label>
            <Textarea
              id="quickText"
              placeholder="例: 明日 10:00-12:00 ホワイトベースでAさんとプロジェクト準備"
              value={quickText}
              onChange={(e) => setQuickText(e.target.value)}
              rows={3}
              className="mt-1"
            />
            <p className="text-sm text-gray-500 mt-2">
              対応パターン: 今日・明日・明後日、今週○曜日、MM/DD、HH:MM-HH:MM、場所名、○○さん
            </p>
          </div>

          <Button onClick={handleParse} className="w-full">
            解析する
          </Button>

          {parsedData && (
            <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
              <h3 className="font-semibold text-sm">解析結果</h3>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <Label className="text-xs text-gray-600">日付</Label>
                  <Input
                    value={parsedData.date ? format(parsedData.date, 'yyyy-MM-dd') : '未設定'}
                    readOnly
                    className={!parsedData.date ? 'border-red-300 bg-red-50' : ''}
                  />
                </div>

                <div>
                  <Label className="text-xs text-gray-600">時刻</Label>
                  <Input
                    value={
                      parsedData.startTime && parsedData.endTime
                        ? `${parsedData.startTime} - ${parsedData.endTime}`
                        : '未設定'
                    }
                    readOnly
                    className={!parsedData.startTime ? 'border-red-300 bg-red-50' : ''}
                  />
                </div>

                <div>
                  <Label className="text-xs text-gray-600">場所</Label>
                  <Input
                    value={
                      parsedData.locationId
                        ? locations.find((l) => l.id === parsedData.locationId)?.name || '未設定'
                        : '未設定'
                    }
                    readOnly
                  />
                </div>

                <div>
                  <Label className="text-xs text-gray-600">参加者</Label>
                  <Input
                    value={
                      parsedData.participants.length > 0
                        ? parsedData.participants.join(', ')
                        : '未設定'
                    }
                    readOnly
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-gray-600">内容</Label>
                <Textarea value={parsedData.description} readOnly rows={2} />
              </div>

              {parsedData.missingFields.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>不足項目:</strong> {parsedData.missingFields.join(', ')}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button onClick={handleSubmit} disabled={!parsedData}>
              スケジュールを作成
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
