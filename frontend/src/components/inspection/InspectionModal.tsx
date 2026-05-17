import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../../utils/api';
import { formatDate } from '../../utils/date';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

interface Project {
  id: string;
  projectName: string;
}

interface InspectionModalProps {
  initialData?: {
    date?: string;
    destination?: string;
    purpose?: string;
    inspectionPurpose?: string;
    inspectionContent?: string;
    projectId?: string;
    scheduleId?: string;
    userId?: string;
  };
  onClose: () => void;
  onSaved: () => void;
}

export const InspectionModal: React.FC<InspectionModalProps> = ({
  initialData,
  onClose,
  onSaved,
}) => {
  const [date, setDate] = useState(initialData?.date || formatDate(new Date()));
  const [destination, setDestination] = useState(initialData?.destination || '');
  const [purpose, setPurpose] = useState(initialData?.purpose || '');
  const [participants, setParticipants] = useState('');
  const [inspectionPurpose, setInspectionPurpose] = useState(initialData?.inspectionPurpose || '');
  const [inspectionContent, setInspectionContent] = useState(initialData?.inspectionContent || '');
  const [reflection, setReflection] = useState('');
  const [futureAction, setFutureAction] = useState('');
  const [projectId, setProjectId] = useState(initialData?.projectId || '');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await api.get<Project[]>('/api/projects', {
        params: initialData?.userId ? { userId: initialData.userId } : undefined,
      });
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
        date,
        destination,
        purpose,
        participants: participants.split(',').map(p => p.trim()).filter(p => p),
        inspectionPurpose,
        inspectionContent,
        reflection,
        futureAction,
        projectId: projectId || undefined,
        scheduleId: initialData?.scheduleId || undefined,
        userId: initialData?.userId || undefined,
      };

      await api.post('/api/inspections', data);
      onSaved();
    } catch (error) {
      console.error('Failed to save inspection:', error);
      alert('保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full m-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h2 className="text-2xl font-bold dark:text-gray-100">視察記録作成</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {initialData?.scheduleId && (
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3 text-sm text-blue-800 dark:text-blue-200">
              カレンダーの予定から作成中です。日付・視察先・目的・プロジェクトを引き継いでいます。
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="視察日"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <Input
              label="視察先"
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              required
              placeholder="視察先を入力"
            />
          </div>

          <Input
            label="目的"
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            required
            placeholder="視察の目的を入力"
          />

          <Input
            label="参加者（カンマ区切り）"
            type="text"
            value={participants}
            onChange={(e) => setParticipants(e.target.value)}
            placeholder="参加者1, 参加者2, ..."
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              視察目的 <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <textarea
              value={inspectionPurpose}
              onChange={(e) => setInspectionPurpose(e.target.value)}
              required
              rows={3}
              className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="視察目的を入力"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              視察内容 <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <textarea
              value={inspectionContent}
              onChange={(e) => setInspectionContent(e.target.value)}
              required
              rows={5}
              className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="視察内容を入力"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              振り返り <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <textarea
              value={reflection}
              onChange={(e) => setReflection(e.target.value)}
              required
              rows={4}
              className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="振り返りを入力"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              今後のアクション <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <textarea
              value={futureAction}
              onChange={(e) => setFutureAction(e.target.value)}
              required
              rows={4}
              className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="今後のアクションを入力"
            />
          </div>

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
