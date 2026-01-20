import React, { useState, useEffect } from 'react';
import { X, FileDown } from 'lucide-react';
import { api } from '../../utils/api';
import { WeeklyReport, Schedule } from '../../types';
import { getWeekString, parseWeekString, formatDate } from '../../utils/date';
import { startOfWeek, endOfWeek, addWeeks, subWeeks, format } from 'date-fns';
import { ja } from 'date-fns/locale/ja';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { SimpleRichTextEditor } from '../editor/SimpleRichTextEditor';
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
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [showPDFConfirm, setShowPDFConfirm] = useState(false);
  const { user } = useAuthStore();
  
  // 作成者のみ編集可能
  const canEdit = !report || (user && report.user?.id === user.id);

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
      const initialWeek = getWeekString();
      setWeek(initialWeek);
      setCurrentReport(null);
    }
  }, [report]);

  // 新規作成時または週が変更された時にスケジュールから自動取得
  useEffect(() => {
    if (!report && week && user) {
      loadSchedulesForTemplate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week, user]);

  // スケジュールからテンプレートを自動取得
  const loadSchedulesForTemplate = async () => {
    if (!user || !week) return;
    
    try {
      setLoadingSchedules(true);
      
      // 対象週の開始日と終了日を取得
      const weekStart = parseWeekString(week);
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 }); // 月曜始まり
      
      // 先週（振り返り用）
      const lastWeekStart = subWeeks(weekStart, 1);
      const lastWeekEnd = endOfWeek(lastWeekStart, { weekStartsOn: 1 });
      
      // 来週（予定用）
      const nextWeekStart = addWeeks(weekStart, 1);
      const nextWeekEnd = endOfWeek(nextWeekStart, { weekStartsOn: 1 });
      
      // 先週のスケジュールを取得（活動内容）
      const lastWeekResponse = await api.get<Schedule[]>(`/api/schedules?userId=${user.id}&startDate=${format(lastWeekStart, 'yyyy-MM-dd')}&endDate=${format(lastWeekEnd, 'yyyy-MM-dd')}`);
      const lastWeekSchedules = lastWeekResponse.data || [];
      
      // 来週のスケジュールを取得（予定）
      const nextWeekResponse = await api.get<Schedule[]>(`/api/schedules?userId=${user.id}&startDate=${format(nextWeekStart, 'yyyy-MM-dd')}&endDate=${format(nextWeekEnd, 'yyyy-MM-dd')}`);
      const nextWeekSchedules = nextWeekResponse.data || [];
      
      // 先週の活動内容をフォーマット（when/where/what/who）
      if (lastWeekSchedules.length > 0 && activities.length === 1 && !activities[0].date && !activities[0].activity) {
        const formattedActivities = lastWeekSchedules.map(schedule => {
          const date = formatDate(new Date(schedule.date), 'M月d日');
          const location = schedule.location?.name || schedule.locationText || '';
          const activity = schedule.activityDescription;
          const participants = schedule.scheduleParticipants?.filter(p => p.status === 'APPROVED').map(p => p.user?.name).filter(Boolean).join('、') || '';
          
          // 「◯月◯日/場所/何をした/誰と」の形式
          let activityText = `${date}`;
          if (location) activityText += `/${location}`;
          activityText += `/${activity}`;
          if (participants) activityText += `/${participants}`;
          
          return {
            date: formatDate(new Date(schedule.date), 'yyyy-MM-dd'),
            activity: activityText
          };
        });
        
        setActivities(formattedActivities.length > 0 ? formattedActivities : [{ date: '', activity: '' }]);
      }
      
      // 来週の予定をフォーマット
      if (nextWeekSchedules.length > 0 && !nextWeekPlan) {
        const formattedPlan = nextWeekSchedules.map(schedule => {
          const date = formatDate(new Date(schedule.date), 'M月d日');
          const time = schedule.startTime && schedule.endTime 
            ? `${schedule.startTime}〜${schedule.endTime}`
            : schedule.startTime || '';
          const location = schedule.location?.name || schedule.locationText || '';
          const activity = schedule.activityDescription;
          
          return `${date}${time ? ` ${time}` : ''}${location ? ` @${location}` : ''} ${activity}`;
        }).join('\n');
        
        setNextWeekPlan(formattedPlan);
      }
    } catch (error) {
      console.error('Failed to load schedules for template:', error);
    } finally {
      setLoadingSchedules(false);
    }
  };

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
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700 flex-shrink-0">
          <h2 className="text-2xl font-bold dark:text-gray-100">
            {currentReport ? '週次報告' : '週次報告作成'}
          </h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* タブ切り替え（既存報告がある場合のみ表示） */}
        {currentReport && (
          <div className="flex border-b dark:border-gray-700 flex-shrink-0">
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

        <div className="flex-1 overflow-y-auto min-h-0">
          {viewMode === 'preview' && previewReport ? (
            <div className="p-4 bg-gray-100 dark:bg-gray-900 flex justify-center">
              <div className="shadow-lg">
                <WeeklyReportPreview report={previewReport} />
              </div>
            </div>
          ) : (
            <form onSubmit={(e) => handleSubmit(e, false)} className="p-6 space-y-6 pb-0">
              {!canEdit && (
                <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 rounded-lg text-sm">
                  この報告は作成者のみが編集できます。
                </div>
              )}
              {loadingSchedules && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm">
                  スケジュールから活動内容と予定を自動取得中...
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  対象週
                </label>
                {week && (() => {
                  try {
                    const weekStart = parseWeekString(week);
                    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
                    const weekRange = `${format(weekStart, 'yyyy年M月d日', { locale: ja })} 〜 ${format(weekEnd, 'M月d日', { locale: ja })}`;
                    return (
                      <div className="text-sm text-gray-900 dark:text-gray-100 mb-2">
                        {weekRange}
                      </div>
                    );
                  } catch (error) {
                    return (
                      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        {week}
                      </div>
                    );
                  }
                })()}
                <Input
                  type="week"
                  value={week}
                  onChange={(e) => setWeek(e.target.value)}
                  required
                  disabled={!canEdit}
                  className="hidden"
                />
                {canEdit && (
                  <Input
                    type="week"
                    value={week}
                    onChange={(e) => setWeek(e.target.value)}
                    required
                    className="mt-1"
                  />
                )}
              </div>
              
              {!report && canEdit && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={loadSchedulesForTemplate}
                    disabled={loadingSchedules}
                  >
                    {loadingSchedules ? '取得中...' : 'スケジュールから自動取得'}
                  </Button>
                </div>
              )}

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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  備考
                </label>
                <SimpleRichTextEditor
                  value={note}
                  onChange={setNote}
                  placeholder="備考を入力..."
                />
              </div>

            </form>
          )}
        </div>

        {/* フッター固定 */}
        {viewMode === 'edit' && (
          <div className="flex justify-end space-x-3 p-6 border-t dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800">
            <Button type="button" variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button 
              type="button" 
              onClick={(e) => {
                e.preventDefault();
                const form = document.querySelector('form');
                if (form) {
                  const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                  form.dispatchEvent(submitEvent);
                }
              }}
              disabled={loading}
            >
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
        )}
        {viewMode === 'preview' && previewReport && (
          <div className="flex justify-between items-center p-6 border-t dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800">
            <div>
              {canEdit && (
                <Button type="button" variant="outline" onClick={() => setViewMode('edit')}>
                  編集
                </Button>
              )}
            </div>
            <div className="flex space-x-3">
              <Button type="button" variant="outline" onClick={() => setShowPDFConfirm(true)}>
                <FileDown className="w-4 h-4 mr-2" />
                PDF出力
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                閉じる
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* PDF出力確認ダイアログ */}
      {showPDFConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full m-4 p-6">
            <h3 className="text-xl font-bold dark:text-gray-100 mb-4">
              ローカルに保存しますか？
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              PDFファイルをローカルPCに保存します。
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowPDFConfirm(false)}>
                キャンセル
              </Button>
              <Button onClick={handleDownloadPDF}>
                OK
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
