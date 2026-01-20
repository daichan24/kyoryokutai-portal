import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle2, PlayCircle, Circle } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Task, Project } from '../../types';
import { api } from '../../utils/api';

interface TaskModalProps {
  missionId?: string;
  projectId?: string;
  task?: Task | null;
  onClose: () => void;
  onSaved: () => void;
  readOnly?: boolean; // 閲覧専用モード
}

export const TaskModal: React.FC<TaskModalProps> = ({
  missionId,
  projectId: initialProjectId,
  task,
  onClose,
  onSaved,
  readOnly = false,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'>('NOT_STARTED');
  const [projectId, setProjectId] = useState<string | null>(initialProjectId || null);
  const [dueDate, setDueDate] = useState<string>('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const hasChanges = () => {
    if (readOnly) return false;
    if (!task) {
      // 新規作成時は、何か入力されていれば変更あり
      return !!(title || description || projectId || dueDate);
    }
    // 編集時は、元の値と比較
    const originalDueDate = task.dueDate ? task.dueDate.split('T')[0] : '';
    return (
      title !== task.title ||
      description !== (task.description || '') ||
      status !== task.status ||
      projectId !== (task.projectId || null) ||
      dueDate !== originalDueDate
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
  }, [title, description, status, projectId, dueDate, readOnly]);

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
      setProjectId(task.projectId || initialProjectId || null);
      setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
    } else {
      setTitle('');
      setDescription('');
      setStatus('NOT_STARTED');
      setProjectId(initialProjectId || null);
      setDueDate('');
    }
  }, [task, initialProjectId]);

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
        dueDate: dueDate && dueDate.trim() ? dueDate.trim() : null,
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
    <>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={readOnly ? onClose : handleCloseClick}>
      <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full m-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold dark:text-gray-100">
            {task ? 'タスク編集' : 'タスク追加'}
          </h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              説明（任意）
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="タスクの説明を入力"
              disabled={readOnly}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              関連プロジェクト（任意）
            </label>
            <select
              value={projectId || ''}
              onChange={(e) => setProjectId(e.target.value || null)}
              className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={readOnly}
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              期日（任意・スケジュール自動生成用）
            </label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              placeholder="期日を選択"
              disabled={readOnly}
            />
            {dueDate && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                期日を設定すると、その日にスケジュールが自動で作成されます
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              ステータス
            </label>
            <div className="relative">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
                className="w-full px-3 py-2 pl-10 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={readOnly}
              >
                <option value="NOT_STARTED">未着手</option>
                <option value="IN_PROGRESS">進行中</option>
                <option value="COMPLETED">完了</option>
              </select>
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                {status === 'NOT_STARTED' && <Circle className="h-4 w-4 text-gray-400" />}
                {status === 'IN_PROGRESS' && <PlayCircle className="h-4 w-4 text-blue-500" />}
                {status === 'COMPLETED' && <CheckCircle2 className="h-4 w-4 text-green-500" />}
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              {readOnly ? '閉じる' : 'キャンセル'}
            </Button>
            {!readOnly && (
              <Button type="submit" disabled={loading}>
                {loading ? '保存中...' : '保存'}
              </Button>
            )}
          </div>
        </form>
      </div>
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
