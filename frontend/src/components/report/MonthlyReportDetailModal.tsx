import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, FileDown, Edit2, History, Save, Trash2, Eye } from 'lucide-react';
import { api } from '../../utils/api';
import { format } from 'date-fns';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuthStore } from '../../stores/authStore';
import { Input } from '../common/Input';
import { SimpleRichTextEditor } from '../editor/SimpleRichTextEditor';
import { MonthlyReportPreview } from './MonthlyReportPreview';

interface MonthlyReport {
  id: string;
  month: string;
  coverRecipient: string;
  coverSender: string;
  memberSheets: any[];
  supportRecords: Array<{
    id: string;
    supportDate: string;
    supportContent: string;
    supportBy: string;
    user: {
      id: string;
      name: string;
    };
  }>;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    name: string;
  };
  revisions?: Array<{
    id: string;
    changedBy: string;
    changer: {
      id: string;
      name: string;
    };
    changes: any;
    reason: string | null;
    createdAt: string;
  }>;
}

interface MonthlyReportDetailModalProps {
  reportId: string;
  onClose: () => void;
  onEdit?: () => void;
  onUpdated?: () => void;
  viewMode?: 'edit' | 'preview'; // 表示モード（デフォルトはedit）
}

export const MonthlyReportDetailModal: React.FC<MonthlyReportDetailModalProps> = ({
  reportId,
  onClose,
  onEdit,
  onUpdated,
  viewMode: initialViewMode = 'edit',
}) => {
  const { user } = useAuthStore();
  const [showRevisions, setShowRevisions] = useState(false);
  const [isEditing, setIsEditing] = useState(initialViewMode === 'edit'); // 初期表示モードに応じて設定
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>(initialViewMode);
  const [coverRecipient, setCoverRecipient] = useState('');
  const [coverSender, setCoverSender] = useState('');
  const [memberSheets, setMemberSheets] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: report, isLoading, refetch, error } = useQuery<MonthlyReport>({
    queryKey: ['monthly-report', reportId],
    queryFn: async () => {
      try {
        const response = await api.get(`/api/monthly-reports/${reportId}`);
        return response.data;
      } catch (err: any) {
        console.error('Failed to fetch monthly report:', err);
        // エラーが発生した場合でもモーダルを開く（空のデータで）
        return null;
      }
    },
    retry: false,
  });

  useEffect(() => {
    if (report) {
      setCoverRecipient(report.coverRecipient);
      setCoverSender(report.coverSender);
      setMemberSheets(report.memberSheets || []);
    }
  }, [report]);

  const downloadPDF = async () => {
    try {
      const response = await api.get(`/api/monthly-reports/${reportId}/pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `月次報告_${report?.month}.pdf`);
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      link.remove();
    } catch (error) {
      console.error('PDF download failed:', error);
      alert('PDF出力に失敗しました');
    }
  };

  const queryClient = useQueryClient();
  const canEdit = user?.role === 'MASTER' || (!report?.submittedAt && (user?.role === 'SUPPORT' || user?.role === 'MASTER'));
  const canDelete = user?.role === 'SUPPORT' || user?.role === 'MASTER';

  const handleSave = async () => {
    if (!report) return;
    setSaving(true);
    try {
      await api.put(`/api/monthly-reports/${reportId}`, {
        coverRecipient,
        coverSender,
        memberSheets,
      });
      setIsEditing(false);
      refetch();
      if (onUpdated) onUpdated();
      queryClient.invalidateQueries({ queryKey: ['monthly-reports'] });
    } catch (error: any) {
      console.error('Failed to save monthly report:', error);
      alert(`保存に失敗しました: ${error?.response?.data?.error || error?.message || '不明なエラー'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!report) return;
    if (!confirm('この月次報告を削除しますか？')) return;
    
    try {
      await api.delete(`/api/monthly-reports/${reportId}`);
      queryClient.invalidateQueries({ queryKey: ['monthly-reports'] });
      onClose();
    } catch (error: any) {
      console.error('Failed to delete monthly report:', error);
      alert(`削除に失敗しました: ${error?.response?.data?.error || error?.message || '不明なエラー'}`);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (!report && !isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-[210mm] w-full m-4 max-h-[90vh] overflow-y-auto" style={{ width: '210mm', maxWidth: '210mm' }}>
          <div className="flex justify-between items-center p-6 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
            <h2 className="text-2xl font-bold dark:text-gray-100">月次報告</h2>
            <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="p-6 space-y-6">
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <p>月次報告のデータが見つかりませんでした。</p>
              <p className="text-sm mt-2">新しい月次報告を作成してください。</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // プレビュー用の報告データを作成（編集中のデータも反映）
  const previewReport: MonthlyReport | null = report ? {
    ...report,
    coverRecipient,
    coverSender,
    memberSheets,
  } : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-[210mm] max-h-[95vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-2xl font-bold dark:text-gray-100">{report?.month || ''} 月次報告</h2>
          <div className="flex items-center gap-2">
            {/* タブ切り替え（既存報告がある場合のみ表示） */}
            {report && (
              <>
                <button
                  onClick={() => {
                    setViewMode('edit');
                    setIsEditing(true);
                  }}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors rounded ${
                    viewMode === 'edit'
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  編集
                </button>
                <button
                  onClick={() => {
                    setViewMode('preview');
                    setIsEditing(false);
                  }}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors rounded ${
                    viewMode === 'preview'
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  プレビュー
                </button>
              </>
            )}
            {canEdit && !isEditing && viewMode === 'edit' && (
              <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                <Edit2 className="h-4 w-4 mr-1" />
                編集
              </Button>
            )}
            {isEditing && (
              <Button onClick={handleSave} variant="primary" size="sm" disabled={saving}>
                <Save className="h-4 w-4 mr-1" />
                {saving ? '保存中...' : '保存'}
              </Button>
            )}
            {isEditing && (
              <Button onClick={() => {
                setIsEditing(false);
                if (report) {
                  setCoverRecipient(report.coverRecipient);
                  setCoverSender(report.coverSender);
                  setMemberSheets(report.memberSheets || []);
                }
              }} variant="outline" size="sm">
                キャンセル
              </Button>
            )}
            <Button onClick={downloadPDF} variant="outline" size="sm">
              <FileDown className="h-4 w-4 mr-1" />
              PDF出力
            </Button>
            {canDelete && (
              <Button onClick={handleDelete} variant="outline" size="sm">
                <Trash2 className="h-4 w-4 mr-1" />
                削除
              </Button>
            )}
            {report && report.revisions && report.revisions.length > 0 && (
              <Button
                onClick={() => setShowRevisions(!showRevisions)}
                variant="outline"
                size="sm"
              >
                <History className="h-4 w-4 mr-1" />
                変更履歴
              </Button>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {viewMode === 'preview' && previewReport ? (
            <div className="p-4 bg-gray-100 dark:bg-gray-900 flex justify-center">
              <div className="shadow-lg">
                <MonthlyReportPreview report={previewReport} />
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6">
          {report && showRevisions && report.revisions && report.revisions.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-bold text-lg mb-3">変更履歴</h3>
              <div className="space-y-3">
                {report.revisions.map((revision) => (
                  <div key={revision.id} className="border-l-4 border-yellow-400 pl-3">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium">{revision.changer.name}</span>
                      <span className="text-sm text-gray-600">
                        {format(new Date(revision.createdAt), 'yyyy年M月d日 H:mm')}
                      </span>
                    </div>
                    {revision.reason && (
                      <p className="text-sm text-gray-700 mb-1">理由: {revision.reason}</p>
                    )}
                    <pre className="text-xs text-gray-600 bg-white p-2 rounded overflow-auto">
                      {JSON.stringify(revision.changes, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium text-gray-700">作成者:</span>
              <p className="text-gray-900">{report.creator.name}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">作成日:</span>
              <p className="text-gray-900">{format(new Date(report.createdAt), 'yyyy年M月d日')}</p>
            </div>
            {report.submittedAt && (
              <div>
                <span className="text-sm font-medium text-gray-700">提出日:</span>
                <p className="text-gray-900">{format(new Date(report.submittedAt), 'yyyy年M月d日')}</p>
              </div>
            )}
          </div>

          {isEditing && (
            <div className="space-y-4 border-t pt-4">
              <Input
                label="宛先"
                value={coverRecipient}
                onChange={(e) => setCoverRecipient(e.target.value)}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  差出人
                </label>
                <textarea
                  value={coverSender}
                  onChange={(e) => setCoverSender(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>
          )}

          {!isLoading && report && !isEditing && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">宛先:</span>
                <p className="text-gray-900 dark:text-gray-100">{report.coverRecipient || '未設定'}</p>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">差出人:</span>
                <p className="text-gray-900 dark:text-gray-100 whitespace-pre-line">{report.coverSender || '未設定'}</p>
              </div>
            </div>
          )}

          {report && (
            <div>
              <h3 className="font-bold text-lg mb-3 dark:text-gray-100">支援内容</h3>
              {report.supportRecords && report.supportRecords.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">支援記録がありません</p>
              ) : (
                <div className="space-y-3">
                  {report.supportRecords?.map((record) => (
                    <div key={record.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-medium dark:text-gray-100">{record.user.name}</span>
                          <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                            {format(new Date(record.supportDate), 'M月d日')}
                          </span>
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{record.supportBy}</span>
                      </div>
                      <div
                        className="text-gray-900 dark:text-gray-100 prose max-w-none dark:prose-invert"
                        dangerouslySetInnerHTML={{ __html: record.supportContent }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <h3 className="font-bold text-lg mb-3 dark:text-gray-100">隊員別シート</h3>
            {Array.isArray(memberSheets) && memberSheets.length > 0 ? (
              <div className="space-y-4">
                {memberSheets.map((sheet: any, index: number) => (
                  <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50">
                    <h4 className="font-medium mb-2 dark:text-gray-100">{sheet.userName}</h4>
                    {isEditing ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            今月の活動
                          </label>
                          <SimpleRichTextEditor
                            value={sheet.thisMonthActivities ? sheet.thisMonthActivities.map((a: any) => `${a.date}: ${a.description}`).join('\n') : ''}
                            onChange={(value) => {
                              const newSheets = [...memberSheets];
                              newSheets[index] = {
                                ...sheet,
                                thisMonthActivities: value.split('\n').filter(v => v.trim()).map(line => {
                                  const match = line.match(/^(.+?):\s*(.+)$/);
                                  if (match) {
                                    return { date: match[1], description: match[2] };
                                  }
                                  return { date: '', description: line };
                                }),
                              };
                              setMemberSheets(newSheets);
                            }}
                            placeholder="活動内容を入力..."
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            来月の予定
                          </label>
                          <textarea
                            value={sheet.nextMonthPlan || ''}
                            onChange={(e) => {
                              const newSheets = [...memberSheets];
                              newSheets[index] = {
                                ...sheet,
                                nextMonthPlan: e.target.value,
                              };
                              setMemberSheets(newSheets);
                            }}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            業務上の質問・相談
                          </label>
                          <textarea
                            value={sheet.workQuestions || ''}
                            onChange={(e) => {
                              const newSheets = [...memberSheets];
                              newSheets[index] = {
                                ...sheet,
                                workQuestions: e.target.value,
                              };
                              setMemberSheets(newSheets);
                            }}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            生活面の備考
                          </label>
                          <textarea
                            value={sheet.lifeNotes || ''}
                            onChange={(e) => {
                              const newSheets = [...memberSheets];
                              newSheets[index] = {
                                ...sheet,
                                lifeNotes: e.target.value,
                              };
                              setMemberSheets(newSheets);
                            }}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        {sheet.thisMonthActivities && sheet.thisMonthActivities.length > 0 && (
                          <div className="mb-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">今月の活動:</span>
                            <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 ml-2">
                              {sheet.thisMonthActivities.map((activity: any, i: number) => (
                                <li key={i}>
                                  {activity.date}: {activity.description}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {sheet.nextMonthPlan && (
                          <div className="mb-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">来月の予定:</span>
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line ml-2">{sheet.nextMonthPlan}</p>
                          </div>
                        )}
                        {sheet.workQuestions && (
                          <div className="mb-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">業務上の質問・相談:</span>
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line ml-2">{sheet.workQuestions}</p>
                          </div>
                        )}
                        {sheet.lifeNotes && (
                          <div className="mb-2">
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">生活面の備考:</span>
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line ml-2">{sheet.lifeNotes}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">隊員別シートがありません</p>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

