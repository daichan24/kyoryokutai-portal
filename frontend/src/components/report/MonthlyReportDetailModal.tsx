import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, FileDown, Edit2, History } from 'lucide-react';
import { api } from '../../utils/api';
import { format } from 'date-fns';
import { Button } from '../common/Button';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useAuthStore } from '../../stores/authStore';

interface MonthlyReport {
  id: string;
  month: string;
  coverRecipient: string;
  coverSender: string;
  memberSheets: any[];
  supportRecords: Array<{
    id: string;
    supportDate: string;
    supportContent: string;
    supportBy: string;
    user: {
      id: string;
      name: string;
    };
  }>;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    name: string;
  };
  revisions?: Array<{
    id: string;
    changedBy: string;
    changer: {
      id: string;
      name: string;
    };
    changes: any;
    reason: string | null;
    createdAt: string;
  }>;
}

interface MonthlyReportDetailModalProps {
  reportId: string;
  onClose: () => void;
  onEdit?: () => void;
}

export const MonthlyReportDetailModal: React.FC<MonthlyReportDetailModalProps> = ({
  reportId,
  onClose,
  onEdit,
}) => {
  const { user } = useAuthStore();
  const [showRevisions, setShowRevisions] = useState(false);

  const { data: report, isLoading } = useQuery<MonthlyReport>({
    queryKey: ['monthly-report', reportId],
    queryFn: async () => {
      const response = await api.get(`/api/monthly-reports/${reportId}`);
      return response.data;
    },
  });

  const downloadPDF = async () => {
    try {
      const response = await api.get(`/api/monthly-reports/${reportId}/pdf`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `月次報告_${report?.month}.pdf`);
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      link.remove();
    } catch (error) {
      console.error('PDF download failed:', error);
      alert('PDF出力に失敗しました');
    }
  };

  const canEdit = user?.role === 'MASTER' || (!report?.submittedAt && (user?.role === 'SUPPORT' || user?.role === 'MASTER'));

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-6">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
          <h2 className="text-2xl font-bold">{report.month} 月次報告</h2>
          <div className="flex items-center gap-2">
            {canEdit && onEdit && (
              <Button onClick={onEdit} variant="outline" size="sm">
                <Edit2 className="h-4 w-4 mr-1" />
                編集
              </Button>
            )}
            <Button onClick={downloadPDF} variant="outline" size="sm">
              <FileDown className="h-4 w-4 mr-1" />
              PDF出力
            </Button>
            {report.revisions && report.revisions.length > 0 && (
              <Button
                onClick={() => setShowRevisions(!showRevisions)}
                variant="outline"
                size="sm"
              >
                <History className="h-4 w-4 mr-1" />
                変更履歴
              </Button>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {showRevisions && report.revisions && report.revisions.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-bold text-lg mb-3">変更履歴</h3>
              <div className="space-y-3">
                {report.revisions.map((revision) => (
                  <div key={revision.id} className="border-l-4 border-yellow-400 pl-3">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium">{revision.changer.name}</span>
                      <span className="text-sm text-gray-600">
                        {format(new Date(revision.createdAt), 'yyyy年M月d日 H:mm')}
                      </span>
                    </div>
                    {revision.reason && (
                      <p className="text-sm text-gray-700 mb-1">理由: {revision.reason}</p>
                    )}
                    <pre className="text-xs text-gray-600 bg-white p-2 rounded overflow-auto">
                      {JSON.stringify(revision.changes, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium text-gray-700">作成者:</span>
              <p className="text-gray-900">{report.creator.name}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">作成日:</span>
              <p className="text-gray-900">{format(new Date(report.createdAt), 'yyyy年M月d日')}</p>
            </div>
            {report.submittedAt && (
              <div>
                <span className="text-sm font-medium text-gray-700">提出日:</span>
                <p className="text-gray-900">{format(new Date(report.submittedAt), 'yyyy年M月d日')}</p>
              </div>
            )}
          </div>

          <div>
            <h3 className="font-bold text-lg mb-3">支援内容</h3>
            {report.supportRecords.length === 0 ? (
              <p className="text-gray-500">支援記録がありません</p>
            ) : (
              <div className="space-y-3">
                {report.supportRecords.map((record) => (
                  <div key={record.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="font-medium">{record.user.name}</span>
                        <span className="text-sm text-gray-600 ml-2">
                          {format(new Date(record.supportDate), 'M月d日')}
                        </span>
                      </div>
                      <span className="text-sm text-gray-600">{record.supportBy}</span>
                    </div>
                    <div
                      className="text-gray-900 prose max-w-none"
                      dangerouslySetInnerHTML={{ __html: record.supportContent }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="font-bold text-lg mb-3">隊員別シート</h3>
            {Array.isArray(report.memberSheets) && report.memberSheets.length > 0 ? (
              <div className="space-y-4">
                {report.memberSheets.map((sheet: any, index: number) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium mb-2">{sheet.userName}</h4>
                    {sheet.thisMonthActivities && sheet.thisMonthActivities.length > 0 && (
                      <div className="mb-2">
                        <span className="text-sm font-medium text-gray-700">今月の活動:</span>
                        <ul className="list-disc list-inside text-sm text-gray-700 ml-2">
                          {sheet.thisMonthActivities.map((activity: any, i: number) => (
                            <li key={i}>
                              {activity.date}: {activity.description}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">隊員別シートがありません</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

