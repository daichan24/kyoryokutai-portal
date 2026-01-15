import React, { useState, useEffect } from 'react';
import { X, Plus, Edit2, Trash2, CheckCircle2, Circle, PlayCircle } from 'lucide-react';
import { api } from '../../utils/api';
import { formatDate } from '../../utils/date';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { ProjectSubGoalModal, ProjectSubGoal } from './ProjectSubGoalModal';
import { useAuthStore } from '../../stores/authStore';

interface Project {
  id: string;
  projectName: string;
  description?: string;
  phase: 'PREPARATION' | 'EXECUTION' | 'COMPLETED' | 'REVIEW';
  startDate?: string;
  endDate?: string;
  goalId?: string;
  tags: string[];
}

interface Goal {
  id: string;
  goalName: string;
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
  const [goalId, setGoalId] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);
  const [subGoals, setSubGoals] = useState<ProjectSubGoal[]>([]);
  const [isSubGoalModalOpen, setIsSubGoalModalOpen] = useState(false);
  const [selectedSubGoal, setSelectedSubGoal] = useState<ProjectSubGoal | null>(null);

  useEffect(() => {
    fetchGoals();

    if (project) {
      setProjectName(project.projectName);
      setDescription(project.description || '');
      setStartDate(project.startDate ? formatDate(new Date(project.startDate)) : '');
      setEndDate(project.endDate ? formatDate(new Date(project.endDate)) : '');
      setPhase(project.phase);
      setGoalId(project.goalId || '');
      setTags(project.tags || []);
      setSubGoals(project.subGoals || []);
    } else {
      setSubGoals([]);
    }
  }, [project]);

  useEffect(() => {
    if (project?.id) {
      fetchSubGoals();
    }
  }, [project?.id]);

  const fetchGoals = async () => {
    try {
      const response = await api.get<Goal[]>('/api/goals');
      setGoals(response.data || []);
    } catch (error) {
      console.error('Failed to fetch goals:', error);
      setGoals([]);
    }
  };

  const fetchSubGoals = async () => {
    if (!project?.id) return;
    try {
      const response = await api.get<ProjectSubGoal[]>(`/api/projects/${project.id}/sub-goals`);
      setSubGoals(response.data || []);
    } catch (error) {
      console.error('Failed to fetch sub-goals:', error);
      setSubGoals([]);
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
        goalId: goalId || undefined,
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

  // サブ目標関連のハンドラー
  const handleAddSubGoal = () => {
    setSelectedSubGoal(null);
    setIsSubGoalModalOpen(true);
  };

  const handleEditSubGoal = (subGoal: ProjectSubGoal) => {
    setSelectedSubGoal(subGoal);
    setIsSubGoalModalOpen(true);
  };

  const handleDeleteSubGoal = async (subGoalId: string) => {
    if (!project?.id || !confirm('このサブ目標を削除しますか？')) return;

    try {
      await api.delete(`/api/projects/${project.id}/sub-goals/${subGoalId}`);
      await fetchSubGoals();
    } catch (error) {
      console.error('Failed to delete sub-goal:', error);
      alert('削除に失敗しました');
    }
  };

  const handleSubGoalSaved = async (subGoalData: ProjectSubGoal) => {
    if (!project?.id) return;

    try {
      if (subGoalData.id) {
        // 更新
        await api.put(`/api/projects/${project.id}/sub-goals/${subGoalData.id}`, subGoalData);
      } else {
        // 作成
        await api.post(`/api/projects/${project.id}/sub-goals`, subGoalData);
      }
      await fetchSubGoals();
      setIsSubGoalModalOpen(false);
      setSelectedSubGoal(null);
    } catch (error) {
      console.error('Failed to save sub-goal:', error);
      alert('保存に失敗しました');
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
      NOT_STARTED: 'bg-gray-100 text-gray-800',
      IN_PROGRESS: 'bg-blue-100 text-blue-800',
      COMPLETED: 'bg-green-100 text-green-800',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100';
  };

  // 権限チェック: MEMBERは自分のプロジェクトのみ編集可、GOVERNMENTは閲覧のみ
  const canEditSubGoals = project && (
    user?.role === 'MASTER' ||
    user?.role === 'SUPPORT' ||
    (user?.role === 'MEMBER' && (project as any).userId === user.id)
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold">
            {project ? 'プロジェクト編集' : 'プロジェクト作成'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="プロジェクト名"
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            required
            placeholder="プロジェクト名を入力"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              説明
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-border rounded-md"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              フェーズ
            </label>
            <select
              value={phase}
              onChange={(e) => setPhase(e.target.value as typeof phase)}
              className="w-full px-3 py-2 border border-border rounded-md"
            >
              <option value="PREPARATION">準備</option>
              <option value="EXECUTION">実施</option>
              <option value="COMPLETED">完了</option>
              <option value="REVIEW">振り返り</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              関連目標（任意）
            </label>
            <select
              value={goalId}
              onChange={(e) => setGoalId(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md"
            >
              <option value="">選択しない</option>
              {goals.map((goal) => (
                <option key={goal.id} value={goal.id}>
                  {goal.goalName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
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
                className="flex-1 px-3 py-2 border border-border rounded-md"
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
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-blue-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* サブ目標セクション */}
          {project && (
            <div className="pt-6 border-t">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">サブ目標</h3>
                {canEditSubGoals && (
                  <Button type="button" variant="outline" size="sm" onClick={handleAddSubGoal}>
                    <Plus className="h-4 w-4 mr-1" />
                    追加
                  </Button>
                )}
              </div>

              {subGoals.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  サブ目標がありません
                </p>
              ) : (
                <div className="space-y-2">
                  {subGoals.map((subGoal) => (
                    <div
                      key={subGoal.id}
                      className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      <div className="mt-0.5">{getStatusIcon(subGoal.status)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900">{subGoal.title}</h4>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(subGoal.status)}`}>
                            {getStatusLabel(subGoal.status)}
                          </span>
                        </div>
                        {subGoal.description && (
                          <p className="text-sm text-gray-600">{subGoal.description}</p>
                        )}
                      </div>
                      {canEditSubGoals && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditSubGoal(subGoal)}
                            className="p-1 text-gray-500 hover:text-blue-600"
                            title="編集"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => subGoal.id && handleDeleteSubGoal(subGoal.id)}
                            className="p-1 text-gray-500 hover:text-red-600"
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

          <div className="flex justify-between pt-4">
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
              <Button type="submit" disabled={loading}>
                {loading ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>
        </form>
      </div>

      {/* サブ目標モーダル */}
      {isSubGoalModalOpen && (
        <ProjectSubGoalModal
          subGoal={selectedSubGoal}
          onClose={() => {
            setIsSubGoalModalOpen(false);
            setSelectedSubGoal(null);
          }}
          onSaved={handleSubGoalSaved}
        />
      )}
    </div>
  );
};

