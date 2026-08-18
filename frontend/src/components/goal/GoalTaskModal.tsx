import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { formatDate } from '../../utils/date';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';

interface GoalTask {
  id: string;
  name: string;
  weight: number;
  progress: number;
  phase: 'PREPARATION' | 'EXECUTION' | 'COMPLETED' | 'REVIEW';
  startDate?: string;
  endDate?: string;
}

interface GoalTaskModalProps {
  subGoalId: string;
  task?: GoalTask | null;
  onClose: () => void;
  onSaved: () => void;
}

export const GoalTaskModal: React.FC<GoalTaskModalProps> = ({
  subGoalId,
  task,
  onClose,
  onSaved,
}) => {
  const [name, setName] = useState('');
  const [weight, setWeight] = useState(0);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<'PREPARATION' | 'EXECUTION' | 'COMPLETED' | 'REVIEW'>('PREPARATION');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (task) {
      setName(task.name);
      setWeight(task.weight);
      setProgress(task.progress);
      setPhase(task.phase);
      setStartDate(task.startDate ? formatDate(new Date(task.startDate)) : '');
      setEndDate(task.endDate ? formatDate(new Date(task.endDate)) : '');
    }
  }, [task]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (task) {
        // 進捗更新のみ
        await api.put(`/api/missions/tasks/${task.id}/progress`, { progress });
      } else {
        // 新規作成
        const data = {
          name,
          weight,
          progress: progress || 0,
          phase,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        };
        await api.post(`/api/missions/sub-goals/${subGoalId}/tasks`, data);
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
    <Modal isOpen onClose={onClose} title={task ? 'タスク進捗更新' : 'タスク作成'} maxWidthClassName="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {task ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                タスク名
              </label>
              <p className="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md dark:text-gray-100">
                {task.name}
              </p>
            </div>
            <Input
              label="進捗率（%）"
              type="number"
              min="0"
              max="100"
              value={progress.toString()}
              onChange={(e) => setProgress(Number(e.target.value))}
              required
            />
          </>
        ) : (
          <>
            <Input
              label="タスク名"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="タスク名を入力"
            />

            <Input
              label="重み（%）"
              type="number"
              min="0"
              max="100"
              value={weight.toString()}
              onChange={(e) => setWeight(Number(e.target.value))}
              required
            />

            <Input
              label="進捗率（%）"
              type="number"
              min="0"
              max="100"
              value={progress.toString()}
              onChange={(e) => setProgress(Number(e.target.value))}
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                フェーズ
              </label>
              <select
                value={phase}
                onChange={(e) => setPhase(e.target.value as typeof phase)}
                className="w-full px-3 py-2 border border-border rounded-md dark:bg-gray-700 dark:text-gray-100"
              >
                <option value="PREPARATION">準備</option>
                <option value="EXECUTION">実施</option>
                <option value="COMPLETED">完了</option>
                <option value="REVIEW">振り返り</option>
              </select>
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
          </>
        )}

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            キャンセル
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? '保存中...' : '保存'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

