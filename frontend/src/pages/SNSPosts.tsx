import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { format, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { ja } from 'date-fns/locale';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { Plus, Trash2, ExternalLink, ChevronDown, ChevronUp, Settings } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useStaffWorkspace } from '../stores/workspaceStore';
import { WeeklyStatusAlert } from '../components/sns/WeeklyStatusAlert';
import { SNSPostDetailModal } from '../components/sns/SNSPostDetailModal';
import { SNSAccountModal } from '../components/sns/SNSAccountModal';
import { FollowerGraph } from '../components/sns/FollowerGraph';
import { getWeekMetaForDate, getRecentWeekRows } from '../utils/snsWeek';

interface SNSPost {
  id: string;
  week: string;
  postedAt: string;
  postType: 'STORY' | 'FEED';
  url?: string | null;
  note?: string | null;
  followerCount?: number | null;
  userId: string;
  accountId?: string | null;
  user?: { id: string; name: string };
}

interface SNSAccount {
  id: string;
  platform: string;
  accountName: string;
  displayName?: string | null;
  url?: string | null;
  isDefault: boolean;
  userId?: string;
  user?: { id: string; name: string; avatarColor: string };
}

interface MemberStatus {
  userId: string;
  userName: string;
  hasFeed: boolean;
  hasStory: boolean;
  feedPosts: SNSPost[];
  storyPosts: SNSPost[];
}

