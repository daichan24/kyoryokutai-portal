import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { Button } from '../common/Button';
import { Plus, Edit2, Trash2, CheckCircle2, Circle, ChevronDown, ChevronRight, Trophy } from 'lucide-react';
import { Task, Project } from '../../types';
import { TaskModal } from '../project/TaskModal';
import { ProjectModal } from '../project/ProjectModal';
import { useAuthStore } from '../../stores/authStore';

interface MissionDetailContentProps {
  missionId: string;
  viewMode?: 'view' | 'create';
}

interface ProjectWithTasks extends Project {
  relatedTasks?: Task[];
  isAchieved?: boolean;
  achievedAt?: string;
}

export const MissionDetailContent: React.FC<MissionDetailContentProps> = ({ missionId, viewMode = 'view' }) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectWithTasks | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [togglingProjectId, setTogglingProjectId] = useState<string | null>(null);

  const { data: projects = [], isLoading: projectsLoading } = useQuery<ProjectWithTasks[]>({
    queryKey: ['projects', missionId],
    queryFn: async () => {
      const missionResponse = await api.get(`/api/missions/${missionId}`);
      const mission = missionResponse.data;
      const response = await api.get(`/api/projects?missionId=${missionId}&userId=${mission.userId}`);
      return (response.data || []).map((project: any) => ({
        ...project,
        relatedTasks: project.relatedTasks || [],
      }));
    },
  });

  const { data: tasksWithoutProject = [] } = useQuery<Task[]>({
    queryKey: ['tasks', missionId, 'without-project'],
    queryFn: async () => {
      const response = await api.get(`/api/missions/${missionId}/tasks`);
      return (response.data || []).filter((task: Task) => !task.projectId);
    },
  });

  const toggleProject = (projectId: string) => {
    const newSet = new Set(expandedProjects);
    if (newSet.has(projectId)) newSet.delete(projectId);
    else newSet.add(projectId);
    setExpandedProjects(newSet);
  };

  const handleToggleAchieved = async (project: ProjectWithTasks, e: React.MouseEvent) => {
    e.stopPropagation();
    if (togglingProjectId) return;
    setTogglingProjectId(project.id);
    try {
      await api.post(`/api/projects/${project.id}/toggle-achieved`);
      queryClient.invalidateQueries({ queryKey: ['projects', missionId] });
    } catch {
      alert('更新に失敗しました');
    } finally {
      setTogglingProjectId(null);
    }
  };

  const handleCreateProject = () => {
    setSelectedProject(null);
    setIsProjectModalOpen(true);
  };

  const handleEditProject = (project: ProjectWithTasks, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedProject(project);
    setIsProjectModalOpen(true);
  };

  const handleProjectSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['projects', missionId] });
    setIsProjectModalOpen(false);
    setSelectedProject(null);
  };

  const handleCreateTask = (projectId?: string) => {
    setSelectedTask(null);
    setSelectedProjectId(projectId || null);
    setIsNewTaskModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setSelectedProjectId(task.projectId || null);
    setIsNewTaskModalOpen(true);
  };

  const handleDeleteTask = async (taskId: string, projectId?: string) => {
    if (!confirm('このタスクを削除しますか？')) return;
    try {
      if (projectId) {
        await api.delete(`/api/projects/${projectId}/tasks/${taskId}`);
      } else {
        await api.delete(`/api/missions/${missionId}/tasks/${taskId}`);
      }
      queryClient.invalidateQueries({ queryKey: ['projects', missionId] });
      queryClient.invalidateQueries({ queryKey: ['tasks', missionId, 'without-project'] });
    } catch {
      alert('削除に失敗しました');
    }
  };

  const handleTaskSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['projects', missionId] });
    queryClient.invalidateQueries({ queryKey: ['tasks', missionId, 'without-project'] });
    setIsNewTaskModalOpen(false);
    setSelectedTask(null);
    setSelectedProjectId(null);
  };

  // ミッション進捗計算（達成プロジェクト数 / 全プロジェクト数）
  const totalProjects = projects.length;
  const achievedProjects = projects.filter(p => p.isAchieved).length;
  const missionProgress = totalProjects > 0 ? Math.round((achievedProjects / totalProjects) * 100) : 0;

  const canEdit = user?.role === 'MEMBER' || viewMode === 'create';

  return (
    <>
      <div className="space-y-4">
        {/* ミッション進捗バー */}
        {totalProjects > 0 && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">ミッション達成度</span>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{missionProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-500"
                style={{ width: `${missionProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {achievedProjects} / {totalProjects} プロジェクト達成
              {totalProjects > 0 && <span className="ml-1">（各プロジェクト {Math.round(100 / totalProjects)}%）</span>}
            </p>
          </div>
        )}

        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">プロジェクト</h3>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={handleCreateProject}>
              <Plus className="h-4 w-4 mr-1" />追加
            </Button>
          )}
        </div>

        {projectsLoading ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">読み込み中...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">プロジェクトがありません</div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => {
              const weight = totalProjects > 0 ? Math.round(100 / totalProjects) : 0;
              const isExpanded = expandedProjects.has(project.id);
              const projectTasks = project.relatedTasks || [];

              return (
                <div key={project.id}
                  className={`border rounded-lg overflow-hidden transition-colors ${
                    project.isAchieved
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                      : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                  }`}>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <button className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 flex-shrink-0"
                          onClick={() => toggleProject(project.id)}>
                          {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                        </button>
                        <span className="font-medium text-gray-900 dark:text-gray-100 truncate flex-1">
                          {project.projectName}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 flex-shrink-0">
                          {weight}%
                        </span>
                      </div>
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        {/* 達成切り替えボタン */}
                        {canEdit && (
                          <button
                            onClick={(e) => handleToggleAchieved(project, e)}
                            disabled={togglingProjectId === project.id}
                            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                              project.isAchieved
                                ? 'bg-green-500 text-white hover:bg-green-600'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-700 dark:hover:text-green-400'
                            }`}
                            title={project.isAchieved ? '達成済み（クリックで取り消し）' : '達成としてマーク'}>
                            {project.isAchieved ? (
                              <><CheckCircle2 className="h-3.5 w-3.5" />達成</>
                            ) : (
                              <><Circle className="h-3.5 w-3.5" />未達成</>
                            )}
                          </button>
                        )}
                        {canEdit && (
                          <button onClick={(e) => handleEditProject(project, e)}
                            className="p-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                            title="編集">
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div className={`h-full transition-all duration-300 ${project.isAchieved ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: project.isAchieved ? '100%' : '0%' }} />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="bg-gray-50 dark:bg-gray-800/50 px-4 pb-4">
                      <div className="flex justify-between items-center mb-3 mt-2">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">タスク</h4>
                        {canEdit && (
                          <Button size="sm" variant="outline"
                            onClick={(e) => { e.stopPropagation(); handleCreateTask(project.id); }}>
                            <Plus className="h-3 w-3 mr-1" />追加
                          </Button>
                        )}
                      </div>

                      {projectTasks.length === 0 ? (
                        <div className="text-center py-3 text-sm text-gray-500 dark:text-gray-400">タスクがありません</div>
                      ) : (
                        <div className="space-y-2">
                          {projectTasks.map((task) => (
                            <div key={task.id}
                              className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                              onClick={() => handleEditTask(task)}>
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">{task.title}</span>
                                {canEdit && (
                                  <div className="flex items-center gap-1">
                                    <button onClick={(e) => { e.stopPropagation(); handleEditTask(task); }}
                                      className="p-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400">
                                      <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id, project.id); }}
                                      className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400">
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                              {task.description && (
                                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">{task.description}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {isNewTaskModalOpen && (
        <TaskModal
          missionId={missionId}
          projectId={selectedProjectId || undefined}
          task={selectedTask}
          suspendOutsidePointerClose={isProjectModalOpen}
          onCreateProjectRequest={() => {
            setSelectedProject(null);
            setIsProjectModalOpen(true);
          }}
          onClose={() => {
            setIsNewTaskModalOpen(false);
            setSelectedTask(null);
            setSelectedProjectId(null);
          }}
          onSaved={handleTaskSaved}
          readOnly={viewMode === 'view'}
        />
      )}

      {isProjectModalOpen && (
        <ProjectModal
          project={selectedProject}
          defaultMissionId={selectedProject ? undefined : missionId}
          onClose={() => {
            setIsProjectModalOpen(false);
            setSelectedProject(null);
          }}
          onSaved={handleProjectSaved}
          readOnly={false}
        />
      )}
    </>
  );
};
