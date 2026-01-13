import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { format } from 'date-fns';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

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
  const [isCreating, setIsCreating] = useState(false);
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
        <h1 className="text-2xl font-bold text-gray-900">月次報告</h1>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-yellow-800">
            月次報告機能は現在準備中です。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">月次報告</h1>
        <button 
          onClick={async () => {
            console.log('🔵 [UI] 月次報告新規作成ボタンがクリックされました');
            setIsCreating(true);
            try {
              const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
              const response = await api.post('/api/monthly-reports', {
                month: currentMonth,
              });
              console.log('✅ [UI] 月次報告作成成功:', response.data);
              queryClient.invalidateQueries({ queryKey: ['monthly-reports'] });
            } catch (error: any) {
              console.error('❌ [UI] 月次報告作成失敗:', error);
              alert(`月次報告の作成に失敗しました: ${error?.response?.data?.error || error?.message || '不明なエラー'}`);
            } finally {
              setIsCreating(false);
            }
          }}
          disabled={isCreating}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCreating ? '作成中...' : '+ 新規作成'}
        </button>
      </div>

      <div className="space-y-4">
        {reports?.map((report) => (
          <div key={report.id} className="bg-white border border-gray-200 rounded-lg p-5">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-lg text-gray-900">
                  {report.month} 月次報告
                </h3>
                <p className="text-sm text-gray-600">
                  作成日: {format(new Date(report.createdAt), 'yyyy年M月d日')}
                </p>
              </div>
              <button
                onClick={() => downloadPDF(report.id, report.month)}
                className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
              >
                📄 PDF出力
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">宛先:</span>
                <p className="text-gray-900">{report.coverRecipient}</p>
              </div>
              <div>
                <span className="text-gray-600">差出人:</span>
                <p className="text-gray-900">{report.coverSender}</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <span>隊員別シート: {report.memberSheets.length}件</span>
                <span>支援記録: {report.supportRecords.length}件</span>
              </div>
            </div>

            <div className="flex justify-end mt-3">
              <button className="text-sm text-blue-600 hover:underline">
                詳細を見る →
              </button>
            </div>
          </div>
        ))}
      </div>

      {reports?.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          月次報告がありません
        </div>
      )}
    </div>
  );
};