import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { format } from 'date-fns';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';
import { useAuthStore } from '../stores/authStore';
import { MonthlyReportDetailModal } from '../components/report/MonthlyReportDetailModal';

interface MonthlyReport {
  id: string;
  month: string;
  coverRecipient: string;
  coverSender: string;
  memberSheets: any[];
  supportRecords: any[];
  createdAt: string;
}

export const MonthlyReport: React.FC = () => {
  const { user } = useAuthStore();
  const [isCreating, setIsCreating] = useState(false);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const queryClient = useQueryClient();
  const { data: reports, isLoading, error } = useQuery<MonthlyReport[]>({
    queryKey: ['monthly-reports'],
    queryFn: async () => {
      try {
        const response = await api.get('/api/monthly-reports');
        return response.data;
      } catch (err: any) {
        // APIエンドポイントが存在しない場合は空配列を返す
        if (err.response?.status === 404) {
          return [];
        }
        throw err;
      }
    }
  });

  const downloadPDF = async (id: string, month: string) => {
    try {
      const response = await api.get(`/api/monthly-reports/${id}/pdf`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `月次報告_${month}.pdf`);
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      link.remove();
    } catch (error) {
      console.error('PDF download failed:', error);
      alert('PDF出力に失敗しました');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">月次報告</h1>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-300">
            月次報告機能は現在準備中です。
          </p>
        </div>
      </div>
    );
  }

  // SUPPORT/MASTERのみ新規作成ボタンを表示
  const canCreate = user?.role === 'SUPPORT' || user?.role === 'MASTER';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">月次報告</h1>
        {canCreate && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowMonthSelector(true)}
              disabled={isCreating}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? '作成中...' : '+ 新規作成'}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {reports?.map((report) => (
          <div key={report.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                  {report.month} 月次報告
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  作成日: {format(new Date(report.createdAt), 'yyyy年M月d日')}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadPDF(report.id, report.month)}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  📄 PDF出力
                </button>
                {canCreate && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm('この月次報告を削除しますか？')) return;
                      try {
                        await api.delete(`/api/monthly-reports/${report.id}`);
                        queryClient.invalidateQueries({ queryKey: ['monthly-reports'] });
                      } catch (error: any) {
                        alert(`削除に失敗しました: ${error?.response?.data?.error || error?.message || '不明なエラー'}`);
                      }
                    }}
                    className="text-sm text-red-600 hover:underline"
                  >
                    削除
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">宛先:</span>
                <p className="text-gray-900 dark:text-gray-100">{report.coverRecipient}</p>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">差出人:</span>
                <p className="text-gray-900 dark:text-gray-100">{report.coverSender}</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t dark:border-gray-700">
              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span>隊員別シート: {report.memberSheets.length}件</span>
                <span>支援記録: {report.supportRecords.length}件</span>
              </div>
            </div>

            <div className="flex justify-end mt-3 gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setSelectedReportId(report.id)}
              >
                詳細を見る
              </Button>
            </div>
          </div>
        ))}
      </div>

      {reports?.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          月次報告がありません
        </div>
      )}

      {showMonthSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4 dark:text-gray-100">月を選択</h2>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md mb-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowMonthSelector(false);
                  setSelectedMonth('');
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                キャンセル
              </button>
              <button
                onClick={async () => {
                  if (!selectedMonth) {
                    alert('月を選択してください');
                    return;
                  }
                  setIsCreating(true);
                  try {
                    const response = await api.post('/api/monthly-reports', {
                      month: selectedMonth,
                    });
                    queryClient.invalidateQueries({ queryKey: ['monthly-reports'] });
                    setShowMonthSelector(false);
                    setSelectedMonth('');
                  } catch (error: any) {
                    alert(`月次報告の作成に失敗しました: ${error?.response?.data?.error || error?.message || '不明なエラー'}`);
                  } finally {
                    setIsCreating(false);
                  }
                }}
                disabled={isCreating || !selectedMonth}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {isCreating ? '作成中...' : '作成'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedReportId && (
        <MonthlyReportDetailModal
          reportId={selectedReportId}
          onClose={() => setSelectedReportId(null)}
          onUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['monthly-reports'] });
          }}
        />
      )}
    </div>
  );
};