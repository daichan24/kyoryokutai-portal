import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

interface Project {
  id: string;
  projectName: string;
  description?: string;
  phase: 'PREPARATION' | 'EXECUTION' | 'COMPLETED' | 'REVIEW';
  approvalStatus: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
  startDate?: string;
  endDate?: string;
  user: { id: string; name: string };
  members: any[];
  goal?: { id: string; goalName: string };
}

export const Projects: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [filterPhase, setFilterPhase] = useState<string>('all');
  const [filterApproval, setFilterApproval] = useState<string>('all');

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await api.get('/api/projects');
      return response.data;
    }
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return api.post(`/api/projects/${id}/approve`, { approvalStatus: status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    }
  });

  const filteredProjects = projects?.filter(p => {
    const matchesPhase = filterPhase === 'all' || p.phase === filterPhase;
    const matchesApproval = filterApproval === 'all' || p.approvalStatus === filterApproval;
    return matchesPhase && matchesApproval;
  });

  const handleApprove = (id: string, status: string) => {
    if (confirm(`このプロジェクトを${status === 'APPROVED' ? '承認' : '差し戻し'}しますか？`)) {
      approveMutation.mutate({ id, status });
    }
  };

  const getPhaseLabel = (phase: string) => {
    const labels = {
      PREPARATION: '準備',
      EXECUTION: '実施',
      COMPLETED: '完了',
      REVIEW: '振り返り'
    };
    return labels[phase as keyof typeof labels] || phase;
  };

  const getPhaseColor = (phase: string) => {
    const colors = {
      PREPARATION: 'bg-yellow-100 text-yellow-800',
      EXECUTION: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
      REVIEW: 'bg-gray-100 text-gray-800'
    };
    return colors[phase as keyof typeof colors] || 'bg-gray-100';
  };

  const getApprovalLabel = (status: string) => {
    const labels = {
      DRAFT: '下書き',
      PENDING: '承認待ち',
      APPROVED: '承認済',
      REJECTED: '差し戻し'
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getApprovalColor = (status: string) => {
    const colors = {
      DRAFT: 'bg-gray-100 text-gray-800',
      PENDING: 'bg-yellow-100 text-yellow-800',
      APPROVED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100';
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
        <h1 className="text-2xl font-bold text-gray-900">プロジェクト管理</h1>
        <button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors">
          + 新規プロジェクト
        </button>
      </div>

      <div className="flex gap-4">
        <select
          value={filterPhase}
          onChange={(e) => setFilterPhase(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">全てのフェーズ</option>
          <option value="PREPARATION">準備</option>
          <option value="EXECUTION">実施</option>
          <option value="COMPLETED">完了</option>
          <option value="REVIEW">振り返り</option>
        </select>

        {(user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT' || user?.role === 'MASTER') && (
          <select
            value={filterApproval}
            onChange={(e) => setFilterApproval(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">全ての承認状態</option>
            <option value="PENDING">承認待ち</option>
            <option value="APPROVED">承認済</option>
            <option value="REJECTED">差し戻し</option>
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProjects?.map((project) => (
          <div
            key={project.id}
            className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-lg transition-shadow"
          >
            <div className="flex justify-between items-start mb-3">
              <h3 className="font-semibold text-lg text-gray-900 flex-1">
                {project.projectName}
              </h3>
              <span className={`text-xs px-2 py-1 rounded-full ${getPhaseColor(project.phase)}`}>
                {getPhaseLabel(project.phase)}
              </span>
            </div>

            {project.description && (
              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                {project.description}
              </p>
            )}

            <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
              <span>担当: {project.user.name}</span>
              {project.members.length > 0 && (
                <span>+{project.members.length}名</span>
              )}
            </div>

            {project.goal && (
              <div className="text-xs bg-purple-50 border border-purple-200 rounded px-2 py-1 mb-3">
                目標: {project.goal.goalName}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <span className={`text-xs px-2 py-1 rounded-full ${getApprovalColor(project.approvalStatus)}`}>
                {getApprovalLabel(project.approvalStatus)}
              </span>
              <button className="text-sm text-blue-600 hover:underline">
                詳細 →
              </button>
            </div>

            {(user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT' || user?.role === 'MASTER') &&
              project.approvalStatus === 'PENDING' && (
                <div className="flex gap-2 mt-3 pt-3 border-t">
                  <button
                    onClick={() => handleApprove(project.id, 'APPROVED')}
                    className="flex-1 bg-green-500 text-white text-sm px-3 py-2 rounded hover:bg-green-600 transition-colors"
                  >
                    承認
                  </button>
                  <button
                    onClick={() => handleApprove(project.id, 'REJECTED')}
                    className="flex-1 border border-gray-300 text-sm px-3 py-2 rounded hover:bg-gray-50 transition-colors"
                  >
                    差し戻し
                  </button>
                </div>
              )}
          </div>
        ))}
      </div>

      {filteredProjects?.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          プロジェクトがありません
        </div>
      )}
    </div>
  );
};