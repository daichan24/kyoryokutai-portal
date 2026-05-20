import React, { useState, useEffect } from 'react';
import { X, FileDown } from 'lucide-react';
import { api } from '../../utils/api';
import { WeeklyReport, Schedule } from '../../types';
import { getWeekString, parseWeekString, formatDate, formatTime } from '../../utils/date';
import { endOfWeek, addWeeks, format } from 'date-fns';
import { ja } from 'date-fns/locale/ja';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { SimpleRichTextEditor } from '../editor/SimpleRichTextEditor';
import { WeeklyReportPreview } from './WeeklyReportPreview';
import { useIsMobileBreakpoint } from '../../hooks/useIsMobileBreakpoint';

interface WeeklyReportModalProps {
  report?: WeeklyReport | null;
  initialWeek?: string;
  onClose: () => void;
  onSaved: () => void;
  viewMode?: 'edit' | 'preview'; // 表示モード（デフォルトはedit）
}

export const WeeklyReportModal: React.FC<WeeklyReportModalProps> = ({
  report,
  initialWeek,
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
  const [unlinkedGoogleSchedulesCount, setUnlinkedGoogleSchedulesCount] = useState(0);
  const [showPDFConfirm, setShowPDFConfirm] = useState(false);
  const { user } = useAuthStore();
  const isMobile = useIsMobileBreakpoint();

  // 作成者のみ編集可能
  const canEdit = !report || (user && report.user?.id === user.id);

  const formatScheduleForActivity = (schedule: Schedule) => {
    const dateValue = schedule.startDate || schedule.date;
    const date = formatDate(new Date(dateValue), 'M月d日');
    const time = schedule.startTime && schedule.endTime
      ? `${formatTime(schedule.startTime)}〜${formatTime(schedule.endTime)}`
      : schedule.startTime ? formatTime(schedule.startTime) : '';
    const title = schedule.title || schedule.activityDescription || '予定';
    const location = schedule.location?.name || schedule.locationText || '';
    const projectName = schedule.project?.projectName;
    const taskTitle = schedule.task?.title;
    const participants = schedule.scheduleParticipants
      ?.filter(p => p.status === 'APPROVED')
      .map(p => p.user?.name)
      .filter(Boolean)
      .join('、') || '';

    const parts = [
      `${date}${time ? ` ${time}` : ''}`,
      projectName ? `プロジェクト: ${projectName}` : null,
      taskTitle ? `タスク: ${taskTitle}` : null,
      location ? `場所: ${location}` : null,
      `内容: ${title}`,
      participants ? `共同: ${participants}` : null,
    ].filter(Boolean);

    return parts.join(' / ');
  };

  const handleDownloadPDF = async () => {
    if (!report || !user) return;
    
    try {
      const response = await api.get(`/api/weekly-reports/${report.userId}/${report.week}/pdf`, {
        responseType: 'blob'
      });
      
      // エラーレスポンスのチェック
      if (response.data instanceof Blob && response.data.type === 'application/json') {
        const text = await response.data.text();
        const errorData = JSON.parse(text);
        throw new Error(errorData.error || 'PDF出力に失敗しました');
      }
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `週次報告_${report.week}.pdf`);
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      link.remove();
      setShowPDFConfirm(false);
    } catch (error: unknown) {
      console.error('PDF download failed:', error);
      const apiError = error as { response?: { data?: { error?: string } } };
      const errorMessage =
        apiError.response?.data?.error ||
        (error instanceof Error ? error.message : null) ||
        'PDF出力に失敗しました';
      alert(errorMessage);
      setShowPDFConfirm(false);
    }
  };

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
      setWeek(initialWeek || getWeekString());
      setCurrentReport(null);
    }
  }, [report, initialWeek]);

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
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
      
      // 来週（予定用）
      const nextWeekStart = addWeeks(weekStart, 1);
      const nextWeekEnd = endOfWeek(nextWeekStart, { weekStartsOn: 1 });
      
      // 対象週のスケジュールを取得（活動内容）
      const weekResponse = await api.get<Schedule[]>(`/api/schedules?userId=${user.id}&startDate=${format(weekStart, 'yyyy-MM-dd')}&endDate=${format(weekEnd, 'yyyy-MM-dd')}&reportable=true`);
      const weekSchedules = weekResponse.data || [];

      const unlinkedResponse = await api.get<Schedule[]>(`/api/schedules?userId=${user.id}&startDate=${format(weekStart, 'yyyy-MM-dd')}&endDate=${format(weekEnd, 'yyyy-MM-dd')}&reportable=false`);
      setUnlinkedGoogleSchedulesCount((unlinkedResponse.data || []).filter((schedule) =>
        schedule.googleCalendarEventLink?.origin === 'GOOGLE' && !schedule.projectId
      ).length);
      
      // 来週のスケジュールを取得（予定）
      const nextWeekResponse = await api.get<Schedule[]>(`/api/schedules?userId=${user.id}&startDate=${format(nextWeekStart, 'yyyy-MM-dd')}&endDate=${format(nextWeekEnd, 'yyyy-MM-dd')}&reportable=true`);
      const nextWeekSchedules = nextWeekResponse.data || [];
      
      // 対象週の活動内容をフォーマット
      if (weekSchedules.length > 0 && activities.length === 1 && !activities[0].date && !activities[0].activity) {
        const formattedActivities = weekSchedules.map(schedule => ({
          date: formatDate(new Date(schedule.startDate || schedule.date), 'yyyy-MM-dd'),
          activity: formatScheduleForActivity(schedule),
        }));
        
        setActivities(formattedActivities.length > 0 ? formattedActivities : [{ date: '', activity: '' }]);
      }
      
      // 来週の予定をフォーマット
      if (nextWeekSchedules.length > 0 && !nextWeekPlan) {
        const formattedPlan = nextWeekSchedules.map(formatScheduleForActivity).join('\n');
        
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
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full sm:max-w-[210mm] max-h-[95vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 sm:p-6 border-b dark:border-gray-700 flex-shrink-0">
          <h2 className="text-xl sm:text-2xl font-bold dark:text-gray-100">
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
            <div className="p-4 bg-gray-100 flex justify-center">
              <div className="shadow-lg">
                <WeeklyReportPreview report={previewReport} />
              </div>
            </div>
          ) : (
            <form onSubmit={(e) => handleSubmit(e, false)} className="p-4 sm:p-6 space-y-4 sm:space-y-6 pb-0">
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
              {unlinkedGoogleSchedulesCount > 0 && (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-lg text-sm">
                  Googleから取り込まれた未紐づけ予定が{unlinkedGoogleSchedulesCount}件あります。スケジュール画面でプロジェクトや報告対象を設定すると週次報告に利用できます。
                </div>
              )}
              {!report && initialWeek && (
                <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg text-sm">
                  カレンダーの予定から対象週を引き継いでいます。
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
                    <div key={index} className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 p-3 sm:p-0 border sm:border-0 border-gray-100 dark:border-gray-700 rounded-lg sm:rounded-none">
                      <div className="w-full sm:w-1/3">
                        <Input
                          type="date"
                          value={activity.date}
                          onChange={(e) =>
                            handleActivityChange(index, 'date', e.target.value)
                          }
                          className="w-full"
                          required
                        />
                      </div>
                      <div className="flex-1 flex space-x-2">
                        <input
                          type="text"
                          value={activity.activity}
                          onChange={(e) =>
                            handleActivityChange(index, 'activity', e.target.value)
                          }
                          placeholder="活動内容"
                          className="flex-1 px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 min-w-0"
                          required
                        />
                        {activities.length > 1 && (
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            onClick={() => handleRemoveActivity(index)}
                            className="shrink-0"
                          >
                            削除
                          </Button>
                        )}
                      </div>
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
          <div className="flex flex-wrap justify-end gap-2 sm:gap-3 p-4 sm:p-6 border-t dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800">
            <Button type="button" variant="outline" onClick={onClose} className="order-last sm:order-first w-full sm:w-auto">
              キャンセル
            </Button>
            <div className="flex flex-1 sm:flex-none gap-2 w-full sm:w-auto">
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
                className="flex-1 sm:flex-none"
              >
                {loading ? '保存中...' : '下書き保存'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={(e) => handleSubmit(e, true)}
                disabled={loading}
                className="flex-1 sm:flex-none"
              >
                提出
              </Button>
            </div>
          </div>
        )}
        {viewMode === 'preview' && previewReport && (
          <div className="flex flex-col sm:flex-row justify-between items-center p-4 sm:p-6 gap-4 border-t dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800">
            <div className="w-full sm:w-auto">
              {canEdit && (
                <Button type="button" variant="outline" onClick={() => setViewMode('edit')} className="w-full sm:w-auto">
                  編集再開
                </Button>
              )}
            </div>
            <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2 sm:gap-3">
              {!isMobile ? (
                <Button type="button" variant="outline" onClick={() => setShowPDFConfirm(true)} className="w-full sm:w-auto">
                  <FileDown className="w-4 h-4 mr-2" />
                  PDF出力
                </Button>
              ) : (
                <span className="text-xs text-gray-500 dark:text-gray-400 text-center py-1">PDF出力はPC表示専用です</span>
              )}
              <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
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
