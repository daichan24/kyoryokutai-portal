import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Plus } from 'lucide-react';
import { Button } from '../common/Button';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

interface Project {
  id: string;
  projectName: string;
  phase: 'PREPARATION' | 'EXECUTION' | 'COMPLETED' | 'REVIEW';
  approvalStatus: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED';
  user: { id: string; name: string };
}

interface ProjectsWidgetProps {
  showAddButton?: boolean;
  onAddClick?: () => void;
}

export const ProjectsWidget: React.FC<ProjectsWidgetProps> = ({
  showAddButton = false,
  onAddClick,
}) => {
  const { user } = useAuthStore();
  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ['projects-widget'],
    queryFn: async () => {
      const response = await api.get('/api/projects');
      return (response.data || []).slice(0, 5); // 最新5件
    },
  });

  const phaseLabels: Record<string, string> = {
    PREPARATION: '準備中',
    EXECUTION: '実行中',
    COMPLETED: '完了',
    REVIEW: 'レビュー中',
  };

  const statusColors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
    APPROVED: 'bg-green-100 text-green-700',
    REJECTED: 'bg-red-100 text-red-700',
  };

  return (
    <div className="bg-white rounded-lg shadow border border-border p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-900">プロジェクト</h3>
        {showAddButton && (user?.role === 'MEMBER' || user?.role === 'SUPPORT' || user?.role === 'MASTER') && (
          <Link to="/projects">
            <Button size="sm" className="flex items-center gap-1">
              <Plus className="w-4 h-4" />
              追加
            </Button>
          </Link>
        )}
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : !projects || projects.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">プロジェクトがありません</p>
      ) : (
        <div className="space-y-2">
          {projects.map((project) => (
            <Link
              key={project.id}
              to="/projects"
              className="block p-2 border border-gray-200 rounded hover:bg-gray-50"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {project.projectName}
                  </p>
                  <p className="text-xs text-gray-500">{project.user.name}</p>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                    {phaseLabels[project.phase] || project.phase}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${statusColors[project.approvalStatus] || statusColors.DRAFT}`}>
                    {project.approvalStatus === 'DRAFT' ? '下書き' :
                     project.approvalStatus === 'PENDING' ? '承認待ち' :
                     project.approvalStatus === 'APPROVED' ? '承認済' : '却下'}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

