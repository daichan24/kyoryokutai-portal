import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { SimpleRichTextEditor } from '../components/editor/SimpleRichTextEditor';
import { Edit, History, X, FileDown } from 'lucide-react';
import { format } from 'date-fns';

interface NudgeDocument {
  id: string;
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
  updatedBy: {
    id: string;
    name: string;
    avatarColor?: string;
  };
  createdAt: string;
}

export const Nudges: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const canEdit = ['MASTER', 'SUPPORT', 'GOVERNMENT'].includes(user?.role || '');

  const { data: document, isLoading } = useQuery<NudgeDocument | null>({
    queryKey: ['nudges'],
    queryFn: async () => {
      const response = await api.get('/api/nudges');
      return response.data;
    },
  });

  const { data: revisions } = useQuery<NudgeRevision[]>({
    queryKey: ['nudges-revisions'],
    queryFn: async () => {
      const response = await api.get('/api/nudges/revisions');
      return response.data || [];
    },
    enabled: isHistoryOpen,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { title: string; content: string }) => {
      return api.put('/api/nudges', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nudges'] });
      queryClient.invalidateQueries({ queryKey: ['nudges-revisions'] });
      setIsEditing(false);
      alert('保存しました');
    },
    onError: (error: any) => {
      console.error('Failed to save nudge:', error);
      alert('保存に失敗しました');
    },
  });

  React.useEffect(() => {
    if (document && !isEditing) {
      setTitle(document.title);
      setContent(document.content);
    }
  }, [document, isEditing]);

  const handleSave = () => {
    if (!title.trim() || !content.trim()) {
      alert('タイトルと本文を入力してください');
      return;
    }
    saveMutation.mutate({ title: title.trim(), content: content.trim() });
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">協力隊細則</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            {canEdit ? '文書を編集できます' : '文書を閲覧できます'}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {!isEditing && (
              <>
                <Button variant="outline" onClick={() => setIsHistoryOpen(true)}>
                  <History className="w-4 h-4 mr-2" />
                  更新履歴
                </Button>
                <Button onClick={() => setIsEditing(true)}>
                  <Edit className="w-4 h-4 mr-2" />
                  編集
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {!document && !isEditing ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6 text-center">
          <p className="text-gray-500 dark:text-gray-400">文書がまだ作成されていません</p>
          {canEdit && (
            <Button onClick={() => setIsEditing(true)} className="mt-4">
              文書を作成
            </Button>
          )}
        </div>
      ) : isEditing ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6 max-w-[210mm] mx-auto" style={{ width: '210mm', maxWidth: '210mm' }}>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            {document ? '文書を編集' : '文書を作成'}
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
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6 max-w-[210mm] mx-auto" style={{ width: '210mm', maxWidth: '210mm' }}>
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{document.title}</h2>
              <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                <p>発行日: {format(new Date(document.publishedAt), 'yyyy年M月d日')}</p>
                <p>
                  最終更新: {format(new Date(document.updatedAt), 'yyyy年M月d日 HH:mm')} by{' '}
                  {document.updatedBy.name}
                </p>
              </div>
            </div>
          </div>

          <div className="prose max-w-none dark:prose-invert">
            <div 
              className="text-gray-700 dark:text-gray-300"
              dangerouslySetInnerHTML={{ __html: document.content }}
            />
          </div>
          
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  const response = await api.get('/api/nudges/pdf', {
                    responseType: 'blob'
                  });
                  
                  // エラーレスポンスのチェック
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
                  const link = document.createElement('a');
                  link.href = url;
                  link.setAttribute('download', `協力隊細則_${format(new Date(), 'yyyyMMdd')}.pdf`);
                  document.body.appendChild(link);
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
          </div>
        </div>
      )}

      {/* 更新履歴モーダル */}
      {isHistoryOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setIsHistoryOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full m-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
              <h2 className="text-2xl font-bold dark:text-gray-100">更新履歴</h2>
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
                            backgroundColor: revision.updatedBy.avatarColor || '#6B7280',
                          }}
                        >
                          {(revision.updatedBy.avatarLetter || revision.updatedBy.name || '').charAt(0)}
                        </div>
                        <span className="font-medium dark:text-gray-100">{revision.updatedBy.name}</span>
                      </div>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {format(new Date(revision.createdAt), 'yyyy年M月d日 HH:mm')}
                      </span>
                    </div>
                    <div className="mt-3 whitespace-pre-wrap text-gray-700 dark:text-gray-300 text-sm">
                      {revision.content}
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

