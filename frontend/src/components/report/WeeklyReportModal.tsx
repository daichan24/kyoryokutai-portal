import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../../utils/api';
import { WeeklyReport } from '../../types';
import { getWeekString } from '../../utils/date';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { WeeklyReportPreview } from './WeeklyReportPreview';

interface WeeklyReportModalProps {
  report?: WeeklyReport | null;
  onClose: () => void;
  onSaved: () => void;
  viewMode?: 'edit' | 'preview'; // 表示モード（デフォルトはedit）
}

export const WeeklyReportModal: React.FC<WeeklyReportModalProps> = ({
  report,
  onClose,
  onSaved,
  viewMode: initialViewMode = 'edit',
}) => {
  const [week, setWeek] = useState('');
  const [activities, setActivities] = useState<Array<{ date: string; activity: string }>>([
    { date: '', activity: '' },
  ]);
  const [nextWeekPlan, setNextWeekPlan] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentReport, setCurrentReport] = useState<WeeklyReport | null>(report || null);
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>(initialViewMode);

  useEffect(() => {
    if (report) {
      setCurrentReport(report);
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
      setCurrentReport(null);
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

      let savedReport: WeeklyReport;
      if (currentReport) {
        const response = await api.put(`/api/weekly-reports/${currentReport.id}`, data);
        savedReport = response.data;
      } else {
        const response = await api.post('/api/weekly-reports', data);
        savedReport = response.data;
      }

      setCurrentReport(savedReport);
      
      // 提出した場合は自動的にプレビューに切り替え
      if (submit) {
        setViewMode('preview');
      }

      onSaved();
    } catch (error) {
      console.error('Failed to save report:', error);
      alert('保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // プレビュー用の報告データを作成（編集中のデータも反映）
  const previewReport: WeeklyReport | null = currentReport ? {
    ...currentReport,
    week,
    thisWeekActivities: activities.filter((a) => a.date && a.activity),
    nextWeekPlan,
    note,
  } : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-[210mm] max-h-[95vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-2xl font-bold dark:text-gray-100">
            {currentReport ? '週次報告' : '週次報告作成'}
          </h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* タブ切り替え（既存報告がある場合のみ表示） */}
        {currentReport && (
          <div className="flex border-b dark:border-gray-700">
            <button
              onClick={() => setViewMode('edit')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                viewMode === 'edit'
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              編集
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                viewMode === 'preview'
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              プレビュー
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {viewMode === 'preview' && previewReport ? (
            <div className="p-4 bg-gray-100 dark:bg-gray-900 flex justify-center">
              <div className="shadow-lg">
                <WeeklyReportPreview report={previewReport} />
              </div>
            </div>
          ) : (
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    今週の活動 <span className="text-error dark:text-red-400">*</span>
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
                        className="flex-1 px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  来週の予定
                </label>
                <textarea
                  value={nextWeekPlan}
                  onChange={(e) => setNextWeekPlan(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  備考
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t dark:border-gray-700">
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
          )}
        </div>
      </div>
    </div>
  );
};