export const SNSPosts: React.FC = () => {
  const { user } = useAuthStore();
  const { isStaff, workspaceMode } = useStaffWorkspace();
  const queryClient = useQueryClient();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalDefaultType, setAddModalDefaultType] = useState<'STORY' | 'FEED'>('STORY');
  const [addModalDefaultDate, setAddModalDefaultDate] = useState<string | undefined>(undefined);
  const [editingPost, setEditingPost] = useState<SNSPost | null>(null);
  // null = すべて, string = 特定アカウントID
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SNSAccount | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const viewMode: 'personal' | 'view' =
    user?.role === 'MEMBER'
      ? 'personal'
      : isStaff
        ? workspaceMode === 'browse' ? 'view' : 'personal'
        : 'view';
  const [selectedMonth, setSelectedMonth] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');

  const { weekStart, weekEnd } = getWeekMetaForDate(new Date());
  const personalWeekRows = useMemo(() => getRecentWeekRows(12), []);

  // 自分のSNSアカウント一覧
  const { data: myAccounts = [] } = useQuery<SNSAccount[]>({
    queryKey: ['sns-accounts', user?.id],
    queryFn: async () => (await api.get('/api/sns-accounts')).data || [],
    enabled: viewMode === 'personal',
  });

  // スタッフ用: 全メンバーのSNSアカウント一覧
  const { data: allAccounts = [] } = useQuery<SNSAccount[]>({
    queryKey: ['sns-accounts', 'all'],
    queryFn: async () => (await api.get('/api/sns-accounts/all')).data || [],
    enabled: viewMode === 'view',
    staleTime: 0,
    refetchInterval: 60_000,
  });

  // メンバー一覧（閲覧モード用）
  const { data: members = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['users', 'members'],
    queryFn: async () => {
      const response = await api.get('/api/users');
      return response.data
        .filter((u: any) => u.role === 'MEMBER' && (u.displayOrder ?? 0) !== 0)
        .sort((a: any, b: any) => {
          const diff = (a.displayOrder || 0) - (b.displayOrder || 0);
          return diff !== 0 ? diff : (a.name || '').localeCompare(b.name || '');
        });
    },
    enabled: user?.role !== 'MEMBER',
  });

  // 個人タブ用の投稿取得
  // selectedAccountId=null のとき全アカウント分を取得（accountIdフィルタなし）
  const { data: personalPosts, isLoading: isLoadingPersonal } = useQuery<SNSPost[]>({
    queryKey: ['sns-posts', 'personal', user?.id, selectedAccountId, isStaff ? workspaceMode : 'm'],
    queryFn: async () => {
      const params = new URLSearchParams({ userId: user?.id || '' });
      if (selectedAccountId) params.append('accountId', selectedAccountId);
      return (await api.get(`/api/sns-posts?${params}`)).data;
    },
    enabled: viewMode === 'personal',
  });

  const today = new Date();
  const currentMonthStart = startOfMonth(today);
  const currentMonthEnd = endOfMonth(today);

  const currentMonthSnsStatus = useMemo(() => {
    const list = personalPosts || [];
    const inMonth = (d: string) => {
      const t = new Date(d).getTime();
      return t >= currentMonthStart.getTime() && t <= currentMonthEnd.getTime();
    };
    return {
      story: list.some((p) => p.postType === 'STORY' && inMonth(p.postedAt)),
      feed: list.some((p) => p.postType === 'FEED' && inMonth(p.postedAt)),
    };
  }, [personalPosts, currentMonthStart, currentMonthEnd]);

  // 週次カレンダー用: 選択アカウントでフィルタ
  const postsForWeek = (weekKey: string, type: 'STORY' | 'FEED') => {
    const list = personalPosts || [];
    return list
      .filter((p) => {
        if (p.week !== weekKey || p.postType !== type) return false;
        // 特定アカウント選択時はそのアカウントのみ
        if (selectedAccountId !== null) return p.accountId === selectedAccountId;
        return true;
      })
      .sort((a, b) => new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime());
  };

  // アカウント名を取得するヘルパー
  const getAccountName = (accountId: string | null | undefined) => {
    if (!accountId) return null;
    const acc = myAccounts.find(a => a.id === accountId);
    return acc ? (acc.displayName || acc.accountName) : null;
  };

  // フォロワー数統計（週別・月別）
  const followerStats = useMemo(() => {
    const list = (personalPosts || []).filter((p) => p.followerCount != null);

    // 週別: 各週の最新フォロワー数
    const weekMap = new Map<string, { count: number; weekStart: Date }>();
    list.forEach((p) => {
      const row = personalWeekRows.find(r => r.weekKey === p.week);
      const ws = row ? row.weekStart : new Date(p.postedAt);
      const existing = weekMap.get(p.week);
      if (!existing || new Date(p.postedAt).getTime() > new Date(existing.count).getTime()) {
        weekMap.set(p.week, { count: p.followerCount!, weekStart: ws });
      }
    });
    const byWeek = Array.from(weekMap.entries())
      .map(([week, { count, weekStart: ws }]) => ({ week, label: format(ws, 'M/d', { locale: ja }), count }))
      .sort((a, b) => b.week.localeCompare(a.week));

    // 月別: 各月の最大フォロワー数
    const monthMap = new Map<string, number>();
    list.forEach((p) => {
      const month = p.postedAt.slice(0, 7);
      const existing = monthMap.get(month) ?? 0;
      if (p.followerCount! > existing) monthMap.set(month, p.followerCount!);
    });
    const byMonth = Array.from(monthMap.entries()).sort((a, b) => b[0].localeCompare(a[0]));

    return { byWeek, byMonth };
  }, [personalPosts, personalWeekRows]);

  // 閲覧タブ用の投稿取得
  const { data: allPosts, isLoading: isLoadingView } = useQuery<SNSPost[]>({
    queryKey: ['sns-posts', 'view', selectedMonth, selectedUserId, isStaff ? workspaceMode : 'm'],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedMonth) {
        params.append('from', format(startOfMonth(new Date(`${selectedMonth}-01`)), 'yyyy-MM-dd'));
        params.append('to', format(endOfMonth(new Date(`${selectedMonth}-01`)), 'yyyy-MM-dd'));
      }
      if (selectedUserId) params.append('userId', selectedUserId);
      const url = params.toString() ? `/api/sns-posts?${params}` : '/api/sns-posts';
      return (await api.get(url)).data;
    },
    enabled: viewMode === 'view',
    staleTime: 0,
    refetchInterval: 60_000,
  });

  const currentWeekStatus = useMemo<MemberStatus[]>(() => {
    if (!members.length) return [];
    return members.map(member => {
      const memberPosts = (allPosts || []).filter(p =>
        p.userId === member.id && p.postedAt &&
        new Date(p.postedAt) >= weekStart && new Date(p.postedAt) < weekEnd
      );
      const feedPosts = memberPosts.filter(p => p.postType === 'FEED');
      const storyPosts = memberPosts.filter(p => p.postType === 'STORY');
      return { userId: member.id, userName: member.name, hasFeed: feedPosts.length > 0, hasStory: storyPosts.length > 0, feedPosts, storyPosts };
    });
  }, [allPosts, members, weekStart, weekEnd]);

  const historicalPosts = useMemo(() =>
    (allPosts || []).filter(p => p.postedAt).sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()),
    [allPosts]
  );

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => api.delete(`/api/sns-posts/${postId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sns-posts'] });
      queryClient.invalidateQueries({ queryKey: ['sns-weekly-status'] });
    },
  });

  const handleDelete = async (postId: string) => {
    if (!confirm('この投稿履歴を削除しますか？')) return;
    deleteMutation.mutate(postId);
  };

  const isLoading = viewMode === 'personal' ? isLoadingPersonal : isLoadingView;
  const posts = viewMode === 'personal' ? personalPosts : historicalPosts;

  const availableMonths = useMemo(() => {
    if (!allPosts) return [];
    const months = new Set<string>();
    allPosts.forEach(post => { if (post.postedAt) months.add(format(new Date(post.postedAt), 'yyyy-MM')); });
    const now = new Date();
    const cy = now.getFullYear();
    const cm = now.getMonth() + 1;
    const fy = cm >= 4 ? cy : cy - 1;
    for (let m = 4; m <= 12; m++) months.add(`${fy}-${String(m).padStart(2, '0')}`);
    for (let m = 1; m <= 3; m++) months.add(`${fy + 1}-${String(m).padStart(2, '0')}`);
    for (let m = 1; m <= 3; m++) months.add(`${fy}-${String(m).padStart(2, '0')}`);
    return Array.from(months).sort().reverse();
  }, [allPosts]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><LoadingSpinner /></div>;
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">SNS投稿管理</h1>
        {viewMode === 'personal' && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setEditingAccount(selectedAccountId ? (myAccounts.find(a => a.id === selectedAccountId) ?? null) : null); setIsAccountModalOpen(true); }}
            >
              <Settings className="h-4 w-4 mr-1" />
              {selectedAccountId ? 'アカウント編集' : 'アカウント管理'}
            </Button>
            <Button
              size="sm"
              onClick={() => { setAddModalDefaultType('STORY'); setAddModalDefaultDate(undefined); setIsAddModalOpen(true); }}
            >
              <Plus className="h-4 w-4 mr-1" />
              投稿を記録
            </Button>
          </div>
        )}
      </div>

      {/* アカウントタブ */}
      {viewMode === 'personal' && myAccounts.length > 0 && (
        <div className="flex gap-1 flex-wrap border-b dark:border-gray-700 pb-0 items-center">
          <button
            onClick={() => setSelectedAccountId(null)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${selectedAccountId === null ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
          >
            すべて
          </button>
          {myAccounts.map((acc) => (
            <button
              key={acc.id}
              onClick={() => setSelectedAccountId(acc.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${selectedAccountId === acc.id ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              {acc.displayName || acc.accountName}
              {acc.isDefault && <span className="ml-1 text-xs text-gray-400">（既定）</span>}
            </button>
          ))}
          {/* アカウント追加ボタン */}
          <button
            onClick={() => { setEditingAccount(null); setIsAccountModalOpen(true); }}
            className="ml-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border border-dashed border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 flex items-center gap-1"
          >
            <Plus className="h-3 w-3" />アカウント追加
          </button>
        </div>
      )}

      {user?.role !== 'MEMBER' && isStaff && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            個人／閲覧はダッシュボードの表示モードに連動しています（現在:{' '}
            <span className="font-medium text-gray-900 dark:text-gray-100">{workspaceMode === 'browse' ? '閲覧' : '個人'}</span>）
          </p>
        </div>
      )}

      {/* 今週・今月の状況（個人タブのみ） */}
      {viewMode === 'personal' && (
        <div className="space-y-2">
          <WeeklyStatusAlert />
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-medium text-gray-700 dark:text-gray-300">{format(today, 'M月', { locale: ja })}の記録:</span>
            <span>ストーリーズ:{' '}
              <span className={currentMonthSnsStatus.story ? 'text-green-600 dark:text-green-400 font-medium' : 'text-amber-600 dark:text-amber-400 font-medium'}>
                {currentMonthSnsStatus.story ? '✓ あり' : '未記録'}
              </span>
            </span>
            <span>フィード:{' '}
              <span className={currentMonthSnsStatus.feed ? 'text-green-600 dark:text-green-400 font-medium' : 'text-amber-600 dark:text-amber-400 font-medium'}>
                {currentMonthSnsStatus.feed ? '✓ あり' : '未記録'}
              </span>
            </span>
          </div>
        </div>
      )}

      {viewMode === 'view' ? (
        <>
          {/* 閲覧モード: フィルタ */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">対象月で絞り込み</label>
                <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                  <option value="">全ての月</option>
                  {availableMonths.map(month => <option key={month} value={month}>{format(new Date(`${month}-01`), 'yyyy年M月', { locale: ja })}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">メンバーで絞り込み</label>
                <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
                  <option value="">全てのメンバー</option>
                  {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* 閲覧モード: 現在の週の投稿状況（メンバー×アカウント別） */}
          {!selectedMonth && !selectedUserId && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  今週の投稿状況
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                    ({format(weekStart, 'M月d日', { locale: ja })} 〜 {format(addDays(weekEnd, -1), 'M月d日', { locale: ja })})
                  </span>
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">1分ごとに自動更新</p>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-gray-700">
                {currentWeekStatus.map((status) => {
                  // このメンバーのアカウント一覧
                  const memberAccounts = allAccounts.filter(a => a.userId === status.userId);
                  return (
                    <div key={status.userId} className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{status.userName}</span>
                        {/* 全体サマリー */}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${status.hasFeed && status.hasStory ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'}`}>
                          {status.hasFeed && status.hasStory ? '✓ 完了' : '未完了'}
                        </span>
                      </div>
                      {memberAccounts.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {memberAccounts.map(acc => {
                            const accPosts = (allPosts || []).filter(p =>
                              p.userId === status.userId &&
                              p.accountId === acc.id &&
                              p.postedAt &&
                              new Date(p.postedAt) >= weekStart &&
                              new Date(p.postedAt) < weekEnd
                            );
                            const hasFeed = accPosts.some(p => p.postType === 'FEED');
                            const hasStory = accPosts.some(p => p.postType === 'STORY');
                            const feedPosts = accPosts.filter(p => p.postType === 'FEED');
                            const storyPosts = accPosts.filter(p => p.postType === 'STORY');
                            return (
                              <div key={acc.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 border border-gray-200 dark:border-gray-600">
                                <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2 truncate">
                                  {acc.displayName || acc.accountName}
                                  <span className="ml-1 text-gray-400 font-normal">({acc.platform})</span>
                                </div>
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-blue-600 dark:text-blue-400">ストーリーズ</span>
                                    {hasStory ? (
                                      <span className="text-green-600 dark:text-green-400 font-medium">
                                        ✓ {storyPosts.map(p => format(new Date(p.postedAt), 'M/d', { locale: ja })).join(', ')}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">未投稿</span>
                                    )}
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-green-600 dark:text-green-400">フィード</span>
                                    {hasFeed ? (
                                      <span className="text-green-600 dark:text-green-400 font-medium">
                                        ✓ {feedPosts.map(p => format(new Date(p.postedAt), 'M/d', { locale: ja })).join(', ')}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">未投稿</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        // アカウント未登録の場合は従来の表示
                        <div className="flex gap-4 text-sm">
                          <span>フィード: {status.hasFeed ? <span className="text-green-600 dark:text-green-400 font-medium">✓ 投稿済み</span> : <span className="text-gray-400">未投稿</span>}</span>
                          <span>ストーリーズ: {status.hasStory ? <span className="text-green-600 dark:text-green-400 font-medium">✓ 投稿済み</span> : <span className="text-gray-400">未投稿</span>}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 閲覧モード: 過去の記録 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">{selectedMonth || selectedUserId ? '投稿履歴' : '過去の記録'}</h2>
            {historicalPosts.length > 0 ? (
              <div className="space-y-3">
                {historicalPosts.map((post) => {
                  const acc = allAccounts.find(a => a.id === post.accountId);
                  return (
                    <div key={post.id} className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{format(new Date(post.postedAt), 'yyyy年M月d日')}</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${post.postType === 'STORY' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'}`}>
                          {post.postType === 'STORY' ? 'ストーリーズ' : 'フィード'}
                        </span>
                        {post.user && <span className="text-xs font-medium text-gray-700 dark:text-gray-300">({post.user.name})</span>}
                        {acc && <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{acc.displayName || acc.accountName}</span>}
                        {post.followerCount != null && <span className="text-xs text-gray-500 dark:text-gray-400">{post.followerCount.toLocaleString()}人</span>}
                        {post.url && <a href={post.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1"><ExternalLink className="w-3 h-3" />投稿リンク</a>}
                      </div>
                      {post.note && <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-wrap">{post.note}</p>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">投稿履歴がありません</div>
            )}
          </div>
        </>
      ) : (
        <>
          {/* フォロワーグラフ（フォロワー数が入力されている場合のみ） */}
          {(personalPosts || []).some(p => p.followerCount != null) && (
            <FollowerGraph
              posts={selectedAccountId
                ? (personalPosts || []).filter(p => p.accountId === selectedAccountId)
                : (personalPosts || [])}
              accountNames={Object.fromEntries(myAccounts.map(a => [a.id, a.displayName || a.accountName]))}
              accountName={selectedAccountId
                ? (myAccounts.find(a => a.id === selectedAccountId)?.displayName || myAccounts.find(a => a.id === selectedAccountId)?.accountName)
                : undefined}
            />
          )}

          {/* 週次カレンダー */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-border dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">週次カレンダー（振り返り）</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">セルを押して記録・編集できます。</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-gray-100">週（月曜起算）</th>
                    <th className="text-center py-3 px-2 font-semibold text-blue-700 dark:text-blue-300">ストーリーズ</th>
                    <th className="text-center py-3 px-2 font-semibold text-green-700 dark:text-green-300">フィード</th>
                  </tr>
                </thead>
                <tbody>
                  {personalWeekRows.map((row) => {
                    const sPosts = postsForWeek(row.weekKey, 'STORY');
                    const fPosts = postsForWeek(row.weekKey, 'FEED');

                    const renderPost = (p: SNSPost, type: 'STORY' | 'FEED') => {
                      const isStory = type === 'STORY';
                      const accName = selectedAccountId === null ? getAccountName(p.accountId) : null;
                      return (
                        <div key={p.id} className="flex items-stretch gap-1 w-full">
                          <button
                            type="button"
                            className={`flex-1 rounded-l-md border text-xs px-2 py-1.5 transition-colors text-left ${isStory ? 'border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40' : 'border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40'}`}
                            onClick={() => setEditingPost(p)}
                          >
                            <span className={`font-medium ${isStory ? 'text-blue-600 dark:text-blue-400' : 'text-green-600 dark:text-green-400'}`}>
                              ✓ {format(new Date(p.postedAt), 'M/d', { locale: ja })}
                            </span>
                            {accName && <span className="ml-1 text-gray-400 text-xs">({accName})</span>}
                            {p.followerCount != null && (
                              <span className="block text-gray-500 dark:text-gray-400 text-xs mt-0.5">{p.followerCount.toLocaleString()}人</span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                            className={`px-1.5 rounded-r-md border-y border-r text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex-shrink-0 ${isStory ? 'border-blue-200 dark:border-blue-900/50' : 'border-green-200 dark:border-green-900/50'}`}
                            title="削除"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => { setAddModalDefaultType(type); setAddModalDefaultDate(format(row.weekStart, 'yyyy-MM-dd')); setIsAddModalOpen(true); }}
                            className="px-1.5 rounded-md border border-dashed border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-400 flex-shrink-0"
                            title="追加"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    };

                    const renderEmpty = (type: 'STORY' | 'FEED') => (
                      <button
                        type="button"
                        className="w-full min-h-[44px] rounded-md border border-dashed border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-xs flex items-center justify-center text-gray-400"
                        onClick={() => { setAddModalDefaultType(type); setAddModalDefaultDate(format(row.weekStart, 'yyyy-MM-dd')); setIsAddModalOpen(true); }}
                      >
                        — 未記録
                      </button>
                    );

                    return (
                      <tr key={row.weekKey} className="border-b border-gray-100 dark:border-gray-700/80">
                        <td className="py-2 px-4 text-gray-800 dark:text-gray-200 whitespace-nowrap">{row.label}</td>
                        <td className="py-2 px-2"><div className="flex flex-col gap-1">{sPosts.length > 0 ? sPosts.map(p => renderPost(p, 'STORY')) : renderEmpty('STORY')}</div></td>
                        <td className="py-2 px-2"><div className="flex flex-col gap-1">{fPosts.length > 0 ? fPosts.map(p => renderPost(p, 'FEED')) : renderEmpty('FEED')}</div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* フォロワー数統計 */}
          {(followerStats.byWeek.length > 0 || followerStats.byMonth.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {followerStats.byWeek.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-border dark:border-gray-700 p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 text-sm">フォロワー数（週・最新入力）</h3>
                  <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1 max-h-40 overflow-y-auto">
                    {followerStats.byWeek.map(({ week, label, count }) => (
                      <li key={week} className="flex justify-between gap-2">
                        <span>{label}〜</span>
                        <span className="font-mono">{count.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {followerStats.byMonth.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-border dark:border-gray-700 p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 text-sm">フォロワー数（月・最大値）</h3>
                  <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
                    {followerStats.byMonth.map(([month, count]) => (
                      <li key={month} className="flex justify-between gap-2">
                        <span>{format(new Date(`${month}-01`), 'yyyy年M月', { locale: ja })}</span>
                        <span className="font-mono">{count.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* 投稿履歴（プルダウン） */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              onClick={() => setIsHistoryOpen(v => !v)}
            >
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                投稿履歴（一覧）
                {posts && posts.length > 0 && <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">{posts.length}件</span>}
              </span>
              {isHistoryOpen ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </button>
            {isHistoryOpen && (
              <div className="border-t border-border dark:border-gray-700 p-4">
                {posts && posts.length > 0 ? (
                  <div className="space-y-3">
                    {[...(posts || [])].filter(p => p.postedAt).sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()).map((post) => {
                      const accName = getAccountName(post.accountId);
                      return (
                        <div key={post.id} className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{format(new Date(post.postedAt), 'yyyy年M月d日')}</span>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${post.postType === 'STORY' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'}`}>
                                {post.postType === 'STORY' ? 'ストーリーズ' : 'フィード'}
                              </span>
                              {/* すべてタブのときはアカウント名を表示 */}
                              {selectedAccountId === null && accName && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{accName}</span>
                              )}
                              {post.followerCount != null && <span className="text-xs text-gray-500 dark:text-gray-400">{post.followerCount.toLocaleString()}人</span>}
                              {post.url && <a href={post.url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1"><ExternalLink className="w-3 h-3" />リンク</a>}
                            </div>
                            <div className="flex gap-1 flex-shrink-0">
                              <button onClick={() => setEditingPost(post)} className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded" title="編集">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                              <button onClick={() => handleDelete(post.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" title="削除">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          {post.note && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-wrap">{post.note}</p>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500 dark:text-gray-400 text-sm">投稿履歴がありません</div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* 追加モーダル */}
      {isAddModalOpen && (
        <SNSPostDetailModal
          isOpen={isAddModalOpen}
          defaultPostType={addModalDefaultType}
          defaultPostedDate={addModalDefaultDate}
          accountId={selectedAccountId !== null ? selectedAccountId : undefined}
          accounts={selectedAccountId === null && myAccounts.length > 0 ? myAccounts : undefined}
          platform={selectedAccountId ? myAccounts.find(a => a.id === selectedAccountId)?.platform : undefined}
          onClose={() => { setIsAddModalOpen(false); setAddModalDefaultDate(undefined); }}
          onSaved={() => {
            setIsAddModalOpen(false);
            setAddModalDefaultDate(undefined);
            queryClient.invalidateQueries({ queryKey: ['sns-posts'] });
            queryClient.invalidateQueries({ queryKey: ['sns-weekly-status'] });
          }}
        />
      )}

      {/* 編集モーダル */}
      {editingPost && (
        <SNSPostDetailModal
          isOpen={!!editingPost}
          post={editingPost}
          platform={editingPost.accountId ? myAccounts.find(a => a.id === editingPost.accountId)?.platform : undefined}
          onClose={() => setEditingPost(null)}
          onSaved={() => {
            setEditingPost(null);
            queryClient.invalidateQueries({ queryKey: ['sns-posts'] });
            queryClient.invalidateQueries({ queryKey: ['sns-weekly-status'] });
          }}
        />
      )}

      {/* アカウント管理モーダル */}
      {isAccountModalOpen && (
        <SNSAccountModal
          account={editingAccount}
          onClose={() => { setIsAccountModalOpen(false); setEditingAccount(null); }}
          onSaved={() => {
            setIsAccountModalOpen(false);
            setEditingAccount(null);
            queryClient.invalidateQueries({ queryKey: ['sns-accounts'] });
          }}
        />
      )}
    </div>
  );
};
