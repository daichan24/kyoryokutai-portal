import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { format, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { ja } from 'date-fns/locale';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { Plus, Edit, Trash2, ExternalLink } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useStaffWorkspace } from '../stores/workspaceStore';
import { WeeklyStatusAlert } from '../components/sns/WeeklyStatusAlert';
import { SNSPostDetailModal } from '../components/sns/SNSPostDetailModal';
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
  user?: { id: string; name: string };
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
  const viewMode: 'personal' | 'view' =
    user?.role === 'MEMBER'
      ? 'personal'
      : isStaff
        ? workspaceMode === 'browse'
          ? 'view'
          : 'personal'
        : 'view';
  const [selectedMonth, setSelectedMonth] = useState<string>(''); // 月のフィルタ（閲覧モード用）
  const [selectedUserId, setSelectedUserId] = useState<string>(''); // ユーザーのフィルタ（閲覧モード用）

  const { weekStart, weekEnd } = getWeekMetaForDate(new Date());
  const personalWeekRows = useMemo(() => getRecentWeekRows(12), []);

  // メンバー一覧の取得（閲覧モード用）
  const { data: members = [] } = useQuery<Array<{ id: string; name: string }>>({
    queryKey: ['users', 'members'],
    queryFn: async () => {
      const response = await api.get('/api/users');
      return response.data.filter((u: any) => 
        u.role === 'MEMBER' && (u.displayOrder ?? 0) !== 0
      ).sort((a: any, b: any) => {
        // displayOrderでソート（小さい順）、同じ場合は名前でソート
        const orderA = a.displayOrder || 0;
        const orderB = b.displayOrder || 0;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        return (a.name || '').localeCompare(b.name || '');
      });
    },
    enabled: user?.role !== 'MEMBER',
  });

  // 個人タブ用の投稿取得
  const { data: personalPosts, isLoading: isLoadingPersonal } = useQuery<SNSPost[]>({
    queryKey: ['sns-posts', 'personal', user?.id, isStaff ? workspaceMode : 'm'],
    queryFn: async () => {
      const url = `/api/sns-posts?userId=${user?.id}`;
      const response = await api.get(url);
      return response.data;
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

  const followerStats = useMemo(() => {
    const list = (personalPosts || []).filter(
      (p) => p.followerCount !== undefined && p.followerCount !== null,
    );
    const byWeek = new Map<string, { count: number; postedAt: string }>();
    const byMonth = new Map<string, number>();
    for (const p of list) {
      const prevW = byWeek.get(p.week);
      if (!prevW || new Date(p.postedAt) > new Date(prevW.postedAt)) {
        byWeek.set(p.week, { count: p.followerCount!, postedAt: p.postedAt });
      }
      const m = format(new Date(p.postedAt), 'yyyy-MM');
      const prevM = byMonth.get(m);
      if (prevM === undefined || p.followerCount! > prevM) byMonth.set(m, p.followerCount!);
    }
    return {
      byWeek: [...byWeek.entries()]
        .map(([week, v]) => ({ week, count: v.count }))
        .sort((a, b) => b.week.localeCompare(a.week)),
      byMonth: [...byMonth.entries()].sort((a, b) => b[0].localeCompare(a[0])),
    };
  }, [personalPosts]);

  const postsForWeek = (weekKey: string, type: 'STORY' | 'FEED') =>
    (personalPosts || [])
      .filter((p) => p.week === weekKey && p.postType === type)
      .sort((a, b) => new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime());

  // 閲覧タブ用の投稿取得（全員分）
  const { data: allPosts, isLoading: isLoadingView } = useQuery<SNSPost[]>({
    queryKey: ['sns-posts', 'view', selectedMonth, selectedUserId, isStaff ? workspaceMode : 'm'],
    queryFn: async () => {
      let url = '/api/sns-posts';
      const params = new URLSearchParams();
      
      if (selectedMonth) {
        const monthStart = startOfMonth(new Date(`${selectedMonth}-01`));
        const monthEnd = endOfMonth(new Date(`${selectedMonth}-01`));
        params.append('from', format(monthStart, 'yyyy-MM-dd'));
        params.append('to', format(monthEnd, 'yyyy-MM-dd'));
      }
      
      if (selectedUserId) {
        params.append('userId', selectedUserId);
      }
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await api.get(url);
      return response.data;
    },
    enabled: viewMode === 'view',
    staleTime: 0, // 常に最新データを取得（スタッフが閲覧する際に古いデータが表示されないように）
    refetchInterval: 60_000, // 1分ごとに自動更新
  });

  // 現在の週の投稿状況を計算（閲覧モード用）
  const currentWeekStatus = useMemo<MemberStatus[]>(() => {
    if (!members.length) return [];

    // すべてのメンバーを表示（投稿がない場合も含む）
    return members.map(member => {
      const memberPosts = (allPosts || []).filter(p => 
        p.userId === member.id && 
        p.postedAt &&
        new Date(p.postedAt) >= weekStart &&
        new Date(p.postedAt) < weekEnd
      );

      const feedPosts = memberPosts.filter(p => p.postType === 'FEED');
      const storyPosts = memberPosts.filter(p => p.postType === 'STORY');
 
       return {
         userId: member.id,
         userName: member.name,
         hasFeed: feedPosts.length > 0,
         hasStory: storyPosts.length > 0,
         feedPosts,
         storyPosts,
       };
     });
  }, [allPosts, members, weekStart, weekEnd]);

  // 過去の記録（閲覧モード用、月別・ユーザー別ソート）
  const historicalPosts = useMemo(() => {
    if (!allPosts) return [];
    
    return allPosts
      .filter(p => p.postedAt)
      .sort((a, b) => {
        const dateA = new Date(a.postedAt).getTime();
        const dateB = new Date(b.postedAt).getTime();
        return dateB - dateA; // 新しい順
      });
  }, [allPosts]);

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => {
      return api.delete(`/api/sns-posts/${postId}`);
    },
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

  // 利用可能な月の一覧（年度単位、3ヶ月遡れるように）
  const availableMonths = useMemo(() => {
    if (!allPosts) return [];
    
    const months = new Set<string>();
    allPosts.forEach(post => {
      if (post.postedAt) {
        const month = format(new Date(post.postedAt), 'yyyy-MM');
        months.add(month);
      }
    });
    
    // 現在の年度を計算（4月〜翌年3月）
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12
    const fiscalYearStart = currentMonth >= 4 ? currentYear : currentYear - 1;
    const fiscalYearEnd = fiscalYearStart + 1;
    
    // 現在の年度の月を追加（4月〜翌年3月）
    for (let month = 4; month <= 12; month++) {
      months.add(`${fiscalYearStart}-${String(month).padStart(2, '0')}`);
    }
    for (let month = 1; month <= 3; month++) {
      months.add(`${fiscalYearEnd}-${String(month).padStart(2, '0')}`);
    }
    
    // 前年度の最後の3ヶ月を追加（1月、2月、3月）
    const prevFiscalYearStart = fiscalYearStart - 1;
    for (let month = 1; month <= 3; month++) {
      months.add(`${prevFiscalYearStart + 1}-${String(month).padStart(2, '0')}`);
    }
    
    // 年度が変わっても3ヶ月は遡れるように（前年度の最後の3ヶ月）
    // 既に追加済み
    
    return Array.from(months).sort().reverse();
  }, [allPosts]);

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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">SNS投稿管理</h1>
        {viewMode === 'personal' && (
          <Button
            onClick={() => {
              setAddModalDefaultType('STORY');
              setAddModalDefaultDate(undefined);
              setIsAddModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            投稿を記録
          </Button>
        )}
      </div>

      {user?.role !== 'MEMBER' && isStaff && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            個人／閲覧はダッシュボードの表示モードに連動しています（現在:{' '}
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {workspaceMode === 'browse' ? '閲覧' : '個人'}
            </span>
            ）
          </p>
        </div>
      )}

      {/* 週次アラート（個人タブのみ） */}
      {viewMode === 'personal' && <WeeklyStatusAlert />}

      {viewMode === 'view' ? (
        <>
          {/* 閲覧モード: フィルタ */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  対象月で絞り込み
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">全ての月</option>
                  {availableMonths.map(month => (
                    <option key={month} value={month}>
                      {format(new Date(`${month}-01`), 'yyyy年M月', { locale: ja })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  メンバーで絞り込み
                </label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">全てのメンバー</option>
                  {members.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 閲覧モード: 現在の週の投稿状況（テーブル形式） */}
          {!selectedMonth && !selectedUserId && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                現在の週の投稿状況
                <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-2">
                  ({format(weekStart, 'M月d日', { locale: ja })} 〜 {format(addDays(weekEnd, -1), 'M月d日', { locale: ja })})
                </span>
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-gray-100">メンバー</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-900 dark:text-gray-100">フィード</th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-900 dark:text-gray-100">ストーリーズ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentWeekStatus.map((status) => (
                      <tr key={status.userId} className="border-b border-gray-200 dark:border-gray-700">
                        <td className="py-3 px-4 text-gray-900 dark:text-gray-100">{status.userName}</td>
                        <td className="py-3 px-4 text-center">
                          {status.hasFeed ? (
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              ✓ {status.feedPosts.length > 1 ? `${status.feedPosts.length}件` : '投稿済み'}
                            </span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400 font-medium">未投稿</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {status.hasStory ? (
                            <span className="text-green-600 dark:text-green-400 font-medium">
                              ✓ {status.storyPosts.length > 1 ? `${status.storyPosts.length}件` : '投稿済み'}
                            </span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400 font-medium">未投稿</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 閲覧モード: 過去の記録 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              {selectedMonth || selectedUserId ? '投稿履歴' : '過去の記録'}
            </h2>
            {historicalPosts && historicalPosts.length > 0 ? (
              <div className="space-y-3">
                {historicalPosts.map((post) => (
                  <div
                    key={post.id}
                    className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {format(new Date(post.postedAt), 'yyyy年M月d日')}
                          </span>
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              post.postType === 'STORY'
                                ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                            }`}
                          >
                            {post.postType === 'STORY' ? 'ストーリーズ' : 'フィード'}
                          </span>
                          {post.user && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">({post.user.name})</span>
                          )}
                        </div>

                        {post.url && (
                          <a
                            href={post.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 mb-2"
                          >
                            <ExternalLink className="w-3 h-3" />
                            投稿リンク
                          </a>
                        )}

                        {post.note && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{post.note}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                投稿履歴がありません
              </div>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-4 space-y-2">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">今月の記録状況</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {format(today, 'yyyy年M月', { locale: ja })}時点 — ストーリーズ:{' '}
              <span className={currentMonthSnsStatus.story ? 'text-green-600 dark:text-green-400 font-medium' : 'text-amber-600 dark:text-amber-400 font-medium'}>
                {currentMonthSnsStatus.story ? '投稿記録あり' : '未記録'}
              </span>
              {' ／ '}
              フィード:{' '}
              <span className={currentMonthSnsStatus.feed ? 'text-green-600 dark:text-green-400 font-medium' : 'text-amber-600 dark:text-amber-400 font-medium'}>
                {currentMonthSnsStatus.feed ? '投稿記録あり' : '未記録'}
              </span>
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-border dark:border-gray-700">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">週次カレンダー（振り返り）</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                各週のストーリーズ／フィードの記録状況です。セルを押して記録・編集できます（未投稿の週も表示されます）。
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[520px]">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900 dark:text-gray-100">週（月曜起算）</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-900 dark:text-gray-100">ストーリーズ</th>
                    <th className="text-center py-3 px-2 font-semibold text-gray-900 dark:text-gray-100">フィード</th>
                  </tr>
                </thead>
                <tbody>
                  {personalWeekRows.map((row) => {
                    const sPosts = postsForWeek(row.weekKey, 'STORY');
                    const fPosts = postsForWeek(row.weekKey, 'FEED');
                    return (
                      <tr key={row.weekKey} className="border-b border-gray-100 dark:border-gray-700/80">
                        <td className="py-2 px-4 text-gray-800 dark:text-gray-200 whitespace-nowrap">{row.label}</td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex flex-col gap-1 items-center">
                            {sPosts.map((p) => (
                              <div key={p.id} className="w-full flex items-center gap-1">
                                <button
                                  type="button"
                                  className="flex-1 min-h-[32px] rounded-md border border-green-200 dark:border-green-900/50 bg-green-50/50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 text-xs px-2 transition-colors text-left"
                                  onClick={() => setEditingPost(p)}
                                >
                                  <span className="text-green-600 dark:text-green-400 font-medium">
                                    ✓ {format(new Date(p.postedAt), 'M/d', { locale: ja })}
                                  </span>
                                  {p.followerCount != null && (
                                    <span className="ml-1 text-gray-500 dark:text-gray-400">
                                      {p.followerCount.toLocaleString()}人
                                    </span>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                                  className="p-1 text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded flex-shrink-0"
                                  title="削除"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              className={`w-full min-h-[32px] rounded-md border border-dashed border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-xs flex items-center justify-center gap-1 ${
                                sPosts.length > 0 ? 'mt-1 py-1' : 'min-h-[44px]'
                              }`}
                              onClick={() => {
                                setAddModalDefaultType('STORY');
                                setAddModalDefaultDate(format(row.weekStart, 'yyyy-MM-dd'));
                                setIsAddModalOpen(true);
                              }}
                            >
                              {sPosts.length > 0 ? (
                                <>
                                  <Plus className="w-3 h-3" />
                                  追加
                                </>
                              ) : (
                                <span className="text-gray-400">— 未記録</span>
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex flex-col gap-1 items-center">
                            {fPosts.map((p) => (
                              <div key={p.id} className="w-full flex items-center gap-1">
                                <button
                                  type="button"
                                  className="flex-1 min-h-[32px] rounded-md border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-xs px-2 transition-colors text-left"
                                  onClick={() => setEditingPost(p)}
                                >
                                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                                    ✓ {format(new Date(p.postedAt), 'M/d', { locale: ja })}
                                  </span>
                                  {p.followerCount != null && (
                                    <span className="ml-1 text-gray-500 dark:text-gray-400">
                                      {p.followerCount.toLocaleString()}人
                                    </span>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                                  className="p-1 text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded flex-shrink-0"
                                  title="削除"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              className={`w-full min-h-[32px] rounded-md border border-dashed border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-xs flex items-center justify-center gap-1 ${
                                fPosts.length > 0 ? 'mt-1 py-1' : 'min-h-[44px]'
                              }`}
                              onClick={() => {
                                setAddModalDefaultType('FEED');
                                setAddModalDefaultDate(format(row.weekStart, 'yyyy-MM-dd'));
                                setIsAddModalOpen(true);
                              }}
                            >
                              {fPosts.length > 0 ? (
                                <>
                                  <Plus className="w-3 h-3" />
                                  追加
                                </>
                              ) : (
                                <span className="text-gray-400">— 未記録</span>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {(followerStats.byWeek.length > 0 || followerStats.byMonth.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {followerStats.byWeek.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-border dark:border-gray-700 p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 text-sm">フォロワー数（週・最新入力）</h3>
                  <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1 max-h-40 overflow-y-auto">
                    {followerStats.byWeek.map(({ week, count }) => (
                      <li key={week} className="flex justify-between gap-2">
                        <span>{week}</span>
                        <span className="font-mono">{count.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {followerStats.byMonth.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-border dark:border-gray-700 p-4">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 text-sm">フォロワー数（月・週内の最大値）</h3>
                  <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
                    {followerStats.byMonth.map(([month, count]) => (
                      <li key={month} className="flex justify-between gap-2">
                        <span>{month}</span>
                        <span className="font-mono">{count.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* 個人タブ: 投稿履歴 */}
          <div className="space-y-4">
            <h2 className="font-semibold text-lg text-gray-900 dark:text-gray-100">投稿履歴（一覧）</h2>
            
            {posts && posts.length > 0 ? (
              <div className="space-y-3">
                {posts
                  .filter((p) => p.postedAt)
                  .sort((a, b) => {
                    const dateA = new Date(a.postedAt).getTime();
                    const dateB = new Date(b.postedAt).getTime();
                    return dateB - dateA; // 新しい順
                  })
                  .map((post) => (
                    <div
                      key={post.id}
                      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {format(new Date(post.postedAt), 'yyyy年M月d日')}
                            </span>
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${
                                post.postType === 'STORY'
                                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                                  : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                              }`}
                            >
                              {post.postType === 'STORY' ? 'ストーリーズ' : 'フィード'}
                            </span>
                            {post.user && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">({post.user.name})</span>
                            )}
                          </div>

                          {post.url && (
                            <a
                              href={post.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 mb-2"
                            >
                              <ExternalLink className="w-3 h-3" />
                              投稿リンク
                            </a>
                          )}

                          {post.followerCount != null && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                              フォロワー: {post.followerCount.toLocaleString()}
                            </p>
                          )}

                          {post.note && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{post.note}</p>
                          )}
                        </div>

                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => setEditingPost(post)}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                            title="編集"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(post.id)}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            title="削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                投稿履歴がありません
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
          onClose={() => {
            setIsAddModalOpen(false);
            setAddModalDefaultDate(undefined);
          }}
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
          onClose={() => setEditingPost(null)}
          onSaved={() => {
            setEditingPost(null);
            queryClient.invalidateQueries({ queryKey: ['sns-posts'] });
            queryClient.invalidateQueries({ queryKey: ['sns-weekly-status'] });
          }}
        />
      )}
    </div>
  );
};
