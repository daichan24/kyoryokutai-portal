import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { format } from 'date-fns';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { InspectionModal } from '../components/inspection/InspectionModal';
import { Button } from '../components/common/Button';
import { Plus } from 'lucide-react';

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
}

export const Inspections: React.FC = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: inspections, isLoading } = useQuery<Inspection[]>({
    queryKey: ['inspections'],
    queryFn: async () => {
      const response = await api.get('/api/inspections');
      return response.data;
    }
  });

  const downloadPDF = async (id: string, destination: string, date: string) => {
    try {
      const response = await api.get(`/api/inspections/${id}/pdf`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `視察復命書_${format(new Date(date), 'yyyyMMdd')}_${destination}.pdf`);
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      link.remove();
    } catch (error) {
      console.error('PDF download failed:', error);
      alert('PDF出力に失敗しました');
    }
  };

  const handleCreateInspection = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['inspections'] });
    handleCloseModal();
  };

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
        <h1 className="text-2xl font-bold text-gray-900">視察記録</h1>
        <Button onClick={handleCreateInspection}>
          <Plus className="h-4 w-4 mr-2" />
          新規視察記録
        </Button>
      </div>

      <div className="space-y-4">
        {inspections?.map((inspection) => (
          <div key={inspection.id} className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold text-lg text-gray-900">{inspection.destination}</h3>
                <p className="text-sm text-gray-600">
                  {format(new Date(inspection.date), 'yyyy年M月d日')}
                </p>
              </div>
              <button
                onClick={() => downloadPDF(inspection.id, inspection.destination, inspection.date)}
                className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
              >
                📄 PDF出力
              </button>
            </div>

            <div className="text-sm text-gray-700 space-y-2">
              <p>
                <span className="font-medium">目的:</span> {inspection.purpose}
              </p>
              {inspection.project && (
                <p>
                  <span className="font-medium">プロジェクト:</span> {inspection.project.projectName}
                </p>
              )}
              {inspection.participants.length > 0 && (
                <p>
                  <span className="font-medium">参加者:</span> {inspection.user.name}、{inspection.participants.join('、')}
                </p>
              )}
            </div>

            <div className="flex justify-end mt-3 pt-3 border-t">
              <button className="text-sm text-blue-600 hover:underline">
                詳細を見る →
              </button>
            </div>
          </div>
        ))}
      </div>

      {inspections?.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          視察記録がありません
        </div>
      )}

      {isModalOpen && (
        <InspectionModal
          onClose={handleCloseModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};