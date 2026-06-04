import React, { useState, useEffect, useMemo } from 'react';
import { X, FileDown } from 'lucide-react';
import { api } from '../../utils/api';
import { WeeklyReport, Schedule } from '../../types';
import { formatWeekLabel, getWeekString, parseWeekString, normalizeWeekString, toWeekInputValue } from '../../utils/date';
import { endOfWeek, format } from 'date-fns';
import { ja } from 'date-fns/locale/ja';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { WeeklyReportPreview } from './WeeklyReportPreview';
import { useIsMobileBreakpoint } from '../../hooks/useIsMobileBreakpoint';

interface WeeklyReportModalProps {
  report?: WeeklyReport | null;
  initialWeek?: string;
  existingReports?: WeeklyReport[];
  onOpenExisting?: (report: WeeklyReport) => void;
  onClose: () => void;
  onSaved: () => void;
  viewMode?: 'edit' | 'preview'; // 表示モード（デフォルトはedit）
}

export const WeeklyReportModal: React.FC<WeeklyReportModalProps> = ({
  report,
  initialWeek,
  existingReports = [],
  onOpenExisting,
  onClose,
  onSaved,
  viewMode: initialViewMode = 'edit',
}) => {
  const [week, setWeek] = useState('');
  const [activities, setActivities] = useState<WeeklyReport['thisWeekActivities']>([
    { date: '', activity: '' },
  ]);
  const [nextWeekPlan, setNextWeekPlan] = useState('');
  const [reflection, setReflection] = useState('');
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
  const canEdit = !currentReport || Boolean(user && currentReport.user?.id === user.id);
  const canChangeWeek = canEdit && !currentReport?.submittedAt;
  const existingReportByWeek = useMemo(() => {
    const map = new Map<string, WeeklyReport>();
    existingReports.forEach((item) => {
      map.set(normalizeWeekString(item.week), item);
    });
    return map;
  }, [existingReports]);

  const weekOptions = useMemo(() => {
    const options = new Set<string>();
    const currentStart = parseWeekString(getWeekString());
    for (let i = -12; i <= 2; i += 1) {
      const candidate = new Date(currentStart);
      candidate.setDate(currentStart.getDate() + i * 7);
      options.add(getWeekString(candidate));
    }
    existingReports.forEach((item) => options.add(normalizeWeekString(item.week)));
    return Array.from(options)
      .sort((a, b) => parseWeekString(b).getTime() - parseWeekString(a).getTime())
      .map((optionWeek) => {
        const weekStart = parseWeekString(optionWeek);
        const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
        const existing = existingReportByWeek.get(optionWeek);
        const status = existing
          ? existing.approvalStatus === 'APPROVED'
            ? '承認済み'
            : existing.approvalStatus === 'REJECTED'
            ? '差し戻し'
            : existing.submittedAt
            ? '提出済み'
            : '下書き'
          : '未作成';
        return {
          week: optionWeek,
          label: `${formatWeekLabel(optionWeek)}（${format(weekEnd, 'M月d日', { locale: ja })}まで / ${status}）`,
          isCreated: Boolean(existing),
        };
      });
  }, [existingReportByWeek, existingReports]);

  const groupedActivities = useMemo(() => {
    const groups = new Map<string, Array<{ index: number; date: string; activity: string }>>();
    activities.forEach((activity, index) => {
      if (!activity.date && !activity.activity) return;
      const projectName = activity.projectName?.trim() || '未紐づけ';
      if (!groups.has(projectName)) groups.set(projectName, []);
      groups.get(projectName)!.push({ index, date: activity.date, activity: activity.activity });
    });
    return Array.from(groups.entries()).map(([projectName, items]) => ({
      projectName,
      items: items.sort((a, b) => a.date.localeCompare(b.date)),
    }));
  }, [activities]);

  const handleDownloadPDF = async () => {
    const targetReport = currentReport || report;
    if (!targetReport || !user) return;
    
    try {
      const response = await api.get(`/api/weekly-reports/${targetReport.userId}/${targetReport.week}/pdf`, {
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
      link.setAttribute('download', `週次報告_${targetReport.week}.pdf`);
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
    setViewMode(initialViewMode);
  }, [initialViewMode]);

  useEffect(() => {
    if (report) {
      setCurrentReport(report);
      setWeek(normalizeWeekString(report.week));
      setActivities(
        Array.isArray(report.thisWeekActivities) && report.thisWeekActivities.length > 0
          ? report.thisWeekActivities
          : [{ date: '', activity: '' }]
      );
      setNextWeekPlan(report.nextWeekPlan || '');
      setReflection(report.reflection || '');
      setNote(report.note || '');
    } else {
      setWeek(normalizeWeekString(initialWeek || getWeekString()));
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
  const loadSchedulesForTemplate = async (targetWeek = week, replaceExisting = false) => {
    if (!user || !targetWeek) return;
    
    try {
      setLoadingSchedules(true);

      const draftResponse = await api.post<{
        week: string;
        thisWeekActivities: WeeklyReport['thisWeekActivities'];
        nextWeekPlan: string;
        reflection?: string;
        note?: string;
      }>('/api/weekly-reports/draft-preview', { week: normalizeWeekString(targetWeek) });
      const draft = draftResponse.data;

      // 対象週の開始日と終了日を取得
      const weekStart = parseWeekString(draft.week);
      const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

      const unlinkedResponse = await api.get<Schedule[]>(`/api/schedules?userId=${user.id}&startDate=${format(weekStart, 'yyyy-MM-dd')}&endDate=${format(weekEnd, 'yyyy-MM-dd')}&reportable=false`);
      setUnlinkedGoogleSchedulesCount((unlinkedResponse.data || []).filter((schedule) =>
        schedule.googleCalendarEventLink?.origin === 'GOOGLE' && !schedule.projectId
      ).length);

      if (replaceExisting) {
        setActivities(draft.thisWeekActivities.length > 0 ? draft.thisWeekActivities : [{ date: '', activity: '' }]);
      } else if (draft.thisWeekActivities.length > 0 && activities.length === 1 && !activities[0].date && !activities[0].activity) {
        setActivities(draft.thisWeekActivities);
      }

      if (replaceExisting) {
        setNextWeekPlan(draft.nextWeekPlan || '');
      } else if (draft.nextWeekPlan && !nextWeekPlan) {
        setNextWeekPlan(draft.nextWeekPlan);
      }

      if (replaceExisting) {
        setReflection(draft.reflection || '');
      } else if (draft.reflection && !reflection) {
        setReflection(draft.reflection);
      }

      if (replaceExisting) {
        setNote(draft.note || '');
      } else if (draft.note && !note) {
        setNote(draft.note);
      }
    } catch (error) {
      console.error('Failed to load schedules for template:', error);
    } finally {
      setLoadingSchedules(false);
    }
  };

  const handleAddActivity = () => {
    setActivities([...activities, { date: '', activity: '', projectName: '未紐づけ' }]);
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

  const handleWeekChange = (value: string) => {
    const normalized = normalizeWeekString(value);
    const existing = existingReportByWeek.get(normalized);
    if (!currentReport && existing && onOpenExisting) {
      onOpenExisting(existing);
      return;
    }
    setWeek(normalized);
    if (!currentReport) {
      setActivities([{ date: '', activity: '' }]);
      setNextWeekPlan('');
      setReflection('');
      setNote('');
      setUnlinkedGoogleSchedulesCount(0);
    } else if (!currentReport.submittedAt && normalized !== normalizeWeekString(currentReport.week)) {
      setUnlinkedGoogleSchedulesCount(0);
      loadSchedulesForTemplate(normalized, true);
    }
  };

  const handleSubmit = async (e: React.FormEvent, submit: boolean = false) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        week: normalizeWeekString(week),
        thisWeekActivities: activities.filter((a) => a.date && a.activity),
        nextWeekPlan,
        reflection,
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
    reflection,
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
                    const weekRange = `${formatWeekLabel(week)}（${format(weekEnd, 'M月d日', { locale: ja })}まで）`;
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
                {canEdit && (
                  <select
                    value={toWeekInputValue(week)}
                    onChange={(e) => handleWeekChange(e.target.value)}
                    required
                    disabled={!canChangeWeek}
                    className="mt-1 w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    {weekOptions.map((option) => (
                      <option key={option.week} value={toWeekInputValue(option.week)}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    今週の活動 <span className="text-error dark:text-red-400">*</span>
                  </label>
                </div>

                <div className="space-y-4">
                  {groupedActivities.length > 0 ? (
                    groupedActivities.map((group) => (
                      <div key={group.projectName} className="rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                        <div className="bg-gray-50 dark:bg-gray-700/50 px-3 py-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
                          {group.projectName}
                        </div>
                        <div className="divide-y divide-gray-100 dark:divide-gray-700">
                          {group.items.map((activity) => (
                            <div key={activity.index} className="grid grid-cols-1 sm:grid-cols-[160px_1fr_auto] gap-2 p-3">
                              <Input
                                type="date"
                                value={activity.date}
                                onChange={(e) =>
                                  handleActivityChange(activity.index, 'date', e.target.value)
                                }
                                className="w-full"
                                required
                              />
                              <textarea
                                value={activity.activity}
                                onChange={(e) =>
                                  handleActivityChange(activity.index, 'activity', e.target.value)
                                }
                                placeholder="活動内容"
                                rows={2}
                                className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-y"
                                required
                              />
                              {activities.length > 1 && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRemoveActivity(activity.index)}
                                  className="h-10"
                                >
                                  削除
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-4 text-sm text-gray-500 dark:text-gray-400">
                      この週に報告対象の予定がありません。必要な場合は活動を追加してください。
                    </div>
                  )}
                  {canEdit && (
                    <Button type="button" variant="outline" size="sm" onClick={handleAddActivity}>
                      活動を追加
                    </Button>
                  )}
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
                  振り返り・所感
                </label>
                <textarea
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  rows={4}
                  placeholder="今週やってみて感じたこと、気づき、次に活かしたいことなど"
                  className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  備考
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="備考を入力..."
                  rows={4}
                  className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
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
