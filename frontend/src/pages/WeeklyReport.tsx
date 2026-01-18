import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Plus, Trash2, Calendar, Eye } from 'lucide-react';
import { api } from '../utils/api';
import { WeeklyReport as WeeklyReportType } from '../types';
import { formatDate, parseWeekString, getWeekString } from '../utils/date';
import { format, startOfWeek } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { WeeklyReportModal } from '../components/report/WeeklyReportModal';
import { useAuthStore } from '../stores/authStore';

export const WeeklyReport: React.FC = () => {
  const { user } = useAuthStore();
  const [reports, setReports] = useState<WeeklyReportType[]>([]);
  const [allWeekReports, setAllWeekReports] = useState<WeeklyReportType[]>([]); // 選択した週の全員分の報告
  const [loading, setLoading] = useState(true);
  const [loadingWeekView, setLoadingWeekView] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<WeeklyReportType | null>(null);
  const [modalViewMode, setModalViewMode] = useState<'edit' | 'preview'>('edit');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [users, setUsers] = useState<Array<{ id: string; name: string; role: string; avatarColor?: string }>>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>('all'); // 月のフィルタ
  const [selectedWeek, setSelectedWeek] = useState<string>(''); // 週の選択（全員分表示用）
  const [viewMode, setViewMode] = useState<'individual' | 'weekly'>('individual'); // 表示モード

  // ユーザー一覧の取得（メンバー以外のみ）
  useEffect(() => {
    const loadUsers = async () => {
      if (user?.role === 'MEMBER') {
        setUsers([]);
        return;
      }
      
      try {
        const response = await api.get('/api/users');
        const memberUsers = response.data.filter((u: any) => 
          u.role === 'MEMBER' && u.name !== '佐藤大地'
        );
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

  const handleDelete = async (reportId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // カードのクリックイベントを防ぐ
    if (!confirm('この週次報告を削除しますか？')) return;
    
    try {
      await api.delete(`/api/weekly-reports/${reportId}`);
      fetchReports();
      if (viewMode === 'weekly' && selectedWeek) {
        fetchAllWeekReports(selectedWeek);
      }
    } catch (error) {
      console.error('Failed to delete report:', error);
      alert('削除に失敗しました');
    }
  };

  // 月でフィルタリングされた報告
  const filteredReports = useMemo(() => {
    if (selectedMonth === 'all') return reports;

    return reports.filter(report => {
      try {
        const weekStart = parseWeekString(report.week);
        const monthStr = format(weekStart, 'yyyy-MM');
        return monthStr === selectedMonth;
      } catch (error) {
        return false;
      }
    });
  }, [reports, selectedMonth]);

  // 利用可能な月の一覧
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    reports.forEach(report => {
      try {
        const weekStart = parseWeekString(report.week);
        const monthStr = format(weekStart, 'yyyy-MM');
        months.add(monthStr);
      } catch (error) {
        // パースエラーは無視
      }
    });
    return Array.from(months).sort().reverse();
  }, [reports]);

  // 利用可能な週の一覧
  const availableWeeks = useMemo(() => {
    const weeks = new Set<string>();
    reports.forEach(report => {
      weeks.add(report.week);
    });
    return Array.from(weeks).sort().reverse();
  }, [reports]);

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

  // 現在の週を取得（デフォルト選択用）
  useEffect(() => {
    if (viewMode === 'weekly' && !selectedWeek && availableWeeks.length > 0) {
      // 現在の週を計算
      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // 月曜日開始
      const year = weekStart.getFullYear();
      const firstDayOfYear = new Date(year, 0, 1);
      const daysSinceFirstDay = Math.floor((weekStart.getTime() - firstDayOfYear.getTime()) / (1000 * 60 * 60 * 24));
      const weekNum = Math.ceil((daysSinceFirstDay + firstDayOfYear.getDay() + 1) / 7);
      const currentWeek = `${year}-${String(weekNum).padStart(2, '0')}`;
      
      // 利用可能な週の中にあるか確認
      if (availableWeeks.includes(currentWeek)) {
        setSelectedWeek(currentWeek);
      } else if (availableWeeks.length > 0) {
        // なければ最新の週を選択
        setSelectedWeek(availableWeeks[0]);
      }
    }
  }, [viewMode, selectedWeek, availableWeeks]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
          週次報告
          {user?.role === 'MEMBER' && <span className="text-lg font-normal text-gray-500 dark:text-gray-400 ml-2">（自分の報告）</span>}
        </h1>
        {canCreate && (
          <div className="flex gap-2">
            <Button 
              onClick={async () => {
                try {
                  // 現在の週を取得
                  const now = new Date();
                  const weekStart = startOfWeek(now, { weekStartsOn: 1 }); // 月曜日開始
                  const year = weekStart.getFullYear();
                  const firstDayOfYear = new Date(year, 0, 1);
                  const daysSinceFirstDay = Math.floor((weekStart.getTime() - firstDayOfYear.getTime()) / (1000 * 60 * 60 * 24));
                  const weekNum = Math.ceil((daysSinceFirstDay + firstDayOfYear.getDay() + 1) / 7);
                  const week = `${year}-${String(weekNum).padStart(2, '0')}`;
                  
                  const response = await api.post('/api/weekly-reports/draft', { week });
                  setSelectedReport(response.data);
                  setIsModalOpen(true);
                } catch (error: any) {
                  console.error('Failed to generate draft:', error);
                  alert(error?.response?.data?.error || '自動作成に失敗しました');
                }
              }}
              variant="outline"
            >
              🤖 自動作成
            </Button>
            <Button onClick={handleCreateReport}>
              <Plus className="h-4 w-4 mr-2" />
              新規作成
            </Button>
          </div>
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
          {canView && users.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    対象月で絞り込み
                  </label>
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="all">全ての月</option>
                    {availableMonths.map(month => (
                      <option key={month} value={month}>
                        {format(new Date(`${month}-01`), 'yyyy年M月', { locale: ja })}
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
                          {report.week} {isNaN(weekStart.getTime()) ? '' : `- ${formatDate(weekStart, 'yyyy年M月d日週')}`}
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
                              : `${formatDate(weekStart, 'yyyy年M月d日')}週の報告`}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {report.submittedAt && (
                          <span className="px-3 py-1 bg-secondary/10 text-secondary text-sm rounded-full">
                            提出済み
                          </span>
                        )}
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
                        {canCreate && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={(e) => handleDelete(report.id, e)}
                            title="削除"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            削除
                          </Button>
                        )}
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
                                <span className="font-medium">{activity.date}:</span>{' '}
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
                      {week} - {formatDate(weekStart, 'yyyy年M月d日週')}
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
                    className={`bg-white dark:bg-gray-800 rounded-lg shadow border p-6 ${
                      report 
                        ? 'border-border dark:border-gray-700 hover:shadow-lg transition-shadow'
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
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {selectedWeek}
                            </span>
                            {report.submittedAt && (
                              <span className="px-2 py-1 bg-secondary/10 text-secondary text-xs rounded-full">
                                提出済み
                              </span>
                            )}
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
                                    <span className="font-medium">{activity.date}:</span>{' '}
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
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">未提出</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {formatDate(weekStart, 'yyyy年M月d日')}週の報告がありません
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
          onClose={handleCloseModal}
          onSaved={handleSaved}
          viewMode={modalViewMode}
        />
      )}
    </div>
  );
};
