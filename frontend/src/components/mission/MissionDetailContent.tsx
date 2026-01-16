import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { Button } from '../common/Button';
import { Plus, Edit2, Trash2, CheckCircle2, Circle, PlayCircle } from 'lucide-react';
import { Task, Project } from '../../types';
import { TaskModal } from '../project/TaskModal';
import { useAuthStore } from '../../stores/authStore';

interface MissionDetailContentProps {
  missionId: string;
}

export const MissionDetailContent: React.FC<MissionDetailContentProps> = ({ missionId }) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // プロジェクト一覧を取得（このミッションに紐づくプロジェクトのみ）
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ['projects', missionId],
    queryFn: async () => {
      // まずミッションの所有者を取得
      const missionResponse = await api.get(`/api/missions/${missionId}`);
      const mission = missionResponse.data;
      
      // このミッションに紐づくプロジェクトで、かつ所有者がこのミッションの所有者と同じもののみを取得
      const response = await api.get(`/api/projects?missionId=${missionId}&userId=${mission.userId}`);
      return response.data || [];
    },
  });

  // タスク一覧を取得
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ['tasks', missionId],
    queryFn: async () => {
      const response = await api.get(`/api/missions/${missionId}/tasks`);
      return response.data || [];
    },
  });

  const handleCreateTask = () => {
    setSelectedTask(null);
    setIsNewTaskModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setIsNewTaskModalOpen(true);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('このタスクを削除しますか？')) return;
    try {
      await api.delete(`/api/missions/${missionId}/tasks/${taskId}`);
      queryClient.invalidateQueries({ queryKey: ['tasks', missionId] });
    } catch (error) {
      console.error('Failed to delete task:', error);
      alert('削除に失敗しました');
    }
  };

  const handleTaskSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks', missionId] });
    setIsNewTaskModalOpen(false);
    setSelectedTask(null);
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* プロジェクト（中目標）セクション */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">プロジェクト（中目標）</h3>
            {(user?.role === 'MASTER' || user?.role === 'SUPPORT' || user?.role === 'MEMBER') && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  // プロジェクト作成は別のページで行う
                  window.location.href = '/projects';
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                追加
              </Button>
            )}
          </div>
          {projectsLoading ? (
            <div className="text-center py-4 text-gray-500">読み込み中...</div>
          ) : projects.length === 0 ? (
            <div className="text-center py-4 text-gray-500">プロジェクトがありません</div>
          ) : (
            <div className="space-y-2">
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="p-3 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">{project.projectName}</span>
                    <span className="text-xs text-gray-500">
                      {project.phase === 'PREPARATION' && '準備中'}
                      {project.phase === 'EXECUTION' && '実行中'}
                      {project.phase === 'COMPLETED' && '完了'}
                      {project.phase === 'REVIEW' && 'レビュー中'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* タスク（小目標）セクション */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">タスク（小目標）</h3>
            {(user?.role === 'MASTER' || user?.role === 'SUPPORT' || user?.role === 'MEMBER') && (
              <Button size="sm" variant="outline" onClick={handleCreateTask}>
                <Plus className="h-4 w-4 mr-1" />
                追加
              </Button>
            )}
          </div>
          {tasksLoading ? (
            <div className="text-center py-4 text-gray-500">読み込み中...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-4 text-gray-500">タスクがありません</div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="p-3 bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(task.status)}
                      <span className="font-medium text-gray-900">{task.title}</span>
                    </div>
                    {(user?.role === 'MASTER' || user?.role === 'SUPPORT' || user?.role === 'MEMBER') && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleEditTask(task)}
                          className="p-1 text-gray-500 hover:text-blue-600"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTask(task.id)}
                          className="p-1 text-gray-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">{getStatusLabel(task.status)}</span>
                    {task.project && (
                      <span className="text-xs text-gray-500">
                        関連: {task.project.projectName}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* タスクモーダル */}
      {isNewTaskModalOpen && (
        <TaskModal
          missionId={missionId}
          task={selectedTask}
          onClose={() => {
            setIsNewTaskModalOpen(false);
            setSelectedTask(null);
          }}
          onSaved={handleTaskSaved}
        />
      )}
    </>
  );
};

