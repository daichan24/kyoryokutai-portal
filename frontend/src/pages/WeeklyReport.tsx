import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../utils/api';
import { WeeklyReport as WeeklyReportType } from '../types';
import { formatDate, parseWeekString } from '../utils/date';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { WeeklyReportModal } from '../components/report/WeeklyReportModal';

export const WeeklyReport: React.FC = () => {
  const [reports, setReports] = useState<WeeklyReportType[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<WeeklyReportType | null>(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await api.get<WeeklyReportType[]>('/api/weekly-reports');
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">週次報告</h1>
        <Button onClick={handleCreateReport}>
          <Plus className="h-4 w-4 mr-2" />
          新規作成
        </Button>
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
            const weekStart = parseWeekString(report.week);
            return (
              <div
                key={report.id}
                className="bg-white rounded-lg shadow border border-border p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleEditReport(report)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      {report.week} - {formatDate(weekStart, 'yyyy年M月d日週')}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {report.user?.name}
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
