import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Task, Project } from '../../types';
import { api } from '../../utils/api';

interface TaskModalProps {
  missionId: string;
  task?: Task | null;
  onClose: () => void;
  onSaved: () => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  missionId,
  task,
  onClose,
  onSaved,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'>('NOT_STARTED');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // プロジェクトを取得（missionIdが空の場合は全プロジェクトを取得）
    const fetchProjects = async () => {
      try {
        if (missionId) {
          const response = await api.get(`/api/projects?missionId=${missionId}`);
          setProjects(response.data || []);
        } else {
          // missionIdが空の場合は全プロジェクトを取得
          const response = await api.get('/api/projects');
          setProjects(response.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch projects:', error);
      }
    };
    fetchProjects();
  }, [missionId]);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setStatus(task.status);
      setProjectId(task.projectId || null);
    } else {
      setTitle('');
      setDescription('');
      setStatus('NOT_STARTED');
      setProjectId(null);
    }
  }, [task]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('タイトルを入力してください');
      return;
    }

    setLoading(true);
    try {
      const data = {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        projectId: projectId || null,
      };

      if (task) {
        // 更新
        await api.put(`/api/missions/${missionId}/tasks/${task.id}`, data);
      } else {
        // 作成
        await api.post(`/api/missions/${missionId}/tasks`, data);
      }
      onSaved();
    } catch (error) {
      console.error('Failed to save task:', error);
      alert('保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full m-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold">
            {task ? 'タスク編集' : 'タスク追加'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="タイトル"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="タスクのタイトルを入力"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              説明（任意）
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-md"
              placeholder="タスクの説明を入力"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              関連プロジェクト（任意）
            </label>
            <select
              value={projectId || ''}
              onChange={(e) => setProjectId(e.target.value || null)}
              className="w-full px-3 py-2 border border-border rounded-md"
            >
              <option value="">プロジェクトを選択しない</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.projectName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ステータス
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
              className="w-full px-3 py-2 border border-border rounded-md"
            >
              <option value="NOT_STARTED">未着手</option>
              <option value="IN_PROGRESS">進行中</option>
              <option value="COMPLETED">完了</option>
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '保存中...' : '保存'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
