import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle2, PlayCircle, Circle, Copy } from 'lucide-react';
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
  onDuplicate?: (task: Task) => void;
  readOnly?: boolean; // 閲覧専用モード
  /** 上位で別モーダル（例: プロジェクト作成）が開いている間は外側クリックで閉じない */
  suspendOutsidePointerClose?: boolean;
  /** ミッション内から新規プロジェクト作成を開く */
  onCreateProjectRequest?: () => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  missionId,
  projectId: initialProjectId,
  task,
  onClose,
  onSaved,
  onDuplicate,
  readOnly = false,
  suspendOutsidePointerClose = false,
  onCreateProjectRequest,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'>('NOT_STARTED');
  const [projectId, setProjectId] = useState<string | null>(initialProjectId || null);
  const [attachMode, setAttachMode] = useState<'PROJECT' | 'UNSET' | 'KYORYOKUTAI' | 'TRIAGE'>('PROJECT');
  const [dueDate, setDueDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('17:00');
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const hasChanges = () => {
    if (readOnly) return false;
    if (!task) {
      return !!(title || description || projectId || dueDate || attachMode !== 'PROJECT');
    }
    const originalDueDate = task.dueDate ? task.dueDate.split('T')[0] : '';
    const origAttach: 'PROJECT' | 'UNSET' | 'KYORYOKUTAI' | 'TRIAGE' = task.projectId
      ? 'PROJECT'
      : task.linkKind === 'KYORYOKUTAI_WORK'
        ? 'KYORYOKUTAI'
        : task.linkKind === 'TRIAGE_PENDING'
          ? 'TRIAGE'
          : 'UNSET';
    return (
      title !== task.title ||
      description !== (task.description || '') ||
      status !== task.status ||
      projectId !== (task.projectId || null) ||
      dueDate !== originalDueDate ||
      attachMode !== origAttach
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
    if (readOnly || suspendOutsidePointerClose) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        handleCloseClick();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [title, description, status, projectId, dueDate, readOnly, attachMode, suspendOutsidePointerClose]);

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
      if (task.projectId) {
        setAttachMode('PROJECT');
      } else if (task.linkKind === 'KYORYOKUTAI_WORK') {
        setAttachMode('KYORYOKUTAI');
      } else if (task.linkKind === 'TRIAGE_PENDING') {
        setAttachMode('TRIAGE');
      } else {
        setAttachMode('UNSET');
      }
      setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
      setEndDate((task as any).endDate ? (task as any).endDate.split('T')[0] : (task.dueDate ? task.dueDate.split('T')[0] : ''));
      setStartTime((task as any).startTime || '09:00');
      setEndTime((task as any).endTime || '17:00');
    } else {
      setTitle('');
      setDescription('');
      setStatus('NOT_STARTED');
      setProjectId(initialProjectId || null);
      setAttachMode(initialProjectId ? 'PROJECT' : 'UNSET');
      setDueDate('');
      setEndDate('');
      setStartTime('09:00');
      setEndTime('17:00');
    }
  }, [task, initialProjectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('タイトルを入力してください');
      return;
    }

    if (attachMode === 'PROJECT' && !projectId) {
      alert('プロジェクトを選ぶか、下のいずれかの紐づけ方を選んでください');
      return;
    }

    setLoading(true);
    try {
      const effectiveProjectId = attachMode === 'PROJECT' ? projectId || null : null;
      const linkKind =
        attachMode === 'PROJECT'
          ? 'PROJECT'
          : attachMode === 'KYORYOKUTAI'
            ? 'KYORYOKUTAI_WORK'
            : attachMode === 'TRIAGE'
              ? 'TRIAGE_PENDING'
              : 'UNSET';

      const data = {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        projectId: effectiveProjectId,
        linkKind,
        dueDate: dueDate && dueDate.trim() ? dueDate.trim() : null,
        endDate: endDate && endDate.trim() ? endDate.trim() : (dueDate && dueDate.trim() ? dueDate.trim() : null),
        startTime,
        endTime,
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80]" onClick={readOnly ? onClose : handleCloseClick}>
      <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full m-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold dark:text-gray-100">
            {task ? 'タスク編集' : 'タスク追加'}
          </h2>
          <div className="flex items-center gap-2">
            {task && !readOnly && onDuplicate && (
              <button
                type="button"
                onClick={() => onDuplicate(task)}
                className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="このタスクを複製"
              >
                <Copy className="h-4 w-4" />
                複製
              </button>
            )}
            <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="タイトル"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="タスクのタイトルを入力"
            disabled={readOnly}
            readOnly={readOnly}
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
              プロジェクトとの紐づけ
            </label>
            <select
              value={attachMode}
              onChange={(e) => {
                const v = e.target.value as 'PROJECT' | 'UNSET' | 'KYORYOKUTAI' | 'TRIAGE';
                setAttachMode(v);
                if (v !== 'PROJECT') setProjectId(null);
              }}
              className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed mb-2"
              disabled={readOnly}
            >
              <option value="PROJECT">プロジェクトに紐づける</option>
              <option value="UNSET">未設定（プロジェクトに紐づけない）</option>
              <option value="KYORYOKUTAI">協力隊業務（プロジェクトに紐づけない）</option>
              <option value="TRIAGE">あとで振り分け（当日メモ・保留）</option>
            </select>
            {attachMode === 'PROJECT' && (
              <>
                <select
                  value={projectId || ''}
                  onChange={(e) => setProjectId(e.target.value || null)}
                  className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={readOnly}
                >
                  <option value="">プロジェクトを選択</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.projectName}
                    </option>
                  ))}
                </select>
                {!readOnly && missionId && onCreateProjectRequest && (
                  <button
                    type="button"
                    className="mt-2 text-sm text-primary hover:underline"
                    onClick={() => onCreateProjectRequest()}
                  >
                    ＋ 新規プロジェクトを作成
                  </button>
                )}
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              期日（任意・スケジュール自動生成用）
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">開始日</label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value);
                    if (!endDate || endDate < e.target.value) setEndDate(e.target.value);
                  }}
                  placeholder="開始日を選択"
                  disabled={readOnly}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">終了日</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={dueDate}
                  placeholder="終了日を選択"
                  disabled={readOnly}
                />
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">開始時刻</label>
                <select
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
                  disabled={readOnly}
                >
                  {Array.from({ length: 24 * 4 }, (_, i) => {
                    const h = Math.floor(i / 4);
                    const m = (i % 4) * 15;
                    const v = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                    return <option key={v} value={v}>{`${h}:${String(m).padStart(2, '0')}`}</option>;
                  })}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">終了時刻</label>
                <select
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
                  disabled={readOnly}
                >
                  {Array.from({ length: 24 * 4 }, (_, i) => {
                    const h = Math.floor(i / 4);
                    const m = (i % 4) * 15;
                    const v = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                    return <option key={v} value={v}>{`${h}:${String(m).padStart(2, '0')}`}</option>;
                  })}
                </select>
              </div>
            </div>
            {dueDate && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                期日と時刻を設定すると、その日にスケジュールが自動で作成されます
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
