import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ProjectModal } from '../components/project/ProjectModal';
import { Button } from '../components/common/Button';
import { UserFilter } from '../components/common/UserFilter';
import { UsageGuideModal } from '../components/common/UsageGuideModal';
import { Plus, HelpCircle, LayoutGrid, List } from 'lucide-react';
import { Task } from '../types';

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
  mission?: { id: string; missionName?: string; goalName?: string };
  projectTasks?: Task[];
  tags?: string[];
}

export const Projects: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [filterPhase, setFilterPhase] = useState<string>('all');
  const [filterApproval, setFilterApproval] = useState<string>('all');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<'view' | 'create'>('view');
  const [displayMode, setDisplayMode] = useState<'card' | 'list'>('card');
  const [isUsageGuideOpen, setIsUsageGuideOpen] = useState(false);

  const { data: projects, isLoading } = useQuery<Project[]>({
    queryKey: ['projects', selectedUserId],
    queryFn: async () => {
      const url = selectedUserId 
        ? `/api/projects?userId=${selectedUserId}`
        : '/api/projects';
      const response = await api.get(url);
      return response.data;
    }
  });

  const filteredProjects = projects?.filter(p => {
    const matchesPhase = filterPhase === 'all' || p.phase === filterPhase;
    return matchesPhase;
  });

  const handleCreateProject = () => {
    setSelectedProject(null);
    setIsModalOpen(true);
  };

  const handleEditProject = (project: Project) => {
    setSelectedProject(project);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedProject(null);
  };

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    handleCloseModal();
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
      PREPARATION: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
      EXECUTION: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
      COMPLETED: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
      REVIEW: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
    };
    return colors[phase as keyof typeof colors] || 'bg-gray-100 dark:bg-gray-700';
  };


  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  // MEMBERのみ新規作成ボタンを表示（自分のプロジェクトのみ作成可能）
  const canCreate = user?.role === 'MEMBER' || user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT' || user?.role === 'MASTER';

  // メンバー以外は閲覧と作成を分離
  const isNonMember = user?.role !== 'MEMBER';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            プロジェクト管理
            {user?.role === 'MEMBER' && <span className="text-lg font-normal text-gray-500 dark:text-gray-400 ml-2">（自分のプロジェクト）</span>}
            {isNonMember && viewMode === 'create' && <span className="text-lg font-normal text-gray-500 dark:text-gray-400 ml-2">（作成）</span>}
          </h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsUsageGuideOpen(true)}
            title="使い方を見る"
          >
            <HelpCircle className="h-4 w-4 mr-1" />
            使い方
          </Button>
        </div>
        <div className="flex gap-3">
          {isNonMember && (
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('view')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'view'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                閲覧
              </button>
              <button
                onClick={() => setViewMode('create')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  viewMode === 'create'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                個人
              </button>
            </div>
          )}
          {canCreate && viewMode === 'create' && (
            <Button onClick={handleCreateProject}>
              <Plus className="h-4 w-4 mr-2" />
              新規プロジェクト
            </Button>
          )}
        </div>
      </div>

      {viewMode === 'view' && (
        <>
          <div className="flex gap-4 flex-wrap items-center justify-between">
            <div className="flex gap-4 flex-wrap items-center">
              {isNonMember && (
                <UserFilter
                  selectedUserId={selectedUserId}
                  onUserChange={setSelectedUserId}
                  label="担当者"
                />
              )}
              <select
                value={filterPhase}
                onChange={(e) => setFilterPhase(e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">全てのフェーズ</option>
                <option value="PREPARATION">準備</option>
                <option value="EXECUTION">実施</option>
                <option value="COMPLETED">完了</option>
                <option value="REVIEW">振り返り</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDisplayMode('card')}
                className={`p-2 rounded-lg transition-colors ${
                  displayMode === 'card'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
                title="カード表示"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setDisplayMode('list')}
                className={`p-2 rounded-lg transition-colors ${
                  displayMode === 'list'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
                title="リスト表示"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          {displayMode === 'card' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects?.map((project) => (
              <div
                key={project.id}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handleEditProject(project)}
              >
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100 flex-1">
                    {project.projectName}
                  </h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${getPhaseColor(project.phase)}`}>
                    {getPhaseLabel(project.phase)}
                  </span>
                </div>

                {project.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2">
                    {project.description}
                  </p>
                )}

                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-3">
                  <span>担当: {project.user.name}</span>
                  {project.members.length > 0 && (
                    <span>+{project.members.length}名</span>
                  )}
                </div>

                {/* 方向性（Mission）表示 */}
                {project.mission && (
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                    方向性: <span className="text-gray-700 dark:text-gray-300">{project.mission.missionName || project.mission.goalName || '未設定'}</span>
                  </div>
                )}

                {/* タスク数表示 */}
                {project.projectTasks && project.projectTasks.length > 0 && (
                  <div className="text-xs text-gray-500 mb-3">
                    タスク: {project.projectTasks.length}件
                    {project.projectTasks.filter(t => t.status === 'COMPLETED').length > 0 && (
                      <span className="text-green-600 ml-1">
                        （完了: {project.projectTasks.filter(t => t.status === 'COMPLETED').length}）
                      </span>
                    )}
                    {project.projectTasks.filter(t => t.status === 'IN_PROGRESS').length > 0 && (
                      <span className="text-blue-600 ml-1">
                        （進行中: {project.projectTasks.filter(t => t.status === 'IN_PROGRESS').length}）
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-end pt-3 border-t border-gray-100">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditProject(project);
                    }}
                  >
                    {viewMode === 'view' ? '詳細' : '詳細・編集'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">プロジェクト名</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">フェーズ</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">担当者</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">方向性</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">タスク</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredProjects?.map((project) => (
                    <tr
                      key={project.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                      onClick={() => handleEditProject(project)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{project.projectName}</div>
                        {project.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">{project.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-xs px-2 py-1 rounded-full ${getPhaseColor(project.phase)}`}>
                          {getPhaseLabel(project.phase)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {project.user.name}
                        {project.members.length > 0 && <span className="ml-1">+{project.members.length}</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {project.mission?.missionName || project.mission?.goalName || '未設定'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {project.projectTasks?.length || 0}件
                        {project.projectTasks && project.projectTasks.filter(t => t.status === 'COMPLETED').length > 0 && (
                          <span className="text-green-600 ml-1">（完了: {project.projectTasks.filter(t => t.status === 'COMPLETED').length}）</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditProject(project);
                          }}
                        >
                          {viewMode === 'view' ? '詳細' : '詳細・編集'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filteredProjects?.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              プロジェクトがありません
            </div>
          )}
        </>
      )}

      {viewMode === 'create' && (
        <div className="text-center py-12 text-gray-500">
          新規プロジェクトを作成するには、右上の「新規プロジェクト」ボタンをクリックしてください。
        </div>
      )}

      {isModalOpen && (
        <ProjectModal
          project={selectedProject}
          onClose={handleCloseModal}
          onSaved={handleSaved}
          readOnly={selectedProject ? (viewMode === 'view' && isNonMember) : false}
        />
      )}

      <UsageGuideModal
        isOpen={isUsageGuideOpen}
        onClose={() => setIsUsageGuideOpen(false)}
      />
    </div>
  );
};