import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../utils/api';
import { WeeklyReport as WeeklyReportType } from '../types';
import { formatDate, parseWeekString } from '../utils/date';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { WeeklyReportModal } from '../components/report/WeeklyReportModal';
import { useAuthStore } from '../stores/authStore';

export const WeeklyReport: React.FC = () => {
  const { user } = useAuthStore();
  const [reports, setReports] = useState<WeeklyReportType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<WeeklyReportType | null>(null);

  useEffect(() => {
    fetchReports();
  }, [user]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      // MEMBERの場合は自分の報告のみ、他は全員の報告
      const url = user?.role === 'MEMBER' 
        ? `/api/weekly-reports?userId=${user.id}`
        : '/api/weekly-reports';
      const response = await api.get<WeeklyReportType[]>(url);
      setReports(response.data || []);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      setReports([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReport = () => {
    setSelectedReport(null);
    setIsModalOpen(true);
  };

  const handleEditReport = (report: WeeklyReportType) => {
    setSelectedReport(report);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedReport(null);
  };

  const handleSaved = () => {
    fetchReports();
    handleCloseModal();
  };

  // MEMBERのみ新規作成ボタンを表示（自分の報告のみ作成可能）
  const canCreate = user?.role === 'MEMBER' || user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT' || user?.role === 'MASTER';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">
          週次報告
          {user?.role === 'MEMBER' && <span className="text-lg font-normal text-gray-500 ml-2">（自分の報告）</span>}
        </h1>
        {canCreate && (
          <div className="flex gap-2">
            <Button 
              onClick={async () => {
                try {
                  // 現在の週を取得
                  const now = new Date();
                  const year = now.getFullYear();
                  const weekStart = new Date(now);
                  weekStart.setDate(now.getDate() - now.getDay()); // 日曜日に設定
                  const weekNum = Math.ceil((now.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
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

      {loading ? (
        <LoadingSpinner />
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-lg shadow border border-border p-12 text-center">
          <p className="text-gray-500">週次報告がありません</p>
          <Button onClick={handleCreateReport} className="mt-4">
            最初の報告を作成
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {reports.map((report) => {
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
                className="bg-white rounded-lg shadow border border-border p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleEditReport(report)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {report.week} {isNaN(weekStart.getTime()) ? '' : `- ${formatDate(weekStart, 'yyyy年M月d日週')}`}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {report.user?.name}
                      {user?.role !== 'MEMBER' && (
                        <span className="ml-2 text-xs text-gray-400">（{report.user?.role}）</span>
                      )}
                    </p>
                  </div>
                  {report.submittedAt && (
                    <span className="px-3 py-1 bg-secondary/10 text-secondary text-sm rounded-full">
                      提出済み
                    </span>
                  )}
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">今週の活動</h4>
                    <div className="space-y-2">
                      {Array.isArray(report.thisWeekActivities) &&
                        report.thisWeekActivities.slice(0, 3).map((activity, index) => (
                          <div key={index} className="text-sm text-gray-700">
                            <span className="font-medium">{activity.date}:</span>{' '}
                            {activity.activity}
                          </div>
                        ))}
                    </div>
                  </div>

                  {report.nextWeekPlan && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">来週の予定</h4>
                      <p className="text-sm text-gray-700 line-clamp-2">
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

      {isModalOpen && (
        <WeeklyReportModal
          report={selectedReport}
          onClose={handleCloseModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};
