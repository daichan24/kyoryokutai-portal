import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../../utils/api';
import { WeeklyReport } from '../../types';
import { getWeekString } from '../../utils/date';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

interface WeeklyReportModalProps {
  report?: WeeklyReport | null;
  onClose: () => void;
  onSaved: () => void;
}

export const WeeklyReportModal: React.FC<WeeklyReportModalProps> = ({
  report,
  onClose,
  onSaved,
}) => {
  const [week, setWeek] = useState('');
  const [activities, setActivities] = useState<Array<{ date: string; activity: string }>>([
    { date: '', activity: '' },
  ]);
  const [nextWeekPlan, setNextWeekPlan] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (report) {
      setWeek(report.week);
      setActivities(
        Array.isArray(report.thisWeekActivities) && report.thisWeekActivities.length > 0
          ? report.thisWeekActivities
          : [{ date: '', activity: '' }]
      );
      setNextWeekPlan(report.nextWeekPlan || '');
      setNote(report.note || '');
    } else {
      setWeek(getWeekString());
    }
  }, [report]);

  const handleAddActivity = () => {
    setActivities([...activities, { date: '', activity: '' }]);
  };

  const handleRemoveActivity = (index: number) => {
    setActivities(activities.filter((_, i) => i !== index));
  };

  const handleActivityChange = (
    index: number,
    field: 'date' | 'activity',
    value: string
  ) => {
    const newActivities = [...activities];
    newActivities[index][field] = value;
    setActivities(newActivities);
  };

  const handleSubmit = async (e: React.FormEvent, submit: boolean = false) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        week,
        thisWeekActivities: activities.filter((a) => a.date && a.activity),
        nextWeekPlan,
        note,
        submittedAt: submit ? new Date().toISOString() : undefined,
      };

      if (report) {
        await api.put(`/api/weekly-reports/${report.id}`, data);
      } else {
        await api.post('/api/weekly-reports', data);
      }

      onSaved();
    } catch (error) {
      console.error('Failed to save report:', error);
      alert('保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-[210mm] w-full m-4 max-h-[90vh] overflow-y-auto" style={{ width: '210mm', maxWidth: '210mm' }}>
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold">
            {report ? '週次報告編集' : '週次報告作成'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={(e) => handleSubmit(e, false)} className="p-6 space-y-6">
          <Input
            label="週 (YYYY-WW形式)"
            value={week}
            onChange={(e) => setWeek(e.target.value)}
            placeholder="2024-01"
            required
          />

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                今週の活動 <span className="text-error">*</span>
              </label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddActivity}>
                活動を追加
              </Button>
            </div>

            <div className="space-y-3">
              {activities.map((activity, index) => (
                <div key={index} className="flex space-x-2">
                  <Input
                    type="date"
                    value={activity.date}
                    onChange={(e) =>
                      handleActivityChange(index, 'date', e.target.value)
                    }
                    className="w-1/3"
                    required
                  />
                  <input
                    type="text"
                    value={activity.activity}
                    onChange={(e) =>
                      handleActivityChange(index, 'activity', e.target.value)
                    }
                    placeholder="活動内容"
                    className="flex-1 px-3 py-2 border border-border rounded-md"
                    required
                  />
                  {activities.length > 1 && (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => handleRemoveActivity(index)}
                    >
                      削除
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              来週の予定
            </label>
            <textarea
              value={nextWeekPlan}
              onChange={(e) => setNextWeekPlan(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              備考
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-md"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '保存中...' : '下書き保存'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={(e) => handleSubmit(e, true)}
              disabled={loading}
            >
              提出
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
