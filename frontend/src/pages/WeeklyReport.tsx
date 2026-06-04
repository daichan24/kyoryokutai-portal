import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Plus, Eye } from 'lucide-react';
import { api } from '../utils/api';
import { WeeklyReport as WeeklyReportType } from '../types';
import { formatFiscalYear, formatWeekLabel, getFiscalYear, getWeekString, normalizeWeekString, parseWeekString } from '../utils/date';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { WeeklyReportModal } from '../components/report/WeeklyReportModal';
import { useAuthStore } from '../stores/authStore';
import { useSearchParams } from 'react-router-dom';

type MemberUserOption = {
  id: string;
  name: string;
  role: string;
  avatarColor?: string;
  displayOrder?: number;
};

export const WeeklyReport: React.FC = () => {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [reports, setReports] = useState<WeeklyReportType[]>([]);
  const [allWeekReports, setAllWeekReports] = useState<WeeklyReportType[]>([]); // 選択した週の全員分の報告
  const [allReports, setAllReports] = useState<WeeklyReportType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingWeekView, setLoadingWeekView] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<WeeklyReportType | null>(null);
  const [modalViewMode, setModalViewMode] = useState<'edit' | 'preview'>('edit');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [users, setUsers] = useState<MemberUserOption[]>([]);
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<number>(() => getFiscalYear()); // 年度のフィルタ
  const [selectedWeek, setSelectedWeek] = useState<string>(''); // 週の選択（全員分表示用）
  const [viewMode, setViewMode] = useState<'individual' | 'weekly'>('individual'); // 表示モード
  const weekFromQuery = searchParams.get('week') || '';
  const userIdFromQuery = searchParams.get('userId') || '';
  const openedWeekFromQueryRef = React.useRef<string | null>(null);

  // ユーザー一覧の取得（メンバー以外のみ）
  useEffect(() => {
    const loadUsers = async () => {
      if (user?.role === 'MEMBER') {
        setUsers([]);
        return;
      }
      
      try {
        const response = await api.get<MemberUserOption[]>('/api/users');
        const memberUsers = response.data.filter((u) =>
          u.role === 'MEMBER' && (u.displayOrder ?? 0) !== 0
        ).sort((a, b) => {
          // displayOrderでソート（小さい順）、同じ場合は名前でソート
          if (a.displayOrder !== b.displayOrder) {
            return (a.displayOrder || 0) - (b.displayOrder || 0);
          }
          return (a.name || '').localeCompare(b.name || '');
        });
        setUsers(memberUsers);
      } catch (error) {
        console.error('Failed to fetch users:', error);
        setUsers([]);
      }
    };
    
    loadUsers();
  }, [user]);

  // selectedUserIdの初期設定（ユーザー一覧が取得できた場合のみ）
  useEffect(() => {
    if (users.length > 0 && !selectedUserId && user?.role !== 'MEMBER') {
      setSelectedUserId(users[0].id);
    }
  }, [users, selectedUserId, user?.role]);

  useEffect(() => {
    if (user?.role !== 'MEMBER' && userIdFromQuery && selectedUserId !== userIdFromQuery) {
      setSelectedUserId(userIdFromQuery);
      setViewMode('individual');
    }
  }, [selectedUserId, user?.role, userIdFromQuery]);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      // MEMBERの場合は自分の報告のみ、他は選択したユーザーの報告
      const url = user?.role === 'MEMBER' 
        ? `/api/weekly-reports?userId=${user.id}`
        : selectedUserId
        ? `/api/weekly-reports?userId=${selectedUserId}`
        : '/api/weekly-reports';
      const response = await api.get<WeeklyReportType[]>(url);
      setReports(response.data || []);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [user, selectedUserId]);

  // 特定週の全員分の報告を取得
  const fetchAllWeekReports = useCallback(async (week: string) => {
    if (!week || user?.role === 'MEMBER') return;
    
    setLoadingWeekView(true);
    try {
      const response = await api.get<WeeklyReportType[]>(`/api/weekly-reports?week=${week}`);
      setAllWeekReports(response.data || []);
    } catch (error) {
      console.error('Failed to fetch all week reports:', error);
      setAllWeekReports([]);
    } finally {
      setLoadingWeekView(false);
    }
  }, [user]);

  // 週次報告の取得
  useEffect(() => {
    if (viewMode === 'individual') {
      fetchReports();
    }
  }, [fetchReports, viewMode]);

  // 全員分表示モードで週が選択された場合
  useEffect(() => {
    if (viewMode === 'weekly' && selectedWeek) {
      fetchAllWeekReports(selectedWeek);
    }
  }, [viewMode, selectedWeek, fetchAllWeekReports]);

  const handleCreateReport = () => {
    setSelectedReport(null);
    setModalViewMode('edit');
    setIsModalOpen(true);
  };

  const handleEditReport = (report: WeeklyReportType) => {
    setSelectedReport(report);
    setModalViewMode('edit');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedReport(null);
    if (weekFromQuery) {
      const next = new URLSearchParams(searchParams);
      next.delete('week');
      next.delete('userId');
      setSearchParams(next, { replace: true });
    }
  };

  const handleSaved = () => {
    fetchReports();
    if (viewMode === 'weekly' && selectedWeek) {
      fetchAllWeekReports(selectedWeek);
    }
    handleCloseModal();
  };

  // MEMBERのみ新規作成ボタンを表示（自分の報告のみ作成可能）
  const canCreate = user?.role === 'MEMBER';
  const canView = user?.role !== 'MEMBER'; // メンバー以外は閲覧のみ

  useEffect(() => {
    if (!weekFromQuery || loading || openedWeekFromQueryRef.current === weekFromQuery) return;
    openedWeekFromQueryRef.current = weekFromQuery;
    const normalizedWeekFromQuery = normalizeWeekString(weekFromQuery);
    const existing = reports.find((report) => normalizeWeekString(report.week) === normalizedWeekFromQuery) || null;
    if (!existing && !canCreate) return;
    setSelectedReport(existing);
    setModalViewMode(existing && canView ? 'preview' : 'edit');
    setIsModalOpen(true);
  }, [canCreate, canView, loading, reports, weekFromQuery]);

  const approvalBadge = (report: WeeklyReportType) => {
    if (report.approvalStatus === 'APPROVED') {
      return { label: '承認済み', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' };
    }
    if (report.approvalStatus === 'REJECTED') {
      return { label: '差し戻し', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' };
    }
    if (report.submittedAt) {
      return { label: '承認待ち', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' };
    }
    return { label: '下書き', className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' };
  };

  const activityProjectLabel = (activity: WeeklyReportType['thisWeekActivities'][number]) =>
    activity.projectName?.trim() || '未紐づけ';

  const isReportInFiscalYear = (report: WeeklyReportType, fiscalYear: number) => {
    try {
      const weekStart = parseWeekString(report.week);
      return getFiscalYear(weekStart) === fiscalYear;
    } catch (error) {
      return false;
    }
  };

  // 年度でフィルタリングされた報告
  const filteredReports = useMemo(() => {
    return reports.filter(report => isReportInFiscalYear(report, selectedFiscalYear));
  }, [reports, selectedFiscalYear]);

  // 利用可能な年度の一覧
  const availableFiscalYears = useMemo(() => {
    const years = new Set<number>([getFiscalYear()]);
    [...reports, ...allReports].forEach(report => {
      try {
        const weekStart = parseWeekString(report.week);
        years.add(getFiscalYear(weekStart));
      } catch (error) {
        // パースエラーは無視
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [reports, allReports]);

  // 全員の報告を取得（週別表示用）
  useEffect(() => {
    const fetchAllReports = async () => {
      if (user?.role === 'MEMBER') return;
      
      try {
        const response = await api.get<WeeklyReportType[]>('/api/weekly-reports');
        setAllReports(response.data || []);
      } catch (error) {
        console.error('Failed to fetch all reports:', error);
        setAllReports([]);
      }
    };
    
    if (viewMode === 'weekly') {
      fetchAllReports();
    }
  }, [viewMode, user]);

  // 利用可能な週の一覧（週別表示の場合は全員の報告から、個人別表示の場合は選択したユーザーの報告から）
  const availableWeeks = useMemo(() => {
    const weeks = new Set<string>();
    const sourceReports = viewMode === 'weekly' ? allReports : reports;
    sourceReports.forEach(report => {
      if (isReportInFiscalYear(report, selectedFiscalYear)) {
        weeks.add(report.week);
      }
    });
    return Array.from(weeks).sort().reverse();
  }, [reports, allReports, selectedFiscalYear, viewMode]);

  // 全員分表示用：メンバーと報告のマッピング
  const memberReportMap = useMemo(() => {
    const map = new Map<string, WeeklyReportType | null>();
    
    // 全員のメンバーを初期化
    users.forEach(member => {
      map.set(member.id, null);
    });

    // 報告があるメンバーをマッピング
    allWeekReports.forEach(report => {
      if (report.userId) {
        map.set(report.userId, report);
      }
    });

    return map;
  }, [users, allWeekReports]);

  const weeklySummary = useMemo(() => {
    const reportsForMembers = Array.from(memberReportMap.values());
    return {
      total: reportsForMembers.length,
      submitted: reportsForMembers.filter(report => report?.submittedAt).length,
      pending: reportsForMembers.filter(report => report?.submittedAt && report.approvalStatus !== 'APPROVED' && report.approvalStatus !== 'REJECTED').length,
      approved: reportsForMembers.filter(report => report?.approvalStatus === 'APPROVED').length,
      rejected: reportsForMembers.filter(report => report?.approvalStatus === 'REJECTED').length,
      missing: reportsForMembers.filter(report => !report || !report.submittedAt).length,
    };
  }, [memberReportMap]);

  // 現在の週を取得（デフォルト選択用）
  useEffect(() => {
    if (viewMode === 'weekly' && !selectedWeek && availableWeeks.length > 0) {
      const currentWeek = getWeekString();
      
      // 利用可能な週の中にあるか確認
      if (availableWeeks.includes(currentWeek)) {
        setSelectedWeek(currentWeek);
      } else if (availableWeeks.length > 0) {
        // なければ最新の週を選択
        setSelectedWeek(availableWeeks[0]);
      }
    }
  }, [viewMode, selectedWeek, availableWeeks]);

  useEffect(() => {
    if (selectedWeek && !availableWeeks.includes(selectedWeek)) {
      setSelectedWeek('');
    }
  }, [availableWeeks, selectedWeek]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl sm:text-3xl whitespace-nowrap font-bold text-gray-900 dark:text-gray-100">
          週次報告
        </h1>
        {canCreate && (
          <Button onClick={handleCreateReport}>
            <Plus className="h-4 w-4 mr-2" />
            新規作成
          </Button>
        )}
      </div>

      {/* 表示モード切り替え（メンバー以外のみ） */}
      {canView && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-4">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setViewMode('individual');
                setSelectedWeek('');
              }}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'individual'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              個人別表示
            </button>
            <button
              onClick={() => setViewMode('weekly')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                viewMode === 'weekly'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              週別表示（全員分）
            </button>
          </div>
        </div>
      )}

      {viewMode === 'individual' ? (
        <>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-4">
            <div className="max-w-xs">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                年度で絞り込み
              </label>
              <select
                value={selectedFiscalYear}
                onChange={(e) => setSelectedFiscalYear(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                {availableFiscalYears.map(year => (
                  <option key={year} value={year}>
                    {formatFiscalYear(year)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {canView && users.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-4">
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    担当者を選択
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <LoadingSpinner />
          ) : filteredReports.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-12 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                {reports.length === 0 ? '週次報告がありません' : '該当する週次報告がありません'}
              </p>
              {canCreate && reports.length === 0 && (
                <Button onClick={handleCreateReport} className="mt-4">
                  最初の報告を作成
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {filteredReports.map((report) => {
                let weekStart: Date;
                try {
                  weekStart = parseWeekString(report.week);
                } catch (error) {
                  console.error('Failed to parse week:', report.week, error);
                  weekStart = new Date();
                }
                return (
                  <div
                    key={report.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6 hover:shadow-lg transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div 
                        className="flex-1 cursor-pointer"
                        onClick={() => canCreate ? handleEditReport(report) : undefined}
                      >
                        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                          {isNaN(weekStart.getTime()) ? report.week : formatWeekLabel(report.week)}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {report.user?.name}
                          {user?.role !== 'MEMBER' && (
                            <span className="ml-2 text-xs text-gray-400 dark:text-gray-500">（{report.user?.role}）</span>
                          )}
                        </p>
                        {user?.role !== 'MEMBER' && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {isNaN(weekStart.getTime()) 
                              ? report.week
                              : `${formatWeekLabel(report.week)}の報告`}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {report.submittedAt && (
                          <span className="px-3 py-1 bg-secondary/10 text-secondary text-sm rounded-full">
                            提出済み
                          </span>
                        )}
                        {(() => {
                          const badge = approvalBadge(report);
                          return (
                            <span className={`px-3 py-1 text-sm rounded-full ${badge.className}`} title={report.approver ? `対応者: ${report.approver.name}` : undefined}>
                              {badge.label}
                            </span>
                          );
                        })()}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReport(report);
                            setModalViewMode('preview');
                            setIsModalOpen(true);
                          }}
                          title="詳細を見る"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          詳細を見る
                        </Button>
                      </div>
                    </div>

                    <div 
                      className="space-y-4"
                      onClick={() => canCreate ? handleEditReport(report) : undefined}
                      style={{ cursor: canCreate ? 'pointer' : 'default' }}
                    >
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">今週の活動</h4>
                        <div className="space-y-2">
                          {Array.isArray(report.thisWeekActivities) &&
                            report.thisWeekActivities.slice(0, 3).map((activity, index) => (
                              <div key={index} className="text-sm text-gray-700 dark:text-gray-300">
                                <span className="font-medium">{activityProjectLabel(activity)} / {activity.date}:</span>{' '}
                                {activity.activity}
                              </div>
                            ))}
                        </div>
                      </div>

                      {report.nextWeekPlan && (
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">来週の予定</h4>
                          <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                            {report.nextWeekPlan}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <>
          {/* 週別表示（全員分） */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-4">
            <div className="flex flex-col lg:flex-row lg:items-end gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  年度を選択
                </label>
                <select
                  value={selectedFiscalYear}
                  onChange={(e) => setSelectedFiscalYear(Number(e.target.value))}
                  className="w-full md:w-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  {availableFiscalYears.map(year => (
                    <option key={year} value={year}>
                      {formatFiscalYear(year)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  対象週を選択
                </label>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  className="w-full md:w-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">週を選択してください</option>
                  {availableWeeks.map(week => {
                    try {
                      const weekStart = parseWeekString(week);
                      return (
                        <option key={week} value={week}>
                          {formatWeekLabel(week)}
                        </option>
                      );
                    } catch (error) {
                      return (
                        <option key={week} value={week}>
                          {week}
                        </option>
                      );
                    }
                  })}
                </select>
              </div>

              {selectedWeek && (
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 flex-1">
                  {[
                    { label: '対象', value: weeklySummary.total, className: 'bg-gray-50 text-gray-700 dark:bg-gray-700/60 dark:text-gray-200' },
                    { label: '提出済み', value: weeklySummary.submitted, className: 'bg-blue-50 text-blue-700 dark:bg-blue-900/25 dark:text-blue-300' },
                    { label: '承認待ち', value: weeklySummary.pending, className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-300' },
                    { label: '承認済み', value: weeklySummary.approved, className: 'bg-green-50 text-green-700 dark:bg-green-900/25 dark:text-green-300' },
                    { label: '差し戻し', value: weeklySummary.rejected, className: 'bg-red-50 text-red-700 dark:bg-red-900/25 dark:text-red-300' },
                    { label: '未提出', value: weeklySummary.missing, className: 'bg-slate-50 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300' },
                  ].map(item => (
                    <div key={item.label} className={`rounded-md px-3 py-2 ${item.className}`}>
                      <div className="text-[11px] font-medium">{item.label}</div>
                      <div className="text-lg font-bold leading-tight">{item.value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {loadingWeekView ? (
            <LoadingSpinner />
          ) : !selectedWeek ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-12 text-center">
              <p className="text-gray-500 dark:text-gray-400">週を選択してください</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from(memberReportMap.entries()).map(([userId, report]) => {
                const member = users.find(u => u.id === userId);
                if (!member) return null;

                let weekStart: Date;
                try {
                  weekStart = parseWeekString(selectedWeek);
                } catch (error) {
                  weekStart = new Date();
                }

                return (
                  <div
                    key={userId}
                    onClick={() => {
                      if (!report) return;
                      setSelectedReport(report);
                      setModalViewMode('preview');
                      setIsModalOpen(true);
                    }}
                    className={`bg-white dark:bg-gray-800 rounded-lg shadow border p-6 ${
                      report 
                        ? 'border-border dark:border-gray-700 hover:shadow-lg transition-shadow cursor-pointer'
                        : 'border-red-300 dark:border-red-700 border-2'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      {member.avatarColor && (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium"
                          style={{ backgroundColor: member.avatarColor }}
                        >
                          {(member.name || '').charAt(0)}
                        </div>
                      )}
                      <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                        {member.name}
                      </h3>
                    </div>

                    {report ? (
                      <>
                        <div className="mb-3">
                          <div className="flex items-center gap-2 mb-2">
                            {report.submittedAt && (
                              <span className="px-2 py-1 bg-secondary/10 text-secondary text-xs rounded-full">
                                提出済み
                              </span>
                            )}
                            {(() => {
                              const badge = approvalBadge(report);
                              return (
                                <span className={`px-2 py-1 text-xs rounded-full ${badge.className}`} title={report.approver ? `対応者: ${report.approver.name}` : undefined}>
                                  {badge.label}
                                </span>
                              );
                            })()}
                          </div>
                          {!report.submittedAt && (
                            <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 text-xs rounded-full">
                              未提出
                            </span>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div>
                            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">今週の活動</h4>
                            <div className="space-y-1">
                              {Array.isArray(report.thisWeekActivities) &&
                                report.thisWeekActivities.slice(0, 2).map((activity, index) => (
                                  <div key={index} className="text-xs text-gray-600 dark:text-gray-400">
                                    <span className="font-medium">{activityProjectLabel(activity)} / {activity.date}:</span>{' '}
                                    {activity.activity}
                                  </div>
                                ))}
                            </div>
                          </div>

                          {report.nextWeekPlan && (
                            <div>
                              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">来週の予定</h4>
                              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                                {report.nextWeekPlan}
                              </p>
                            </div>
                          )}

                          <div className="pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedReport(report);
                                setModalViewMode('preview');
                                setIsModalOpen(true);
                              }}
                              className="w-full"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              内容を確認
                            </Button>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">未提出</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatWeekLabel(selectedWeek)}の報告がありません
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {isModalOpen && (
        <WeeklyReportModal
          report={selectedReport}
          initialWeek={weekFromQuery || undefined}
          existingReports={reports}
          onOpenExisting={(existingReport) => {
            setSelectedReport(existingReport);
            setModalViewMode('edit');
          }}
          onClose={handleCloseModal}
          onSaved={handleSaved}
          viewMode={modalViewMode}
        />
      )}
    </div>
  );
};
