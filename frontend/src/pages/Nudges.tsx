import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { SimpleRichTextEditor } from '../components/editor/SimpleRichTextEditor';
import { Edit, History, X, FileDown, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { useIsMobileBreakpoint } from '../hooks/useIsMobileBreakpoint';

interface NudgeDocument {
  id: string;
  fiscalYear: number;
  title: string;
  content: string;
  publishedAt: string;
  updatedAt: string;
  updatedBy: {
    id: string;
    name: string;
    avatarColor?: string;
  };
}

interface NudgeRevision {
  id: string;
  content: string;
  updatedBy?: {
    id: string;
    name: string;
    avatarColor?: string;
  };
  updater?: {
    id: string;
    name: string;
    avatarColor?: string;
  };
  createdAt: string;
}

export const Nudges: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isMobile = useIsMobileBreakpoint();
  
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [newFiscalYear, setNewFiscalYear] = useState(new Date().getFullYear());

  const canEdit = ['MASTER', 'SUPPORT', 'GOVERNMENT'].includes(user?.role || '');

  // 全年度の細則を取得
  const { data: documents, isLoading } = useQuery<NudgeDocument[]>({
    queryKey: ['nudges'],
    queryFn: async () => {
      const response = await api.get('/api/nudges');
      return response.data;
    },
  });

  // 選択された年度の細則
  const selectedDoc = documents?.find((doc) => doc.fiscalYear === selectedYear);

  // 更新履歴を取得
  const { data: revisions } = useQuery<NudgeRevision[]>({
    queryKey: ['nudges-revisions', selectedYear],
    queryFn: async () => {
      if (!selectedYear) return [];
      const response = await api.get(`/api/nudges/${selectedYear}/revisions`);
      return response.data || [];
    },
    enabled: isHistoryOpen && !!selectedYear,
  });

  // 新規作成
  const createMutation = useMutation({
    mutationFn: async (data: { fiscalYear: number; title: string; content: string }) => {
      return api.post('/api/nudges', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nudges'] });
      setIsCreating(false);
      setTitle('');
      setContent('');
      alert('作成しました');
    },
    onError: (error: any) => {
      console.error('Failed to create nudge:', error);
      alert(error.response?.data?.error || '作成に失敗しました');
    },
  });

  // 更新
  const saveMutation = useMutation({
    mutationFn: async (data: { fiscalYear: number; title: string; content: string }) => {
      return api.put(`/api/nudges/${data.fiscalYear}`, { title: data.title, content: data.content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nudges'] });
      queryClient.invalidateQueries({ queryKey: ['nudges-revisions', selectedYear] });
      setIsEditing(false);
      alert('保存しました');
    },
    onError: (error: any) => {
      console.error('Failed to save nudge:', error);
      alert('保存に失敗しました');
    },
  });

  // 削除
  const deleteMutation = useMutation({
    mutationFn: async (fiscalYear: number) => {
      return api.delete(`/api/nudges/${fiscalYear}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nudges'] });
      setSelectedYear(null);
      alert('削除しました');
    },
    onError: (error: any) => {
      console.error('Failed to delete nudge:', error);
      alert('削除に失敗しました');
    },
  });

  React.useEffect(() => {
    if (selectedDoc && !isEditing) {
      setTitle(selectedDoc.title);
      setContent(selectedDoc.content);
    }
  }, [selectedDoc, isEditing]);

  // 初回表示時に最新年度を選択
  React.useEffect(() => {
    if (documents && documents.length > 0 && !selectedYear) {
      setSelectedYear(documents[0].fiscalYear);
    }
  }, [documents, selectedYear]);

  const handleCreate = () => {
    if (!title.trim() || !content.trim()) {
      alert('タイトルと本文を入力してください');
      return;
    }
    createMutation.mutate({ fiscalYear: newFiscalYear, title: title.trim(), content: content.trim() });
  };

  const handleSave = () => {
    if (!selectedYear || !title.trim() || !content.trim()) {
      alert('タイトルと本文を入力してください');
      return;
    }
    saveMutation.mutate({ fiscalYear: selectedYear, title: title.trim(), content: content.trim() });
  };

  const handleDelete = () => {
    if (!selectedYear) return;
    if (!confirm(`${selectedYear}年度の細則を削除してもよろしいですか？`)) return;
    deleteMutation.mutate(selectedYear);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl whitespace-nowrap font-bold text-gray-900 dark:text-gray-100">協力隊細則</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {canEdit ? '年度ごとの細則を管理できます' : '年度ごとの細則を閲覧できます'}
          </p>
        </div>
        {canEdit && !isCreating && !isEditing && (
          <Button onClick={() => {
            setIsCreating(true);
            setTitle('');
            setContent('');
            setNewFiscalYear(new Date().getFullYear());
          }}>
            <Plus className="w-4 h-4 mr-2" />
            新年度作成
          </Button>
        )}
      </div>

      {/* 年度選択 */}
      {!isCreating && documents && documents.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {documents.map((doc) => (
            <button
              key={doc.fiscalYear}
              onClick={() => {
                setSelectedYear(doc.fiscalYear);
                setIsEditing(false);
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                selectedYear === doc.fiscalYear
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {doc.fiscalYear}年度
            </button>
          ))}
        </div>
      )}

      {/* 新規作成フォーム */}
      {isCreating && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6 max-w-[210mm] mx-auto" style={{ width: '210mm', maxWidth: '210mm' }}>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">新年度の細則を作成</h2>

          <div className="space-y-4">
            <Input
              label="年度"
              type="number"
              value={newFiscalYear}
              onChange={(e) => setNewFiscalYear(parseInt(e.target.value))}
              required
            />

            <Input
              label="タイトル"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                本文 <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <SimpleRichTextEditor
                value={content}
                onChange={setContent}
                placeholder="本文を入力..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setIsCreating(false)}>
              キャンセル
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? '作成中...' : '作成'}
            </Button>
          </div>
        </div>
      )}

      {/* 編集フォーム */}
      {!isCreating && isEditing && selectedDoc && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6 max-w-[210mm] mx-auto" style={{ width: '210mm', maxWidth: '210mm' }}>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {selectedDoc.fiscalYear}年度の細則を編集
          </h2>

          <div className="space-y-4">
            <Input
              label="タイトル"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                本文 <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <SimpleRichTextEditor
                value={content}
                onChange={setContent}
                placeholder="本文を入力..."
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              キャンセル
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>
      )}

      {/* 閲覧表示 */}
      {!isCreating && !isEditing && selectedDoc && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6 max-w-[210mm] mx-auto" style={{ width: '210mm', maxWidth: '210mm' }}>
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{selectedDoc.title}</h2>
              <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                <p>発行日: {format(new Date(selectedDoc.publishedAt), 'yyyy年M月d日')}</p>
                <p>
                  最終更新: {format(new Date(selectedDoc.updatedAt), 'yyyy年M月d日 HH:mm')} by{' '}
                  {selectedDoc.updatedBy.name}
                </p>
              </div>
            </div>
            {canEdit && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setIsHistoryOpen(true)}>
                  <History className="w-4 h-4 mr-2" />
                  履歴
                </Button>
                <Button size="sm" onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  編集
                </Button>
                {user?.role === 'MASTER' && (
                  <Button variant="outline" size="sm" onClick={handleDelete}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    削除
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="prose max-w-none dark:prose-invert">
            <div 
              className="text-gray-700 dark:text-gray-300"
              dangerouslySetInnerHTML={{ __html: selectedDoc.content }}
            />
          </div>
          
          <div className="mt-4 flex justify-end">
            {!isMobile ? (
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    const response = await api.get(`/api/nudges/${selectedDoc.fiscalYear}/pdf`, {
                      responseType: 'blob'
                    });

                    if (response.data.type === 'application/json') {
                      const reader = new FileReader();
                      reader.onload = () => {
                        try {
                          const errorData = JSON.parse(reader.result as string);
                          alert(errorData.error || 'PDF出力に失敗しました');
                        } catch (e) {
                          alert('PDF出力に失敗しました');
                        }
                      };
                      reader.readAsText(response.data);
                      return;
                    }

                    const url = window.URL.createObjectURL(new Blob([response.data]));
                    const link = window.document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', `協力隊細則_${selectedDoc.fiscalYear}年度_${format(new Date(), 'yyyyMMdd')}.pdf`);
                    window.document.body.appendChild(link);
                    link.click();
                    window.URL.revokeObjectURL(url);
                    link.remove();
                  } catch (error: any) {
                    console.error('PDF download failed:', error);
                    const errorMessage = error.response?.data?.error || error.message || 'PDF出力に失敗しました';
                    alert(errorMessage);
                  }
                }}
              >
                <FileDown className="w-4 h-4 mr-2" />
                PDF出力
              </Button>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400 text-right">
                PDF出力はパソコン表示のときのみ利用できます。
              </p>
            )}
          </div>
        </div>
      )}

      {/* 文書がない場合 */}
      {!isCreating && !selectedDoc && documents && documents.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6 text-center">
          <p className="text-gray-500 dark:text-gray-400">細則がまだ作成されていません</p>
          {canEdit && (
            <Button onClick={() => setIsCreating(true)} className="mt-4">
              新年度の細則を作成
            </Button>
          )}
        </div>
      )}

      {/* 更新履歴モーダル */}
      {isHistoryOpen && selectedDoc && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setIsHistoryOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full m-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
              <h2 className="text-2xl font-bold dark:text-gray-100">{selectedDoc.fiscalYear}年度 更新履歴</h2>
              <button
                onClick={() => setIsHistoryOpen(false)}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {revisions && revisions.length > 0 ? (
                revisions.map((revision) => (
                  <div key={revision.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                          style={{
                            backgroundColor: (revision.updatedBy || revision.updater)?.avatarColor || '#6B7280',
                          }}
                        >
                          {((revision.updatedBy || revision.updater)?.name || '').charAt(0)}
                        </div>
                        <span className="font-medium dark:text-gray-100">{(revision.updatedBy || revision.updater)?.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {format(new Date(revision.createdAt), 'yyyy年M月d日 HH:mm')}
                        </span>
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (confirm('このバージョンに復元しますか？（現在の内容は新しい履歴として保存されます）')) {
                                saveMutation.mutate({
                                  fiscalYear: selectedDoc.fiscalYear,
                                  title: selectedDoc.title,
                                  content: revision.content
                                });
                                setIsHistoryOpen(false);
                              }
                            }}
                          >
                            この版に戻す
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 prose prose-sm max-w-none dark:prose-invert border-t dark:border-gray-700 pt-3">
                      <div
                        className="text-gray-700 dark:text-gray-300"
                        dangerouslySetInnerHTML={{ __html: revision.content }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 dark:text-gray-400 text-center py-8">更新履歴がありません</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
