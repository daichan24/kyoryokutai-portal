import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';
import { format } from 'date-fns';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { InspectionModal } from '../components/inspection/InspectionModal';
import { InspectionDetailModal } from '../components/inspection/InspectionDetailModal';
import { Button } from '../components/common/Button';
import { Plus } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

interface Inspection {
  id: string;
  date: string;
  destination: string;
  purpose: string;
  inspectionPurpose: string;
  inspectionContent: string;
  reflection: string;
  futureAction: string;
  participants: string[];
  user: { id: string; name: string };
  project?: { id: string; projectName: string };
  schedule?: { id: string; title?: string | null; startDate?: string | null; locationText?: string | null } | null;
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvalComment?: string | null;
  approvedAt?: string | null;
  approver?: { id: string; name: string } | null;
}

export const Inspections: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedInspectionId, setSelectedInspectionId] = useState<string | null>(null);
  const scheduleIdFromQuery = searchParams.get('scheduleId') || undefined;
  const inspectionIdFromQuery = searchParams.get('inspectionId') || undefined;

  const initialInspectionData = useMemo(() => {
    if (!scheduleIdFromQuery) return undefined;
    const destination = searchParams.get('destination') || undefined;
    const purpose = searchParams.get('purpose') || undefined;
    const inspectionContent = [destination, purpose].filter(Boolean).join('\n');
    return {
      scheduleId: scheduleIdFromQuery,
      userId: searchParams.get('userId') || undefined,
      date: searchParams.get('date') || undefined,
      destination,
      purpose,
      inspectionPurpose: purpose ? `${purpose}について確認・報告するため。` : '',
      inspectionContent,
      projectId: searchParams.get('projectId') || undefined,
    };
  }, [scheduleIdFromQuery, searchParams]);

  useEffect(() => {
    if (scheduleIdFromQuery) {
      setIsModalOpen(true);
    }
  }, [scheduleIdFromQuery]);

  useEffect(() => {
    if (inspectionIdFromQuery) {
      setSelectedInspectionId(inspectionIdFromQuery);
    }
  }, [inspectionIdFromQuery]);

  const { data: inspections, isLoading } = useQuery<Inspection[]>({
    queryKey: ['inspections', user?.id],
    queryFn: async () => {
      // MEMBERの場合は自分の視察のみ、他は全員の視察
      const url = user?.role === 'MEMBER' 
        ? `/api/inspections?userId=${user.id}`
        : '/api/inspections';
      const response = await api.get(url);
      return response.data;
    }
  });

  const handleCreateInspection = () => {
    setIsModalOpen(true);
  };

  const clearScheduleParams = () => {
    if (!scheduleIdFromQuery) return;
    const next = new URLSearchParams(searchParams);
    ['scheduleId', 'userId', 'date', 'destination', 'purpose', 'projectId'].forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    clearScheduleParams();
  };

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['inspections'] });
    handleCloseModal();
  };

  const approvalBadge = (inspection: Inspection) => {
    if (inspection.approvalStatus === 'APPROVED') {
      return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">承認済み</span>;
    }
    if (inspection.approvalStatus === 'REJECTED') {
      return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">差し戻し</span>;
    }
    return <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">未承認</span>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  // MEMBERのみ新規作成ボタンを表示（自分の視察のみ作成可能）
  const canCreate = user?.role === 'MEMBER' || user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT' || user?.role === 'MASTER';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">復命書</h1>
        {canCreate && (
          <Button onClick={handleCreateInspection}>
            <Plus className="h-4 w-4 mr-2" />
            新規作成
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {inspections?.map((inspection) => (
          <div key={inspection.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{inspection.destination}</h3>
                  {approvalBadge(inspection)}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {format(new Date(inspection.date), 'yyyy年M月d日')}
                </p>
                {inspection.approver && inspection.approvedAt && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    対応: {inspection.approver.name}（{format(new Date(inspection.approvedAt), 'M/d HH:mm')}）
                  </p>
                )}
                {inspection.approvalComment && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">差し戻し理由: {inspection.approvalComment}</p>
                )}
              </div>
              {inspection.schedule && (
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/25 dark:text-blue-300">
                  予定に添付済み
                </span>
              )}
            </div>

            <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
              <p>
                <span className="font-medium">目的:</span> {inspection.purpose}
              </p>
              {inspection.project && (
                <p>
                  <span className="font-medium">プロジェクト:</span> {inspection.project.projectName}
                </p>
              )}
              {inspection.schedule && (
                <p className="text-blue-600 dark:text-blue-300">
                  <span className="font-medium">関連予定:</span> {inspection.schedule.title || inspection.schedule.locationText || '予定'}
                  {inspection.schedule.startDate ? `（${format(new Date(inspection.schedule.startDate), 'M月d日')}）` : ''}
                </p>
              )}
              {inspection.participants.length > 0 && (
                <p>
                  <span className="font-medium">参加者:</span> {inspection.user.name}、{inspection.participants.join('、')}
                </p>
              )}
            </div>

            <div className="flex justify-end mt-3 pt-3 border-t dark:border-gray-700 gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setSelectedInspectionId(inspection.id)}
              >
                詳細を見る
              </Button>
            </div>
          </div>
        ))}
      </div>

      {inspections?.length === 0 && (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          復命書の登録がありません
        </div>
      )}

      {isModalOpen && (
        <InspectionModal
          initialData={initialInspectionData}
          onClose={handleCloseModal}
          onSaved={handleSaved}
        />
      )}

      {selectedInspectionId && (
        <InspectionDetailModal
          inspectionId={selectedInspectionId}
          onClose={() => {
            setSelectedInspectionId(null);
            if (inspectionIdFromQuery) {
              const next = new URLSearchParams(searchParams);
              next.delete('inspectionId');
              setSearchParams(next, { replace: true });
            }
          }}
          onUpdated={() => {
            queryClient.invalidateQueries({ queryKey: ['inspections'] });
          }}
        />
      )}
    </div>
  );
};
