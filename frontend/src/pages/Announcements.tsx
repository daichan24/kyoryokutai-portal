import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Megaphone, Pencil, Trash2 } from 'lucide-react';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';

interface AnnouncementCategory {
  id: string;
  name: string;
  sortOrder: number;
  colorHex: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AuthorRef {
  id: string;
  name: string;
}

type MemberAnnouncementRow = {
  id: string;
  categoryId: string;
  title: string;
  body: string;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  category: AnnouncementCategory;
  author: AuthorRef;
  confirmTarget: 'ALL' | 'MEMBER';
  isRead: boolean;
};

type StaffAnnouncementRow = {
  id: string;
  categoryId: string;
  title: string;
  body: string;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  category: AnnouncementCategory;
  author: AuthorRef;
  confirmTarget: 'ALL' | 'MEMBER';
  isRead: boolean;
  readCount: number;
  memberCount: number;
};

export const Announcements: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isMember = user?.role === 'MEMBER';
  // 全員が投稿可能
  const canPost = !!user;
  const isStaff = user?.role === 'MASTER' || user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT';

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [confirmTarget, setConfirmTarget] = useState<'ALL' | 'MEMBER'>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editConfirmTarget, setEditConfirmTarget] = useState<'ALL' | 'MEMBER'>('ALL');

  const [catName, setCatName] = useState('');
  const [catSort, setCatSort] = useState(0);
  const [catColor, setCatColor] = useState('#6B7280');

  const { data: categories = [], isLoading: catLoading } = useQuery({
    queryKey: ['announcements', 'categories'],
    queryFn: async () => {
      const r = await api.get<AnnouncementCategory[]>('/api/announcements/categories');
      return r.data || [];
    },
  });

  const { data: listMember = [], isLoading: listMemberLoading } = useQuery({
    queryKey: ['announcements', 'list', 'member'],
    queryFn: async () => {
      const r = await api.get<MemberAnnouncementRow[]>('/api/announcements');
      return r.data || [];
    },
    enabled: isMember,
  });

  const { data: listStaff = [], isLoading: listStaffLoading } = useQuery({
    queryKey: ['announcements', 'list', 'staff'],
    queryFn: async () => {
      const r = await api.get<StaffAnnouncementRow[]>('/api/announcements');
      return r.data || [];
    },
    enabled: !isMember,
  });

  React.useEffect(() => {
    if (categories.length && !categoryId) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  const readMut = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/api/announcements/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['announcements', 'unread-count'] });
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      await api.post('/api/announcements', {
        categoryId,
        title: title.trim(),
        body: body.trim(),
        confirmTarget,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['announcements', 'unread-count'] });
      setTitle('');
      setBody('');
      setConfirmTarget('ALL');
    },
  });

  const patchMut = useMutation({
    mutationFn: async (payload: { id: string; categoryId: string; title: string; body: string; confirmTarget: 'ALL' | 'MEMBER' }) => {
      await api.patch(`/api/announcements/${payload.id}`, {
        categoryId: payload.categoryId,
        title: payload.title,
        body: payload.body,
        confirmTarget: payload.confirmTarget,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements', 'list'] });
      setEditingId(null);
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/announcements/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['announcements', 'unread-count'] });
    },
  });

  const createCatMut = useMutation({
    mutationFn: async () => {
      await api.post('/api/announcements/categories', {
        name: catName.trim(),
        sortOrder: catSort,
        colorHex: catColor || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements', 'categories'] });
      setCatName('');
      setCatSort(0);
      setCatColor('#6B7280');
    },
  });

  const deleteCatMut = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/announcements/categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements', 'categories'] });
      queryClient.invalidateQueries({ queryKey: ['announcements', 'list'] });
    },
  });

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'ja')),
    [categories],
  );

  if (!user) return null;

  if (!isMember && !isStaff) {
    return <p className="text-gray-500 dark:text-gray-400 p-8">この画面を表示する権限がありません。</p>;
  }

  const listLoading = isMember ? listMemberLoading : listStaffLoading;

  const startEdit = (row: StaffAnnouncementRow) => {
    setEditingId(row.id);
    setEditTitle(row.title);
    setEditBody(row.body);
    setEditCategoryId(row.categoryId);
    setEditConfirmTarget(row.confirmTarget || 'ALL');
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Megaphone className="h-7 w-7 text-primary shrink-0" />
          お知らせ
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          全員がお知らせを投稿できます。確認を求める対象を選んで投稿してください。
        </p>
      </div>

      {canPost && (
        <>
          <section className="bg-card dark:bg-gray-800 rounded-lg border border-border dark:border-gray-700 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">新規お知らせ</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">カテゴリ</label>
                <select
                  className="w-full rounded-md border border-border dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={catLoading || !sortedCategories.length}
                >
                  {sortedCategories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">確認を求める対象</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      value="ALL"
                      checked={confirmTarget === 'ALL'}
                      onChange={() => setConfirmTarget('ALL')}
                      className="text-primary"
                    />
                    全員
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      value="MEMBER"
                      checked={confirmTarget === 'MEMBER'}
                      onChange={() => setConfirmTarget('MEMBER')}
                      className="text-primary"
                    />
                    隊員（メンバー）のみ
                  </label>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  通知は全員に届きます。「確認」ボタンが表示されるのは選択した対象のみです。
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">タイトル</label>
                <input
                  type="text"
                  className="w-full rounded-md border border-border dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={400}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">本文</label>
                <textarea
                  className="w-full min-h-[140px] rounded-md border border-border dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>
              <Button
                type="button"
                onClick={() => createMut.mutate()}
                disabled={!categoryId || !title.trim() || !body.trim() || createMut.isPending}
              >
                投稿する
              </Button>
            </div>
          </section>

          {isStaff && (
          <section className="bg-card dark:bg-gray-800 rounded-lg border border-border dark:border-gray-700 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">カテゴリ管理</h2>
            {catLoading ? (
              <LoadingSpinner />
            ) : (
              <>
                <ul className="space-y-2 text-sm">
                  {sortedCategories.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-2 py-2 border-b border-border dark:border-gray-700 last:border-0"
                    >
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: c.colorHex || '#6B7280' }}
                        />
                        {c.name}
                        <span className="text-gray-500 dark:text-gray-400">（順: {c.sortOrder}）</span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-error"
                        onClick={() => {
                          if (window.confirm(`カテゴリ「${c.name}」を削除しますか？`)) {
                            deleteCatMut.mutate(c.id);
                          }
                        }}
                        disabled={deleteCatMut.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2 items-end pt-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">名前</label>
                    <input
                      className="rounded-md border border-border dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm w-40"
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">表示順</label>
                    <input
                      type="number"
                      className="rounded-md border border-border dark:border-gray-600 bg-white dark:bg-gray-900 px-2 py-1.5 text-sm w-20"
                      value={catSort}
                      onChange={(e) => setCatSort(Number(e.target.value))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">色</label>
                    <input
                      type="color"
                      className="h-9 w-12 rounded border border-border cursor-pointer bg-white"
                      value={catColor}
                      onChange={(e) => setCatColor(e.target.value)}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => createCatMut.mutate()}
                    disabled={!catName.trim() || createCatMut.isPending}
                  >
                    カテゴリを追加
                  </Button>
                </div>
              </>
            )}
          </section>
          )}
        </>
      )}

      <section>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">一覧</h2>
        {listLoading ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-4">
            {(isMember ? listMember : listStaff).length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">お知らせはまだありません。</p>
            ) : (
              (isMember ? listMember : listStaff).map((row) => {
                // 自分が確認対象かどうか
                const isConfirmTarget =
                  row.author.id !== user?.id &&
                  (row.confirmTarget === 'ALL' || (row.confirmTarget === 'MEMBER' && isMember));
                const canEdit = row.author.id === user?.id || isStaff;

                return (
                  <article
                    key={row.id}
                    className={`rounded-lg border p-5 space-y-3 ${
                      isConfirmTarget && !row.isRead
                        ? 'bg-card dark:bg-gray-800 border-primary/40 dark:border-primary/50 ring-1 ring-primary/20 shadow-sm'
                        : 'bg-card dark:bg-gray-800 border-border dark:border-gray-700'
                    }`}
                  >
                    {editingId === row.id ? (
                      <div className="space-y-3">
                        <select
                          className="w-full rounded-md border border-border dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                          value={editCategoryId}
                          onChange={(e) => setEditCategoryId(e.target.value)}
                        >
                          {sortedCategories.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        <div className="flex gap-4 text-sm">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" value="ALL" checked={editConfirmTarget === 'ALL'} onChange={() => setEditConfirmTarget('ALL')} />
                            全員
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="radio" value="MEMBER" checked={editConfirmTarget === 'MEMBER'} onChange={() => setEditConfirmTarget('MEMBER')} />
                            隊員のみ
                          </label>
                        </div>
                        <input
                          className="w-full rounded-md border border-border dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                        />
                        <textarea
                          className="w-full min-h-[100px] rounded-md border border-border dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
                          value={editBody}
                          onChange={(e) => setEditBody(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() =>
                              patchMut.mutate({
                                id: row.id,
                                categoryId: editCategoryId,
                                title: editTitle.trim(),
                                body: editBody.trim(),
                                confirmTarget: editConfirmTarget,
                              })
                            }
                            disabled={!editTitle.trim() || !editBody.trim() || patchMut.isPending}
                          >
                            保存
                          </Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            キャンセル
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className="text-xs font-medium px-2 py-0.5 rounded text-white"
                            style={{ backgroundColor: row.category.colorHex || '#6B7280' }}
                          >
                            {row.category.name}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 px-1.5 py-0.5 rounded">
                            {row.confirmTarget === 'MEMBER' ? '隊員向け確認' : '全員確認'}
                          </span>
                          {isConfirmTarget && !row.isRead && (
                            <span className="text-xs font-semibold text-primary">未確認</span>
                          )}
                          <time className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                            {format(new Date(row.publishedAt), 'yyyy年M月d日 HH:mm', { locale: ja })}
                          </time>
                        </div>
                        <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{row.title}</h3>
                        <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{row.body}</div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-gray-500">
                            投稿: {row.author.name}
                            {'readCount' in row && ` ／ 確認済み ${row.readCount} / ${row.memberCount} 名`}
                          </p>
                          <div className="flex gap-2 flex-wrap">
                            {/* 確認ボタン（自分が対象かつ未確認） */}
                            {isConfirmTarget && !row.isRead && (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => readMut.mutate(row.id)}
                                disabled={readMut.isPending}
                              >
                                確認しました
                              </Button>
                            )}
                            {isConfirmTarget && row.isRead && (
                              <span className="text-xs text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                                ✓ 確認済み
                              </span>
                            )}
                            {/* 編集・削除（投稿者またはスタッフ） */}
                            {canEdit && (
                              <>
                                <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(row as StaffAnnouncementRow)}>
                                  <Pencil className="h-4 w-4 mr-1" />
                                  編集
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="text-error"
                                  onClick={() => {
                                    if (window.confirm('このお知らせを削除しますか？')) {
                                      deleteMut.mutate(row.id);
                                    }
                                  }}
                                  disabled={deleteMut.isPending}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  削除
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </article>
                );
              })
            )}
          </div>
        )}
      </section>
    </div>
  );
};
