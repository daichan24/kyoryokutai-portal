import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { Plus, CheckCircle2, Circle, PlayCircle } from 'lucide-react';
import { Button } from '../common/Button';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Task, Project } from '../../types';

type DisplayMode = 'view-only' | 'view-with-add' | 'add-only';

interface TasksWidgetProps {
  displayMode?: DisplayMode;
  showAddButton?: boolean;
  onAddClick?: () => void;
}

export const TasksWidget: React.FC<TasksWidgetProps> = ({
  displayMode = 'view-with-add',
  showAddButton = false,
  onAddClick,
}) => {
  const { user } = useAuthStore();

  // プロジェクト一覧を取得（Taskの紐づき情報用）
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects-widget'],
    queryFn: async () => {
      const response = await api.get('/api/projects');
      return response.data || [];
    },
  });

  // タスク一覧を取得（各Projectから取得）
  const { data: allTasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ['tasks-widget'],
    queryFn: async () => {
      // 各ProjectからTaskを取得
      const tasks: Task[] = [];
      for (const project of projects) {
        try {
          if (project.relatedTasks) {
            tasks.push(...project.relatedTasks);
          }
        } catch (error) {
          console.error(`Failed to fetch tasks for project ${project.id}:`, error);
        }
      }
      return tasks.slice(0, 5); // 最新5件
    },
    enabled: projects.length > 0,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'IN_PROGRESS':
        return <PlayCircle className="h-4 w-4 text-blue-500" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
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

  // 追加ボタンのみモード
  if (displayMode === 'add-only') {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6 flex items-center justify-center min-h-[200px]">
        <Link to="/tasks">
          <Button className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            タスクを追加
          </Button>
        </Link>
      </div>
    );
  }

  // 表示のみ or 表示+追加ボタンモード
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">タスク</h3>
        {(displayMode === 'view-with-add' || showAddButton) && (user?.role === 'MEMBER' || user?.role === 'SUPPORT' || user?.role === 'MASTER') && (
          <Link to="/tasks">
            <Button size="sm" className="flex items-center gap-1">
              <Plus className="w-4 h-4" />
              追加
            </Button>
          </Link>
        )}
      </div>

      {displayMode === 'view-only' || displayMode === 'view-with-add' ? (
        <>
          {isLoading ? (
            <LoadingSpinner />
          ) : !allTasks || allTasks.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">タスクがありません</p>
          ) : (
            <div className="space-y-2">
              {allTasks.map((task) => (
                <Link
                  key={task.id}
                  to="/tasks"
                  className="block p-2 border-2 border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {getStatusIcon(task.status)}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                          {task.title}
                        </p>
                        {task.project && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {task.project.projectName}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 ml-2">
                      {getStatusLabel(task.status)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

