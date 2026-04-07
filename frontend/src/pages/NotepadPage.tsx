import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NotebookPen, Plus, Trash2, ArrowLeft, Save } from 'lucide-react';
import { api } from '../utils/api';
import { SimpleRichTextEditor } from '../components/editor/SimpleRichTextEditor';
import { Button } from '../components/common/Button';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

const MAX_PAGES = 30;
// 日本語3000文字 ≒ HTML込みで余裕を持たせた文字数チェック用
const MAX_CHARS = 3000;

interface NotepadSummary {
  id: string;
  title: string;
  order: number;
  updatedAt: string;
}

interface NotepadDetail extends NotepadSummary {
  content: string;
  createdAt: string;
}

// HTMLタグを除いたテキスト文字数を計算
function countChars(html: string): number {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').length;
}

export const NotepadPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // メモ一覧
  const { data: notepads = [] } = useQuery<NotepadSummary[]>({
    queryKey: ['notepads'],
    queryFn: async () => {
      const res = await api.get('/api/me/notepad');
      return res.data;
    },
  });

  // 選択中のメモ詳細
  const { data: noteDetail } = useQuery<NotepadDetail>({
    queryKey: ['notepad', id],
    queryFn: async () => {
      const res = await api.get(`/api/me/notepad/${id}`);
      return res.data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (noteDetail) {
      setTitle(noteDetail.title);
      setContent(noteDetail.content);
      setCharCount(countChars(noteDetail.content));
      setIsDirty(false);
    }
  }, [noteDetail]);

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/me/notepad', { title: '', content: '' });
      return res.data as NotepadDetail;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['notepads'] });
      navigate(`/notepad/${data.id}`);
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'メモの作成に失敗しました');
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ noteId, t, c }: { noteId: string; t: string; c: string }) => {
      const res = await api.put(`/api/me/notepad/${noteId}`, { title: t, content: c });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notepads'] });
      queryClient.invalidateQueries({ queryKey: ['notepad', id] });
      setIsDirty(false);
      setLastSaved(new Date());
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      await api.delete(`/api/me/notepad/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notepads'] });
      // 削除後は別のメモへ、なければ一覧へ
      const remaining = notepads.filter((n) => n.id !== id);
      if (remaining.length > 0) {
        navigate(`/notepad/${remaining[0].id}`);
      } else {
        navigate('/notepad');
      }
    },
  });

  // 自動保存（2秒後）
  const scheduleAutoSave = useCallback((noteId: string, t: string, c: string) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveMutation.mutate({ noteId, t, c });
    }, 2000);
  }, []);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value);
    setIsDirty(true);
    if (id) scheduleAutoSave(id, e.target.value, content);
  };

  const handleContentChange = (val: string) => {
    const chars = countChars(val);
    if (chars > MAX_CHARS) return; // 超過時は更新しない
    setContent(val);
    setCharCount(chars);
    setIsDirty(true);
    if (id) scheduleAutoSave(id, title, val);
  };

  const handleManualSave = () => {
    if (!id) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    saveMutation.mutate({ noteId: id, t: title, c: content });
  };

  const handleDelete = () => {
    if (!id || !confirm('このメモを削除しますか？')) return;
    deleteMutation.mutate(id);
  };

  // ページ離脱前に保存
  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, []);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* サイドバー: メモ一覧 */}
      <aside className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex flex-col">
        <div className="flex items-center justify-between px-3 py-3 border-b border-gray-200 dark:border-gray-700">
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
            <NotebookPen className="h-4 w-4 text-blue-500" />
            メモ帳
          </span>
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || notepads.length >= MAX_PAGES}
            className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400 disabled:opacity-40 transition-colors"
            title="新規メモ"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {notepads.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">メモがありません</p>
              <button
                onClick={() => createMutation.mutate()}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                作成する
              </button>
            </div>
          ) : (
            notepads.map((note) => (
              <button
                key={note.id}
                onClick={() => navigate(`/notepad/${note.id}`)}
                className={`w-full text-left px-3 py-2 transition-colors ${
                  note.id === id
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-r-2 border-blue-500'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <p className={`text-sm truncate ${note.id === id ? 'font-semibold text-blue-700 dark:text-blue-300' : 'text-gray-800 dark:text-gray-200'}`}>
                  {note.title}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {format(new Date(note.updatedAt), 'M/d HH:mm', { locale: ja })}
                </p>
              </button>
            ))
          )}
        </div>

        <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-400 dark:text-gray-500">{notepads.length} / {MAX_PAGES} ページ</p>
        </div>
      </aside>

      {/* メインエリア */}
      <main className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-gray-800">
        {id && noteDetail ? (
          <>
            {/* ツールバー */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
              <input
                type="text"
                value={title}
                onChange={handleTitleChange}
                placeholder="タイトル（未入力時は自動設定）"
                maxLength={200}
                className="flex-1 text-lg font-semibold bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 mr-4"
              />
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`text-xs ${charCount > MAX_CHARS * 0.9 ? 'text-orange-500' : 'text-gray-400 dark:text-gray-500'}`}>
                  {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
                </span>
                {lastSaved && !isDirty && (
                  <span className="text-xs text-gray-400 dark:text-gray-500 hidden sm:inline">
                    保存済 {format(lastSaved, 'HH:mm')}
                  </span>
                )}
                {isDirty && (
                  <span className="text-xs text-yellow-500 hidden sm:inline">未保存</span>
                )}
                <Button size="sm" onClick={handleManualSave} disabled={saveMutation.isPending || !isDirty}>
                  <Save className="h-3.5 w-3.5 mr-1" />
                  {saveMutation.isPending ? '保存中' : '保存'}
                </Button>
                <button
                  onClick={handleDelete}
                  className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                  title="削除"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* エディタ */}
            <div className="flex-1 overflow-y-auto p-4">
              <SimpleRichTextEditor
                value={content}
                onChange={handleContentChange}
                placeholder="メモを入力してください..."
                minHeight="calc(100vh - 12rem)"
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <NotebookPen className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {notepads.length === 0 ? 'メモがありません' : 'メモを選択してください'}
            </p>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || notepads.length >= MAX_PAGES}>
              <Plus className="h-4 w-4 mr-1" />
              新規メモを作成
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};
