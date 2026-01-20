import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, FileDown, Edit2, History, Save, Trash2, Eye, Plus } from 'lucide-react';
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

type PageTab = 'cover' | 'member' | 'support' | 'full';

interface SupportRecord {
  id?: string;
  userId: string;
  supportDate: string;
  supportContent: string;
  supportBy: string;
  user?: {
    id: string;
    name: string;
  };
}

export const MonthlyReportDetailModal: React.FC<MonthlyReportDetailModalProps> = ({
  reportId,
  onClose,
  onEdit,
  onUpdated,
  viewMode: initialViewMode = 'edit',
}) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showRevisions, setShowRevisions] = useState(false);
  const [isEditing, setIsEditing] = useState(initialViewMode === 'edit');
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>(initialViewMode);
  const [pageTab, setPageTab] = useState<PageTab>('cover');
  const [selectedMemberIndex, setSelectedMemberIndex] = useState<number>(0);
  const [coverRecipient, setCoverRecipient] = useState('');
  const [coverSender, setCoverSender] = useState('');
  const [memberSheets, setMemberSheets] = useState<any[]>([]);
  const [supportRecords, setSupportRecords] = useState<SupportRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
  const [showPDFConfirm, setShowPDFConfirm] = useState(false);
  const initialDataRef = useRef<{ coverRecipient: string; coverSender: string; memberSheets: any[]; supportRecords: SupportRecord[] } | null>(null);

  const { data: report, isLoading, refetch, error } = useQuery<MonthlyReport>({
    queryKey: ['monthly-report', reportId],
    queryFn: async () => {
      try {
        const response = await api.get(`/api/monthly-reports/${reportId}`);
        return response.data;
      } catch (err: any) {
        console.error('Failed to fetch monthly report:', err);
        return null;
      }
    },
    retry: false,
  });

  // メンバー一覧を取得（支援記録の編集用）
  const { data: members = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['users', 'members'],
    queryFn: async () => {
      const response = await api.get('/api/users');
      return response.data.filter((u: any) => 
        u.role === 'MEMBER' && u.name !== 'さとうだいち'
      ).sort((a: any, b: any) => {
        const orderA = a.displayOrder || 0;
        const orderB = b.displayOrder || 0;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        return (a.name || '').localeCompare(b.name || '');
      });
    },
    enabled: !!report,
  });

  // テンプレート設定を取得
  const { data: templateSettings } = useQuery({
    queryKey: ['documentTemplates', 'monthlyReport'],
    queryFn: async () => {
      const response = await api.get('/api/document-templates');
      return response.data?.monthlyReport;
    },
    staleTime: Infinity,
  });

  useEffect(() => {
    if (report) {
      const coverRecipientValue = report.coverRecipient || templateSettings?.recipient || '';
      const coverSenderValue = report.coverSender || templateSettings?.sender || '';
      const memberSheetsValue = report.memberSheets || [];
      const supportRecordsValue = (report.supportRecords || []).map((r: any) => ({
        id: r.id,
        userId: r.user.id,
        supportDate: r.supportDate,
        supportContent: r.supportContent,
        supportBy: r.supportBy,
        user: r.user,
      }));

      setCoverRecipient(coverRecipientValue);
      setCoverSender(coverSenderValue);
      setMemberSheets(memberSheetsValue);
      setSupportRecords(supportRecordsValue);

      // 初期データを保存
      initialDataRef.current = {
        coverRecipient: coverRecipientValue,
        coverSender: coverSenderValue,
        memberSheets: JSON.parse(JSON.stringify(memberSheetsValue)),
        supportRecords: JSON.parse(JSON.stringify(supportRecordsValue)),
      };
      setHasUnsavedChanges(false);
    } else if (templateSettings) {
      setCoverRecipient(templateSettings.recipient || '');
      setCoverSender(templateSettings.sender || '');
      setIsEditing(true);
      setViewMode('edit');
    }
  }, [report, templateSettings]);

  // 変更を検知してhasUnsavedChangesを更新
  useEffect(() => {
    if (!initialDataRef.current) return;

    const hasChanges = 
      coverRecipient !== initialDataRef.current.coverRecipient ||
      coverSender !== initialDataRef.current.coverSender ||
      JSON.stringify(memberSheets) !== JSON.stringify(initialDataRef.current.memberSheets) ||
      JSON.stringify(supportRecords) !== JSON.stringify(initialDataRef.current.supportRecords);

    setHasUnsavedChanges(hasChanges);
  }, [coverRecipient, coverSender, memberSheets, supportRecords]);

  const downloadPDF = async () => {
    try {
      const response = await api.get(`/api/monthly-reports/${reportId}/pdf`, {
        responseType: 'blob',
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
      link.setAttribute('download', `月次報告_${report?.month}.pdf`);
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      link.remove();
      setShowPDFConfirm(false);
    } catch (error: any) {
      console.error('PDF download failed:', error);
      const errorMessage = error.response?.data?.error || error.message || 'PDF出力に失敗しました';
      alert(errorMessage);
      setShowPDFConfirm(false);
    }
  };

  const handlePDFButtonClick = () => {
    setShowPDFConfirm(true);
  };

  const canEdit = user?.role === 'MASTER' || (!report?.submittedAt && (user?.role === 'SUPPORT' || user?.role === 'MASTER'));
  const canDelete = user?.role === 'SUPPORT' || user?.role === 'MASTER';

  const handleSave = async () => {
    setSaving(true);
    try {
      if (report) {
        // 月次報告の基本情報を更新
        await api.put(`/api/monthly-reports/${reportId}`, {
          coverRecipient,
          coverSender,
          memberSheets,
        });

        // 支援記録を更新（新規作成、更新、削除）
        const existingRecordIds = new Set((report.supportRecords || []).map((r: any) => r.id));
        const currentRecordIds = new Set(supportRecords.filter(r => r.id).map(r => r.id!));

        // 削除されたレコードを削除
        for (const id of existingRecordIds) {
          if (!currentRecordIds.has(id)) {
            try {
              await api.delete(`/api/support-records/${id}`);
            } catch (error) {
              console.error(`Failed to delete support record ${id}:`, error);
            }
          }
        }

        // 新規作成または更新
        for (const record of supportRecords) {
          const recordData = {
            userId: record.userId,
            supportDate: record.supportDate,
            supportContent: record.supportContent,
            monthlyReportId: reportId,
          };

          if (record.id) {
            // 更新
            try {
              await api.put(`/api/support-records/${record.id}`, recordData);
            } catch (error) {
              console.error(`Failed to update support record ${record.id}:`, error);
            }
          } else {
            // 新規作成
            try {
              const response = await api.post('/api/support-records', recordData);
              // 作成されたレコードのIDを設定
              const newRecord = supportRecords.find(r => !r.id && r.userId === record.userId && r.supportDate === record.supportDate);
              if (newRecord) {
                newRecord.id = response.data.id;
              }
            } catch (error) {
              console.error('Failed to create support record:', error);
            }
          }
        }

        setIsEditing(false);
        setHasUnsavedChanges(false);
        refetch();
        if (onUpdated) onUpdated();
        queryClient.invalidateQueries({ queryKey: ['monthly-reports'] });
        queryClient.invalidateQueries({ queryKey: ['support-records'] });
        alert('保存しました');
      } else {
        console.warn('新規作成は月次報告ページから行ってください');
      }
    } catch (error: any) {
      console.error('Save monthly report error:', error);
      const errorMessage = error.response?.data?.error || error.message || '保存に失敗しました';
      alert(`保存に失敗しました: ${errorMessage}`);
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

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true);
    } else {
      onClose();
    }
  };

  const handleCancel = () => {
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true);
    } else {
      setIsEditing(false);
      if (report && initialDataRef.current) {
        setCoverRecipient(initialDataRef.current.coverRecipient);
        setCoverSender(initialDataRef.current.coverSender);
        setMemberSheets(JSON.parse(JSON.stringify(initialDataRef.current.memberSheets)));
        setSupportRecords(JSON.parse(JSON.stringify(initialDataRef.current.supportRecords)));
      }
    }
  };

  const handleConfirmClose = () => {
    setShowUnsavedDialog(false);
    setHasUnsavedChanges(false);
    onClose();
  };

  const handleCancelClose = () => {
    setShowUnsavedDialog(false);
  };

  // 姓名を分割して表示用にフォーマット
  const formatNameForTab = (name: string) => {
    if (!name || name.length === 0) return name;
    
    // 1文字の場合はそのまま返す
    if (name.length === 1) {
      return name;
    }
    
    // 2文字の場合：姓1文字+名1文字 または 姓2文字
    // 一般的には姓1文字+名1文字が多いので、1文字目で分割
    if (name.length === 2) {
      return (
        <>
          {name.substring(0, 1)}
          <br />
          {name.substring(1)}
        </>
      );
    }
    
    // 3文字の場合：姓1文字+名2文字 または 姓2文字+名1文字
    // 一般的には姓1文字+名2文字が多いので、1文字目で分割
    if (name.length === 3) {
      return (
        <>
          {name.substring(0, 1)}
          <br />
          {name.substring(1)}
        </>
      );
    }
    
    // 4文字以上の場合：姓2文字+名（残り）が一般的
    // 姓は通常1-2文字なので、2文字目で分割
    const surname = name.substring(0, 2);
    const givenName = name.substring(2);
    return (
      <>
        {surname}
        <br />
        {givenName}
      </>
    );
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          <LoadingSpinner />
          <div className="text-center text-gray-700 dark:text-gray-300 mt-4">月次報告を読み込み中...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full m-4 p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold dark:text-gray-100">エラー</h2>
            <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p>月次報告の読み込みに失敗しました。</p>
            <p className="text-sm mt-2">もう一度お試しください。</p>
          </div>
          <div className="flex justify-end">
            <Button onClick={onClose}>閉じる</Button>
          </div>
        </div>
      </div>
    );
  }

  // プレビュー用の報告データを作成
  const previewReport: MonthlyReport | null = report ? {
    ...report,
    coverRecipient,
    coverSender,
    memberSheets,
    supportRecords: supportRecords.map(r => ({
      id: r.id || '',
      supportDate: r.supportDate,
      supportContent: r.supportContent,
      supportBy: r.supportBy,
      user: r.user || members.find(m => m.id === r.userId) || { id: r.userId, name: '' },
    })),
  } : null;

  // 表紙プレビュー用のデータ
  const coverPreviewData = previewReport ? {
    ...previewReport,
    memberSheets: [],
    supportRecords: [],
  } : null;

  // 隊員別シートプレビュー用のデータ（特定の隊員のみ）
  const getMemberPreviewData = (memberIndex: number) => {
    if (!previewReport) return null;
    return {
      ...previewReport,
      coverRecipient: '',
      coverSender: '',
      memberSheets: previewReport.memberSheets.filter((_, i) => i === memberIndex),
      supportRecords: [],
    };
  };

  // 支援記録プレビュー用のデータ
  const supportPreviewData = previewReport ? {
    ...previewReport,
    coverRecipient: '',
    coverSender: '',
    memberSheets: [],
  } : null;

  const renderCoverPage = () => {
    if (viewMode === 'preview' && coverPreviewData) {
      return (
        <div className="p-4 bg-gray-100 dark:bg-gray-900 flex justify-center">
          <div className="shadow-lg">
            <MonthlyReportPreview report={coverPreviewData} />
          </div>
        </div>
      );
    }

    return (
      <div className="p-6 space-y-4">
        {report && (
          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <span className="text-gray-600 dark:text-gray-400">作成者:</span>
              <p className="text-gray-900 dark:text-gray-100">{report.creator.name}</p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">作成日:</span>
              <p className="text-gray-900 dark:text-gray-100">{format(new Date(report.createdAt), 'yyyy年M月d日')}</p>
            </div>
            {report.submittedAt && (
              <div>
                <span className="text-gray-600 dark:text-gray-400">提出日:</span>
                <p className="text-gray-900 dark:text-gray-100">{format(new Date(report.submittedAt), 'yyyy年M月d日')}</p>
              </div>
            )}
          </div>
        )}

        {isEditing ? (
          <div className="space-y-4">
            <Input
              label="宛先"
              value={coverRecipient}
              onChange={(e) => setCoverRecipient(e.target.value)}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                差出人
              </label>
              <SimpleRichTextEditor
                value={coverSender}
                onChange={setCoverSender}
                placeholder="差出人を入力..."
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600 dark:text-gray-400">宛先:</span>
              <p className="text-gray-900 dark:text-gray-100">{report?.coverRecipient || coverRecipient || '未設定'}</p>
            </div>
            <div>
              <span className="text-gray-600 dark:text-gray-400">差出人:</span>
              <div className="text-gray-900 dark:text-gray-100 prose max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: report?.coverSender || coverSender || '未設定' }} />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSingleMemberSheet = (index: number) => {
    if (index < 0 || index >= memberSheets.length) {
      return <div className="p-6 text-gray-500 dark:text-gray-400">隊員が見つかりません</div>;
    }

    const sheet = memberSheets[index];

    if (viewMode === 'preview' && previewReport) {
      const memberPreview = getMemberPreviewData(index);
      if (!memberPreview) return null;
      return (
        <div className="p-4 bg-gray-100 dark:bg-gray-900 flex justify-center">
          <div className="shadow-lg">
            <MonthlyReportPreview report={memberPreview} />
          </div>
        </div>
      );
    }

    return (
      <div className="p-6 space-y-4">
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50">
          <h4 className="font-medium mb-3 dark:text-gray-100">{sheet.userName}</h4>
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  翌月以降の活動予定
                </label>
                <SimpleRichTextEditor
                  value={sheet.nextMonthPlan || ''}
                  onChange={(value) => {
                    const newSheets = [...memberSheets];
                    newSheets[index] = {
                      ...sheet,
                      nextMonthPlan: value,
                    };
                    setMemberSheets(newSheets);
                  }}
                  placeholder="翌月以降の活動予定を入力..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  勤務に関する質問など
                </label>
                <SimpleRichTextEditor
                  value={sheet.workQuestions || ''}
                  onChange={(value) => {
                    const newSheets = [...memberSheets];
                    newSheets[index] = {
                      ...sheet,
                      workQuestions: value,
                    };
                    setMemberSheets(newSheets);
                  }}
                  placeholder="勤務に関する質問・相談を入力..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  生活面の留意事項その他
                </label>
                <SimpleRichTextEditor
                  value={sheet.lifeNotes || ''}
                  onChange={(value) => {
                    const newSheets = [...memberSheets];
                    newSheets[index] = {
                      ...sheet,
                      lifeNotes: value,
                    };
                    setMemberSheets(newSheets);
                  }}
                  placeholder="生活面の留意事項その他を入力..."
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {sheet.thisMonthActivities && sheet.thisMonthActivities.length > 0 && (
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">今月の活動:</span>
                  <ul className="list-disc list-inside text-sm text-gray-700 dark:text-gray-300 ml-2 mt-1">
                    {sheet.thisMonthActivities.map((activity: any, i: number) => (
                      <li key={i}>
                        {activity.date}: {activity.description}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {sheet.nextMonthPlan && (
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">来月の予定:</span>
                  <div className="text-sm text-gray-700 dark:text-gray-300 prose max-w-none dark:prose-invert mt-1" dangerouslySetInnerHTML={{ __html: sheet.nextMonthPlan }} />
                </div>
              )}
              {sheet.workQuestions && (
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">業務上の質問・相談:</span>
                  <div className="text-sm text-gray-700 dark:text-gray-300 prose max-w-none dark:prose-invert mt-1" dangerouslySetInnerHTML={{ __html: sheet.workQuestions }} />
                </div>
              )}
              {sheet.lifeNotes && (
                <div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">生活面の備考:</span>
                  <div className="text-sm text-gray-700 dark:text-gray-300 prose max-w-none dark:prose-invert mt-1" dangerouslySetInnerHTML={{ __html: sheet.lifeNotes }} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderSupportRecords = () => {
    if (viewMode === 'preview' && supportPreviewData) {
      return (
        <div className="p-4 bg-gray-100 dark:bg-gray-900 flex justify-center">
          <div className="shadow-lg">
            <MonthlyReportPreview report={supportPreviewData} />
          </div>
        </div>
      );
    }

    return (
      <div className="p-6 space-y-4">
        {isEditing ? (
          <>
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold dark:text-gray-100">支援記録</h3>
              <Button
                onClick={() => {
                  const newRecord: SupportRecord = {
                    userId: members[0]?.id || '',
                    supportDate: format(new Date(), 'yyyy-MM-dd'),
                    supportContent: '',
                    supportBy: user?.name || '',
                  };
                  setSupportRecords([...supportRecords, newRecord]);
                }}
                variant="outline"
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                追加
              </Button>
            </div>
            <div className="space-y-4">
              {supportRecords.map((record, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        対象者
                      </label>
                      <select
                        value={record.userId}
                        onChange={(e) => {
                          const newRecords = [...supportRecords];
                          newRecords[index] = { ...record, userId: e.target.value };
                          setSupportRecords(newRecords);
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                      >
                        <option value="">選択してください</option>
                        {members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {member.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        支援日
                      </label>
                      <Input
                        type="date"
                        value={record.supportDate}
                        onChange={(e) => {
                          const newRecords = [...supportRecords];
                          newRecords[index] = { ...record, supportDate: e.target.value };
                          setSupportRecords(newRecords);
                        }}
                      />
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      支援内容
                    </label>
                    <SimpleRichTextEditor
                      value={record.supportContent}
                      onChange={(value) => {
                        const newRecords = [...supportRecords];
                        newRecords[index] = { ...record, supportContent: value };
                        setSupportRecords(newRecords);
                      }}
                      placeholder="支援内容を入力..."
                      minHeight="60px"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      onClick={() => {
                        const newRecords = supportRecords.filter((_, i) => i !== index);
                        setSupportRecords(newRecords);
                      }}
                      variant="outline"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      削除
                    </Button>
                  </div>
                </div>
              ))}
              {supportRecords.length === 0 && (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">支援記録がありません。追加ボタンから追加してください。</p>
              )}
            </div>
          </>
        ) : (
          <>
            <h3 className="text-lg font-semibold dark:text-gray-100 mb-4">支援記録</h3>
            {supportRecords.length > 0 ? (
              <div className="space-y-3">
                {supportRecords.map((record, index) => {
                  const member = members.find(m => m.id === record.userId);
                  return (
                    <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-medium dark:text-gray-100">{member?.name || '不明'}</span>
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
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400">支援記録がありません</p>
            )}
          </>
        )}
      </div>
    );
  };

  const renderFullPreview = () => {
    if (!previewReport) return null;
    return (
      <div className="p-4 bg-gray-100 dark:bg-gray-900 flex justify-center">
        <div className="shadow-lg">
          <MonthlyReportPreview report={previewReport} />
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-[210mm] max-h-[95vh] overflow-hidden flex flex-col">
          <div className="flex justify-between items-center p-4 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
            <h2 className="text-xl font-bold dark:text-gray-100">{report?.month || ''} 月次報告</h2>
            <div className="flex items-center gap-2">
              {canEdit && !isEditing && pageTab !== 'full' && (
                <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                  <Edit2 className="h-4 w-4 mr-1" />
                  編集
                </Button>
              )}
              {isEditing && pageTab !== 'full' && (
                <>
                  <Button onClick={handleSave} variant="primary" size="sm" disabled={saving}>
                    <Save className="h-4 w-4 mr-1" />
                    {saving ? '保存中...' : '保存'}
                  </Button>
                  <Button onClick={handleCancel} variant="outline" size="sm">
                    キャンセル
                  </Button>
                </>
              )}
              <Button 
                onClick={() => setPageTab(pageTab === 'full' ? 'cover' : 'full')} 
                variant={pageTab === 'full' ? 'primary' : 'outline'} 
                size="sm"
              >
                <Eye className="h-4 w-4 mr-1" />
                全体プレビュー
              </Button>
              <Button onClick={handlePDFButtonClick} variant="outline" size="sm">
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
              <button onClick={handleClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* ページタブ */}
          <div className="border-b dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-[73px] z-10">
            <div className="flex gap-1 px-4 overflow-x-auto">
              <button
                onClick={() => setPageTab('cover')}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap flex-shrink-0 ${
                  pageTab === 'cover'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                表紙
              </button>
              {memberSheets.length > 0 && memberSheets.map((sheet: any, index: number) => (
                <button
                  key={index}
                  onClick={() => {
                    setPageTab('member');
                    setSelectedMemberIndex(index);
                  }}
                  className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap flex-shrink-0 min-w-[60px] text-center ${
                    pageTab === 'member' && selectedMemberIndex === index
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  {formatNameForTab(sheet.userName || `隊員${index + 1}`)}
                </button>
              ))}
              <button
                onClick={() => setPageTab('support')}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 whitespace-nowrap flex-shrink-0 ${
                  pageTab === 'support'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                支援記録
              </button>
            </div>
          </div>

          {/* 編集/プレビュータブ */}
          {pageTab !== 'full' && (
            <div className="border-b dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-[121px] z-10">
              <div className="flex gap-1 px-4">
                <button
                  onClick={() => {
                    setViewMode('edit');
                    setIsEditing(true);
                  }}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors rounded-t ${
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
                  className={`px-3 py-1.5 text-sm font-medium transition-colors rounded-t ${
                    viewMode === 'preview'
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  プレビュー
                </button>
              </div>
            </div>
          )}

          {/* 変更履歴 */}
          {report && showRevisions && report.revisions && report.revisions.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 m-4">
              <h3 className="font-bold text-lg mb-3 dark:text-gray-100">変更履歴</h3>
              <div className="space-y-3">
                {report.revisions.map((revision) => (
                  <div key={revision.id} className="border-l-4 border-yellow-400 pl-3">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium dark:text-gray-100">{revision.changer.name}</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {format(new Date(revision.createdAt), 'yyyy年M月d日 H:mm')}
                      </span>
                    </div>
                    {revision.reason && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">理由: {revision.reason}</p>
                    )}
                    <pre className="text-xs text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 p-2 rounded overflow-auto">
                      {JSON.stringify(revision.changes, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* コンテンツ */}
          {pageTab === 'full' ? (
            <div className="flex-1 overflow-y-auto">
              {renderFullPreview()}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              {pageTab === 'cover' && renderCoverPage()}
              {pageTab === 'member' && renderSingleMemberSheet(selectedMemberIndex)}
              {pageTab === 'support' && renderSupportRecords()}
            </div>
          )}
        </div>
      </div>

      {/* 未保存の変更がある場合の確認ダイアログ */}
      {showUnsavedDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full m-4 p-6">
            <h3 className="text-lg font-bold dark:text-gray-100 mb-4">保存されていません</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6">
              保存されていない変更があります。閉じますか？
            </p>
            <div className="flex justify-end gap-3">
              <Button onClick={handleCancelClose} variant="outline">
                キャンセル
              </Button>
              <Button onClick={handleConfirmClose} variant="primary">
                OK
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PDF出力確認モーダル */}
      {showPDFConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              ローカルに保存しますか？
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              PDFファイルをローカルPCに保存します。保存先はブラウザの設定に従います。
            </p>
            <div className="flex justify-end space-x-3">
              <Button variant="outline" onClick={() => setShowPDFConfirm(false)}>
                キャンセル
              </Button>
              <Button onClick={downloadPDF}>
                OK
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
