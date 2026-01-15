import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { TaskModal } from '../components/project/TaskModal';
import { Button } from '../components/common/Button';
import { Plus, Edit2, Trash2, CheckCircle2, Circle, PlayCircle, Calendar, Filter, ArrowUpDown, Check } from 'lucide-react';
import { Task, Project, Mission } from '../types';

export const Tasks: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  
  // フィルタ・ソート状態
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('deadline'); // deadline, status, project, created

  // プロジェクト一覧を取得（Taskの紐づき情報用）
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const response = await api.get('/api/projects');
      return response.data;
    },
  });

  // ミッション一覧を取得（breadcrumb用）
  const { data: missions = [] } = useQuery<Mission[]>({
    queryKey: ['missions'],
    queryFn: async () => {
      const url = user?.role === 'MEMBER' 
        ? `/api/missions?userId=${user.id}`
        : '/api/missions';
      const response = await api.get(url);
      return response.data;
    },
  });

  // タスク一覧を取得（各Projectから取得）
  const { data: allTasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks', 'all'],
    queryFn: async () => {
      // 各ProjectからTaskを取得
      const tasks: Task[] = [];
      for (const project of projects) {
        try {
          // 現在のAPI構造では、TaskはMission配下にあるため、Project経由で取得できない
          // 暫定的に、ProjectのrelatedTasksを使用
          if (project.relatedTasks) {
            tasks.push(...project.relatedTasks);
          }
        } catch (error) {
          console.error(`Failed to fetch tasks for project ${project.id}:`, error);
        }
      }
      return tasks;
    },
    enabled: projects.length > 0,
  });

  // フィルタリング・ソート
  const filteredAndSortedTasks = React.useMemo(() => {
    let filtered = allTasks.filter(task => {
      const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
      const matchesProject = filterProject === 'all' || task.projectId === filterProject;
      return matchesStatus && matchesProject;
    });

    // ソート
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'status':
          const statusOrder = { 'NOT_STARTED': 0, 'IN_PROGRESS': 1, 'COMPLETED': 2 };
          return (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
        case 'project':
          return (a.project?.projectName || '').localeCompare(b.project?.projectName || '');
        case 'created':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'deadline':
        default:
          // 期限がない場合は最後に
          if (!a.project?.endDate && !b.project?.endDate) return 0;
          if (!a.project?.endDate) return 1;
          if (!b.project?.endDate) return -1;
          return new Date(a.project.endDate).getTime() - new Date(b.project.endDate).getTime();
      }
    });

    return filtered;
  }, [allTasks, filterStatus, filterProject, sortBy]);

  const handleCreateTask = (projectId?: string) => {
    setSelectedTask(null);
    setSelectedProjectId(projectId || null);
    setIsModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setSelectedProjectId(task.projectId || null);
    setIsModalOpen(true);
  };

  const handleDeleteTask = async (task: Task) => {
    if (!confirm('このタスクを削除しますか？')) return;
    if (!task.projectId) {
      alert('プロジェクト情報が見つかりません');
      return;
    }
    try {
      // 現在のAPI構造では、TaskはMission配下にあるため、missionIdが必要
      // 暫定的に、Project経由で削除
      if (task.missionId) {
        await api.delete(`/api/missions/${task.missionId}/tasks/${task.id}`);
      } else {
        throw new Error('Mission ID not found');
      }
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (error) {
      console.error('Failed to delete task:', error);
      alert('削除に失敗しました');
    }
  };

  const handleCompleteTask = async (task: Task) => {
    try {
      if (!task.missionId) {
        throw new Error('Mission ID not found');
      }
      await api.put(`/api/missions/${task.missionId}/tasks/${task.id}`, {
        status: 'COMPLETED',
      });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    } catch (error) {
      console.error('Failed to complete task:', error);
      alert('完了処理に失敗しました');
    }
  };

  const handleTaskSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    setIsModalOpen(false);
    setSelectedTask(null);
    setSelectedProjectId(null);
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

  const getMissionName = (task: Task): string | null => {
    if (!task.projectId) return null;
    const project = projects.find(p => p.id === task.projectId);
    if (!project?.missionId) return null;
    const mission = missions.find(m => m.id === project.missionId);
    return mission?.missionName || null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  const canCreate = user?.role === 'MEMBER' || user?.role === 'SUPPORT' || user?.role === 'MASTER';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">
          タスク
          {user?.role === 'MEMBER' && <span className="text-lg font-normal text-gray-500 ml-2">（自分のタスク）</span>}
        </h1>
        {canCreate && (
          <Button onClick={() => handleCreateTask()}>
            <Plus className="h-4 w-4 mr-2" />
            新規タスク
          </Button>
        )}
      </div>

      {/* フィルタ・ソート */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">全ての状態</option>
            <option value="NOT_STARTED">未着手</option>
            <option value="IN_PROGRESS">進行中</option>
            <option value="COMPLETED">完了</option>
          </select>
        </div>

        <select
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">全てのプロジェクト</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.projectName}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-gray-500" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="deadline">期限順</option>
            <option value="status">状態順</option>
            <option value="project">プロジェクト順</option>
            <option value="created">作成日順</option>
          </select>
        </div>
      </div>

      {/* タスク一覧 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredAndSortedTasks.map((task) => {
          const missionName = getMissionName(task);
          return (
            <div
              key={task.id}
              className="bg-white border-2 border-gray-300 rounded-lg p-5 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2 flex-1">
                  {getStatusIcon(task.status)}
                  <h3 className="font-bold text-lg text-gray-900 flex-1">
                    {task.title}
                  </h3>
                </div>
                {canCreate && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleEditTask(task)}
                      className="p-1 text-gray-500 hover:text-blue-600"
                      title="編集"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTask(task)}
                      className="p-1 text-gray-500 hover:text-red-600"
                      title="削除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {task.description && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {task.description}
                </p>
              )}

              {/* プロジェクト情報（必須表示） */}
              {task.project && (
                <div className="mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    プロジェクト: 
                  </span>
                  <span className="text-sm text-gray-900 ml-1">
                    {task.project.projectName}
                  </span>
                </div>
              )}

              {/* 方向性（Mission、薄く表示） */}
              {missionName && (
                <div className="mb-3">
                  <span className="text-xs text-gray-400">
                    方向性: {missionName}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                  {getStatusLabel(task.status)}
                </span>
                <div className="flex items-center gap-2">
                  {task.status !== 'COMPLETED' && canCreate && (
                    <button
                      onClick={() => handleCompleteTask(task)}
                      className="text-xs text-green-600 hover:text-green-700 font-medium"
                    >
                      完了
                    </button>
                  )}
                  <button
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                    title="スケジュールに追加"
                  >
                    <Calendar className="h-3 w-3" />
                    スケジュール
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredAndSortedTasks.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          {filterStatus !== 'all' || filterProject !== 'all'
            ? '条件に一致するタスクがありません'
            : 'タスクがありません'}
        </div>
      )}

      {/* タスクモーダル */}
      {isModalOpen && selectedProjectId && (
        <TaskModal
          missionId={selectedProjectId} // 暫定的にprojectIdを使用
          task={selectedTask}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedTask(null);
            setSelectedProjectId(null);
          }}
          onSaved={handleTaskSaved}
        />
      )}
    </div>
  );
};

