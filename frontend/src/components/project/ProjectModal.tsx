import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../../utils/api';
import { formatDate } from '../../utils/date';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

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
    }
  }, [project]);

  const fetchGoals = async () => {
    try {
      const response = await api.get<Goal[]>('/api/goals');
      setGoals(response.data || []);
    } catch (error) {
      console.error('Failed to fetch goals:', error);
      setGoals([]);
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
    </div>
  );
};

