import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { NotebookPen, Plus, X, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';
import { useAuthStore } from '../../stores/authStore';
import { getAuthSession, isCurrentAuthSession } from '../../utils/authSession';
import { notepadKeys, useNotepadDrafts, failedNotepadDrafts, flushNotepadSave } from '../../utils/notepadAutosave';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface NotepadSummary {
  id: string;
  title: string;
  order: number;
  updatedAt: string;
}

export const NotepadDropdown: React.FC = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = useAuthStore(state => state.user?.id);
  const session = getAuthSession();
  useNotepadDrafts();
  const failed = failedNotepadDrafts(userId);

  const { data: notepads = [] } = useQuery<NotepadSummary[]>({
    queryKey: notepadKeys.list(userId),
    queryFn: async ({ signal }) => {
      const res = await api.get('/api/me/notepad', { signal, authSession: session });
      return res.data;
    },
    enabled: open && !!userId,
    staleTime: 30_000,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/api/me/notepad', { title: '', content: '' }, { authSession: session });
      return res.data;
    },
    onSuccess: (data) => {
      if (!isCurrentAuthSession(session)) return;
      queryClient.invalidateQueries({ queryKey: notepadKeys.list(userId) });
      setOpen(false);
      navigate(`/notepad/${data.id}`);
    },
    onError: (err: any) => {
      if (!isCurrentAuthSession(session)) return;
      alert(err.response?.data?.error || 'メモの作成に失敗しました');
    },
  });

  // 外側クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative flex items-center gap-1 p-1.5 rounded-lg transition-colors ${
          open
            ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300'
        }`}
        title="メモ帳"
        aria-label="メモ帳"
      >
        <NotebookPen className="h-5 w-5" />
      </button>

      {failed.length > 0 && (
        <div role="alert" className="absolute right-0 top-full z-50 w-72 rounded border border-red-200 bg-white p-2 text-xs text-red-600 dark:bg-gray-800">
          メモの保存に失敗しました
          <button className="ml-2 underline" onClick={() => { failed.forEach(draft => { void flushNotepadSave(draft.userId, draft.id, draft.session, true); }); }}>再試行</button>
        </div>
      )}
      {open && (
        <div className="absolute right-0 top-full mt-1 w-72 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50">
          {/* ヘッダー */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
              <NotebookPen className="h-4 w-4 text-blue-500" />
              メモ帳
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || notepads.length >= 30}
                className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded transition-colors disabled:opacity-50"
                title="新規メモ"
              >
                <Plus className="h-3.5 w-3.5" />
                新規
              </button>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="h-3.5 w-3.5 text-gray-400" />
              </button>
            </div>
          </div>

          {/* メモ一覧 */}
          <div className="max-h-80 overflow-y-auto">
            {notepads.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">メモがありません</p>
                <button
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  最初のメモを作成する
                </button>
              </div>
            ) : (
              <ul className="py-1">
                {notepads.map((note) => (
                  <li key={note.id}>
                    <button
                      onClick={() => { setOpen(false); navigate(`/notepad/${note.id}`); }}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left group"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{note.title}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {format(new Date(note.updatedAt), 'M/d HH:mm', { locale: ja })}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* フッター */}
          {notepads.length > 0 && (
            <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-xs text-gray-400">{notepads.length} / 30 ページ</span>
              <button
                onClick={() => { setOpen(false); navigate('/notepad'); }}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                一覧を見る
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
