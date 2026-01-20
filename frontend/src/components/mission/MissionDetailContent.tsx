import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { Button } from '../common/Button';
import { Plus, Edit2, Trash2, CheckCircle2, Circle, PlayCircle, ChevronDown, ChevronRight } from 'lucide-react';
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
}

export const MissionDetailContent: React.FC<MissionDetailContentProps> = ({ missionId, viewMode = 'view' }) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  // プロジェクト一覧を取得（このミッションに紐づくプロジェクトのみ）
  const { data: projects = [], isLoading: projectsLoading } = useQuery<ProjectWithTasks[]>({
    queryKey: ['projects', missionId],
    queryFn: async () => {
      // まずミッションの所有者を取得
      const missionResponse = await api.get(`/api/missions/${missionId}`);
      const mission = missionResponse.data;
      
      // このミッションに紐づくプロジェクトで、かつ所有者がこのミッションの所有者と同じもののみを取得
      // relatedTasksは既にAPIレスポンスに含まれている
      const response = await api.get(`/api/projects?missionId=${missionId}&userId=${mission.userId}`);
      return (response.data || []).map((project: any) => ({
        ...project,
        relatedTasks: project.relatedTasks || [],
      }));
    },
  });

  // プロジェクトなしのタスク一覧を取得
  const { data: tasksWithoutProject = [], isLoading: tasksWithoutProjectLoading } = useQuery<Task[]>({
    queryKey: ['tasks', missionId, 'without-project'],
    queryFn: async () => {
      const response = await api.get(`/api/missions/${missionId}/tasks`);
      // projectIdがnullまたはundefinedのタスクのみを返す
      return (response.data || []).filter((task: Task) => !task.projectId);
    },
  });

  const toggleProject = (projectId: string) => {
    const newSet = new Set(expandedProjects);
    if (newSet.has(projectId)) {
      newSet.delete(projectId);
    } else {
      newSet.add(projectId);
    }
    setExpandedProjects(newSet);
  };

  const handleCreateProject = () => {
    setSelectedProject(null);
    setIsProjectModalOpen(true);
  };

  const handleEditProject = (project: Project) => {
    // 閲覧モードの場合は編集できない
    if (viewMode === 'view') {
      return;
    }
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
    // 閲覧モードの場合は編集できない
    if (viewMode === 'view') {
      return;
    }
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
    } catch (error) {
      console.error('Failed to delete task:', error);
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

  // プロジェクトの重みを計算（ミッション内の全プロジェクト数で等分）
  const calculateProjectWeight = (projectIndex: number, totalProjects: number) => {
    if (totalProjects === 0) return 0;
    return Math.round(100 / totalProjects);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'IN_PROGRESS':
        return <PlayCircle className="h-5 w-5 text-blue-500" />;
      default:
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return '完了';
      case 'IN_PROGRESS':
        return '進行中';
      default:
        return '未着手';
    }
  };

  return (
    <>
      {/* プロジェクト一覧（タスクはプロジェクト配下に表示） */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">プロジェクト</h3>
          {(user?.role === 'MEMBER' || (user?.role !== 'MEMBER' && viewMode === 'create')) && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreateProject}
            >
              <Plus className="h-4 w-4 mr-1" />
              追加
            </Button>
          )}
        </div>

        {projectsLoading ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">読み込み中...</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-4 text-gray-500 dark:text-gray-400">プロジェクトがありません</div>
        ) : (
          <div className="space-y-3">
            {projects.map((project, index) => {
              const weight = calculateProjectWeight(index, projects.length);
              const isExpanded = expandedProjects.has(project.id);
              const projectTasks = project.relatedTasks || [];
              
              return (
                <div
                  key={project.id}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                >
                  {/* プロジェクトヘッダー */}
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3 flex-1">
                        <button 
                          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                          onClick={() => toggleProject(project.id)}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5" />
                          ) : (
                            <ChevronRight className="h-5 w-5" />
                          )}
                        </button>
                        <span 
                          className="font-medium text-gray-900 dark:text-gray-100 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 flex-1"
                          onClick={() => handleEditProject(project)}
                        >
                          {project.projectName}
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                          重み: {weight}%
                        </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {project.phase === 'PREPARATION' && '準備中'}
                          {project.phase === 'EXECUTION' && '実行中'}
                          {project.phase === 'COMPLETED' && '完了'}
                          {project.phase === 'REVIEW' && 'レビュー中'}
                        </span>
                      </div>
                      {((user?.role === 'MEMBER') || (viewMode === 'create' && project.userId === user?.id)) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditProject(project);
                          }}
                          className="p-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                          title="編集"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    
                    {/* 重みの視覚的表示 */}
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${weight}%` }}
                      />
                    </div>
                  </div>

                  {/* タスク一覧（プロジェクト配下） */}
                  {isExpanded && (
                    <div className="bg-gray-50 dark:bg-gray-800/50 px-4 pb-4">
                      <div className="flex justify-between items-center mb-3 mt-2">
                        <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">タスク</h4>
                        {(user?.role === 'MEMBER' || (user?.role !== 'MEMBER' && viewMode === 'create')) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCreateTask(project.id);
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            追加
                          </Button>
                        )}
                      </div>
                      
                      {projectTasks.length === 0 ? (
                        <div className="text-center py-3 text-sm text-gray-500 dark:text-gray-400">
                          タスクがありません
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {projectTasks.map((task) => (
                            <div
                              key={task.id}
                              className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                              onClick={() => handleEditTask(task)}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {getStatusIcon(task.status)}
                                  <span className="font-medium text-gray-900 dark:text-gray-100">{task.title}</span>
                                </div>
                                {((user?.role === 'MEMBER') || (viewMode === 'create' && task.userId === user?.id)) && (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditTask(task);
                                      }}
                                      className="p-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                                    >
                                      <Edit2 className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteTask(task.id, project.id);
                                      }}
                                      className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                              {task.description && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{task.description}</p>
                              )}
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500 dark:text-gray-400">{getStatusLabel(task.status)}</span>
                              </div>
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

      {/* プロジェクトモーダル */}
      {isProjectModalOpen && (
        <ProjectModal
          project={selectedProject}
          onClose={() => {
            setIsProjectModalOpen(false);
            setSelectedProject(null);
          }}
          onSaved={handleProjectSaved}
          readOnly={viewMode === 'view'}
        />
      )}

      {/* タスクモーダル */}
      {isNewTaskModalOpen && (
        <TaskModal
          missionId={missionId}
          projectId={selectedProjectId || undefined}
          task={selectedTask}
          onClose={() => {
            setIsNewTaskModalOpen(false);
            setSelectedTask(null);
            setSelectedProjectId(null);
          }}
          onSaved={handleTaskSaved}
          readOnly={viewMode === 'view'}
        />
      )}
    </>
  );
};

