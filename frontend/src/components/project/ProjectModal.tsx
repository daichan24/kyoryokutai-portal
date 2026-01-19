import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, CheckCircle2, Circle, PlayCircle } from 'lucide-react';
import { api } from '../../utils/api';
import { formatDate } from '../../utils/date';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { ProjectTaskModal } from './ProjectTaskModal';
import { Task } from '../../types';
import { useAuthStore } from '../../stores/authStore';

interface Project {
  id: string;
  projectName: string;
  description?: string;
  phase: 'PREPARATION' | 'EXECUTION' | 'COMPLETED' | 'REVIEW';
  startDate?: string;
  endDate?: string;
  missionId?: string;
  tags: string[];
  projectTasks?: Task[];
}

interface Mission {
  id: string;
  missionName: string;
}

interface ProjectModalProps {
  project?: Project | null;
  onClose: () => void;
  onSaved: () => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  project,
  onClose,
  onSaved,
}) => {
  const { user } = useAuthStore();
  const [projectName, setProjectName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [phase, setPhase] = useState<'PREPARATION' | 'EXECUTION' | 'COMPLETED' | 'REVIEW'>('PREPARATION');
  const [missionId, setMissionId] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isSubGoalModalOpen, setIsSubGoalModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    fetchMissions();

    if (project) {
      setProjectName(project.projectName);
      setDescription(project.description || '');
      setStartDate(project.startDate ? formatDate(new Date(project.startDate)) : '');
      setEndDate(project.endDate ? formatDate(new Date(project.endDate)) : '');
      setPhase(project.phase);
      setMissionId(project.missionId || '');
      setTags(project.tags || []);
      setTasks(project.projectTasks || []);
    } else {
      setTasks([]);
    }
  }, [project]);

  useEffect(() => {
    if (project?.id) {
      fetchTasks();
    }
  }, [project?.id]);

  const fetchMissions = async () => {
    try {
      const response = await api.get<Mission[]>('/api/missions');
      setMissions(response.data || []);
    } catch (error) {
      console.error('Failed to fetch missions:', error);
      setMissions([]);
    }
  };

  const fetchTasks = async () => {
    if (!project?.id) return;
    try {
      const response = await api.get<Task[]>(`/api/projects/${project.id}/tasks`);
      setTasks(response.data || []);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      setTasks([]);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        projectName,
        description: description || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        phase,
        missionId: missionId || undefined,
        tags,
      };

      if (project) {
        await api.put(`/api/projects/${project.id}`, data);
      } else {
        await api.post('/api/projects', data);
      }

      onSaved();
    } catch (error) {
      console.error('Failed to save project:', error);
      alert('保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!project || !confirm('このプロジェクトを削除しますか？')) return;

    try {
      await api.delete(`/api/projects/${project.id}`);
      onSaved();
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert('削除に失敗しました');
    }
  };

  // タスク関連のハンドラー（旧：サブ目標）
  const handleAddTask = () => {
    setSelectedTask(null);
    setIsSubGoalModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setIsSubGoalModalOpen(true);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!project?.id || !confirm('このタスクを削除しますか？')) return;

    try {
      await api.delete(`/api/projects/${project.id}/tasks/${taskId}`);
      await fetchTasks();
    } catch (error) {
      console.error('Failed to delete task:', error);
      alert('削除に失敗しました');
    }
  };

  const handleTaskSaved = async () => {
    if (!project?.id) return;

    try {
      await fetchTasks();
      setIsSubGoalModalOpen(false);
      setSelectedTask(null);
    } catch (error) {
      console.error('Failed to refresh tasks:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'IN_PROGRESS':
        return <PlayCircle className="h-4 w-4 text-blue-600" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      NOT_STARTED: '未着手',
      IN_PROGRESS: '進行中',
      COMPLETED: '完了',
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      NOT_STARTED: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200',
      IN_PROGRESS: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
      COMPLETED: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 dark:bg-gray-700';
  };

  // 権限チェック: MEMBERは自分のプロジェクトのみ編集可、GOVERNMENTは閲覧のみ
  const canEditTasks = project && (
    user?.role === 'MASTER' ||
    user?.role === 'SUPPORT' ||
    (user?.role === 'MEMBER' && (project as any).userId === user.id)
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700 flex-shrink-0">
          <h2 className="text-2xl font-bold dark:text-gray-100">
            {project ? 'プロジェクト編集' : 'プロジェクト作成'}
          </h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto">
          <Input
            label="プロジェクト名"
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            required
            placeholder="プロジェクト名を入力"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              説明
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="プロジェクトの説明を入力"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="開始日"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="終了日"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              フェーズ
            </label>
            <select
              value={phase}
              onChange={(e) => setPhase(e.target.value as typeof phase)}
              className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="PREPARATION">準備</option>
              <option value="EXECUTION">実施</option>
              <option value="COMPLETED">完了</option>
              <option value="REVIEW">振り返り</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              関連ミッション（任意）
            </label>
            <select
              value={missionId}
              onChange={(e) => setMissionId(e.target.value)}
              className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="">選択しない</option>
              {missions.map((mission) => (
                <option key={mission.id} value={mission.id}>
                  {mission.missionName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              タグ
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="タグを入力してEnter"
                className="flex-1 px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              <Button type="button" variant="outline" onClick={handleAddTag}>
                追加
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* タスクセクション（旧：サブ目標） */}
          {project && (
            <div className="pt-6 border-t dark:border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">タスク（小目標）</h3>
                {canEditTasks && (
                  <Button type="button" variant="outline" size="sm" onClick={handleAddTask}>
                    <Plus className="h-4 w-4 mr-1" />
                    追加
                  </Button>
                )}
              </div>

              {tasks.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                  タスクがありません
                </p>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <div className="mt-0.5">{getStatusIcon(task.status)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">{task.title}</h4>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(task.status)}`}>
                            {getStatusLabel(task.status)}
                          </span>
                        </div>
                        {task.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400">{task.description}</p>
                        )}
                      </div>
                      {canEditTasks && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditTask(task)}
                            className="p-1 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                            title="編集"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => task.id && handleDeleteTask(task.id)}
                            className="p-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                            title="削除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </form>

        <div className="flex justify-between p-6 border-t dark:border-gray-700 flex-shrink-0">
          <div>
            {project && (
              <Button type="button" variant="danger" onClick={handleDelete}>
                削除
              </Button>
            )}
          </div>
          <div className="flex space-x-3">
            <Button type="button" variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={loading}>
              {loading ? '保存中...' : '保存'}
            </Button>
          </div>
        </div>
      </div>

      {/* タスクモーダル（旧：サブ目標モーダル） */}
      {isSubGoalModalOpen && project && (
        <ProjectTaskModal
          projectId={project.id}
          task={selectedTask}
          onClose={() => {
            setIsSubGoalModalOpen(false);
            setSelectedTask(null);
          }}
          onSaved={handleTaskSaved}
        />
      )}
    </div>
  );
};

