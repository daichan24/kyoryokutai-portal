import React, { useState, useEffect, useRef } from 'react';
import { X, Plus, Edit2, Trash2, CheckCircle2, Circle, PlayCircle } from 'lucide-react';
import { api } from '../../utils/api';
import { formatDate } from '../../utils/date';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { TaskModal } from './TaskModal';
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
  themeColor?: string;
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
  readOnly?: boolean; // 閲覧専用モード
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
  const [themeColor, setThemeColor] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(false);
  const [colorConflictError, setColorConflictError] = useState<string | null>(null);
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
      setThemeColor(project.themeColor || '');
      setTags(project.tags || []);
      setTasks(project.projectTasks || []);
    } else {
      setTasks([]);
    }
  }, [project]);

  useEffect(() => {
    if (project?.id && missionId) {
      fetchTasks();
    } else if (!project && missionId) {
      // 新規作成時でmissionIdが設定されている場合、そのミッションのタスクを取得
      fetchTasksForMission();
    }
  }, [project?.id, missionId]);

  const fetchTasksForMission = async () => {
    if (!missionId) return;
    try {
      const response = await api.get<Task[]>(`/api/missions/${missionId}/tasks`);
      // このプロジェクトに紐づくタスクのみをフィルタ（projectIdがnullまたはこのプロジェクトのID）
      const projectTasks = response.data?.filter(task => 
        !task.projectId || (project && task.projectId === project.id)
      ) || [];
      setTasks(projectTasks);
    } catch (error) {
      console.error('Failed to fetch tasks for mission:', error);
      setTasks([]);
    }
  };

  const fetchMissions = async () => {
    try {
      // 自分のミッションのみを取得
      const response = await api.get<Mission[]>(`/api/missions?userId=${user?.id}`);
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
    setColorConflictError(null);

    try {
      const data = {
        projectName,
        description: description || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        phase,
        missionId: missionId || undefined,
        themeColor: themeColor || undefined,
        tags,
      };

      if (project) {
        await api.put(`/api/projects/${project.id}`, data);
      } else {
        await api.post('/api/projects', data);
      }

      onSaved();
    } catch (error: any) {
      console.error('Failed to save project:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.details || error.message || '保存に失敗しました';
      
      // 色の重複エラーの場合
      if (error.response?.data?.conflictingProject) {
        setColorConflictError(`この色は既に「${error.response.data.conflictingProject}」プロジェクトで使用されています。`);
      } else {
        alert(`保存に失敗しました: ${errorMessage}`);
      }
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
    if (!missionId) {
      alert('タスクを追加するには、まず関連ミッションを選択してください。');
      return;
    }
    setSelectedTask(null);
    setIsSubGoalModalOpen(true);
  };

  const handleEditTask = (task: Task) => {
    if (!missionId) {
      alert('タスクを編集するには、まず関連ミッションを選択してください。');
      return;
    }
    setSelectedTask(task);
    setIsSubGoalModalOpen(true);
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!missionId || !confirm('このタスクを削除しますか？')) return;

    try {
      await api.delete(`/api/missions/${missionId}/tasks/${taskId}`);
      if (project?.id && missionId) {
        await fetchTasks();
      } else if (!project && missionId) {
        await fetchTasksForMission();
      }
    } catch (error) {
      console.error('Failed to delete task:', error);
      alert('削除に失敗しました');
    }
  };

  const handleTaskSaved = async () => {
    try {
      if (project?.id && missionId) {
        await fetchTasks();
      } else if (!project && missionId) {
        await fetchTasksForMission();
      }
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
  const canEditTasks = !readOnly && project && (
    user?.role === 'MASTER' ||
    user?.role === 'SUPPORT' ||
    (user?.role === 'MEMBER' && (project as any).userId === user.id)
  );

  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const hasChanges = () => {
    if (readOnly) return false;
    if (!project) {
      // 新規作成時は、何か入力されていれば変更あり
      return !!(projectName || description || startDate || endDate || missionId || themeColor || tags.length > 0);
    }
    // 編集時は、元の値と比較
    const originalStartDate = project.startDate ? formatDate(new Date(project.startDate)) : '';
    const originalEndDate = project.endDate ? formatDate(new Date(project.endDate)) : '';
    return (
      projectName !== project.projectName ||
      description !== (project.description || '') ||
      startDate !== originalStartDate ||
      endDate !== originalEndDate ||
      phase !== project.phase ||
      missionId !== (project.missionId || '') ||
      themeColor !== (project.themeColor || '') ||
      JSON.stringify(tags) !== JSON.stringify(project.tags || [])
    );
  };

  const handleCloseClick = () => {
    if (hasChanges()) {
      setShowCloseConfirm(true);
    } else {
      onClose();
    }
  };

  useEffect(() => {
    if (readOnly) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        handleCloseClick();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [projectName, description, startDate, endDate, phase, missionId, themeColor, tags, readOnly]);

  return (
    <>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={readOnly ? onClose : handleCloseClick}>
      <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
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
              className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="プロジェクトの説明を入力"
              disabled={readOnly}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="開始日"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={readOnly}
            />
            <Input
              label="終了日"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={readOnly}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              フェーズ
            </label>
            <select
              value={phase}
              onChange={(e) => setPhase(e.target.value as typeof phase)}
              className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={readOnly}
            >
              <option value="PREPARATION">準備</option>
              <option value="EXECUTION">実施</option>
              <option value="COMPLETED">完了</option>
              <option value="REVIEW">振り返り</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              テーマカラー（任意）
            </label>
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={themeColor || '#6B7280'}
                onChange={(e) => setThemeColor(e.target.value)}
                className="h-10 w-20 border border-border dark:border-gray-600 rounded-md cursor-pointer"
              />
              <input
                type="text"
                value={themeColor}
                onChange={(e) => setThemeColor(e.target.value)}
                placeholder="#6B7280"
                className="flex-1 px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                pattern="^#[0-9A-Fa-f]{6}$"
              />
            </div>
            {colorConflictError && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{colorConflictError}</p>
            )}
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
          {missionId && (
            <div className="pt-6 border-t dark:border-gray-700">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">タスク（小目標）</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    プロジェクト作成時にまとめてタスクを設定できます。タスクカテゴリからもこのプロジェクトに紐づくタスクを設定できます。
                  </p>
                </div>
                {(canEditTasks || !project) && (
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
      {isSubGoalModalOpen && missionId && (
        <TaskModal
          missionId={missionId}
          projectId={project?.id}
          task={selectedTask}
          onClose={() => {
            setIsSubGoalModalOpen(false);
            setSelectedTask(null);
          }}
          onSaved={handleTaskSaved}
        />
      )}
    </div>

    {/* 閉じる確認ダイアログ */}
    {showCloseConfirm && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full m-4 p-6">
          <h3 className="text-xl font-bold dark:text-gray-100 mb-4">
            編集内容が保存されていません
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            編集内容は保存されませんが、よろしいですか？
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowCloseConfirm(false)}>
              編集に戻る
            </Button>
            <Button variant="danger" onClick={() => {
              setShowCloseConfirm(false);
              onClose();
            }}>
              OK
            </Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

