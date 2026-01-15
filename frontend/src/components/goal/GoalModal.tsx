import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../../utils/api';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

interface Goal {
  id: string;
  goalName?: string; // 後方互換性
  missionName?: string;
  goalType?: 'PRIMARY' | 'SUB'; // 後方互換性
  missionType?: 'PRIMARY' | 'SUB';
  targetPercentage: number;
}

interface GoalModalProps {
  goal?: Goal | null;
  onClose: () => void;
  onSaved: () => void;
}

export const GoalModal: React.FC<GoalModalProps> = ({
  goal,
  onClose,
  onSaved,
}) => {
  const [missionName, setMissionName] = useState('');
  const [missionType, setMissionType] = useState<'PRIMARY' | 'SUB'>('PRIMARY');
  const [targetPercentage, setTargetPercentage] = useState(100);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (goal) {
      setMissionName(goal.missionName || goal.goalName || '');
      setMissionType(goal.missionType || goal.goalType || 'PRIMARY');
      setTargetPercentage(goal.targetPercentage);
    }
  }, [goal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        missionName,
        missionType,
        targetPercentage,
      };

      if (goal) {
        await api.put(`/api/missions/${goal.id}`, data);
      } else {
        await api.post('/api/missions', data);
      }

      onSaved();
    } catch (error) {
      console.error('Failed to save goal:', error);
      alert('保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!goal || !confirm('このミッションを削除しますか？')) return;

    try {
      await api.delete(`/api/missions/${goal.id}`);
      onSaved();
    } catch (error) {
      console.error('Failed to delete goal:', error);
      alert('削除に失敗しました');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full m-4">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold">
            {goal ? 'ミッション編集' : 'ミッション作成'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="ミッション名"
            type="text"
            value={missionName}
            onChange={(e) => setMissionName(e.target.value)}
            required
            placeholder="ミッション名を入力"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ミッションタイプ
            </label>
            <select
              value={missionType}
              onChange={(e) => setMissionType(e.target.value as typeof missionType)}
              className="w-full px-3 py-2 border border-border rounded-md"
            >
              <option value="PRIMARY">メイン目標</option>
              <option value="SUB">サブ目標</option>
            </select>
          </div>

          <Input
            label="目標達成率（%）"
            type="number"
            min="0"
            max="100"
            value={targetPercentage.toString()}
            onChange={(e) => setTargetPercentage(Number(e.target.value))}
            required
          />

          <div className="flex justify-between pt-4">
            <div>
              {goal && (
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

