import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../../utils/api';
import { formatDate } from '../../utils/date';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useAuthStore } from '../../stores/authStore';

interface Project {
  id: string;
  projectName: string;
}

interface User {
  id: string;
  name: string;
}

interface TaskRequestModalProps {
  onClose: () => void;
  onSaved: () => void;
}

export const TaskRequestModal: React.FC<TaskRequestModalProps> = ({
  onClose,
  onSaved,
}) => {
  const { user } = useAuthStore();
  const [requestTitle, setRequestTitle] = useState('');
  const [requestDescription, setRequestDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [requesteeId, setRequesteeId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [members, setMembers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchMembers();
    fetchProjects();
  }, []);

  const fetchMembers = async () => {
    try {
      const response = await api.get<User[]>('/api/users?role=MEMBER');
      // サポート・行政・マスターユーザーの場合は「佐藤大地」を除外
      const filteredMembers = (response.data || []).filter(u => {
        if ((user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT' || user?.role === 'MASTER') && u.name === '佐藤大地') return false;
        return true;
      });
      setMembers(filteredMembers);
    } catch (error) {
      console.error('Failed to fetch members:', error);
      setMembers([]);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await api.get<Project[]>('/api/projects');
      setProjects(response.data || []);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setProjects([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        requestTitle,
        requestDescription,
        deadline: deadline || undefined,
        requesteeId,
        projectId: projectId || undefined,
      };

      await api.post('/api/requests', data);
      onSaved();
    } catch (error) {
      console.error('Failed to save task request:', error);
      alert('保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h2 className="text-2xl font-bold dark:text-gray-100">依頼作成</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="依頼タイトル"
            type="text"
            value={requestTitle}
            onChange={(e) => setRequestTitle(e.target.value)}
            required
            placeholder="依頼タイトルを入力"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              依頼内容 <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <textarea
              value={requestDescription}
              onChange={(e) => setRequestDescription(e.target.value)}
              required
              rows={6}
              className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="依頼内容を入力"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              依頼先 <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <select
              value={requesteeId}
              onChange={(e) => setRequesteeId(e.target.value)}
              className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              required
            >
              <option value="">選択してください</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <Input
            label="期限（任意）"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              関連プロジェクト（任意）
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="">選択しない</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.projectName}
                </option>
              ))}
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

