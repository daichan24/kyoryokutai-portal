import React, { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../utils/api';
import { formatDate } from '../../utils/date';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

interface MidGoalModalProps {
  goalId: string;
  onClose: () => void;
  onSaved: () => void;
}

export const MidGoalModal: React.FC<MidGoalModalProps> = ({
  goalId,
  onClose,
  onSaved,
}) => {
  const [name, setName] = useState('');
  const [weight, setWeight] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        name,
        weight,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      };

      await api.post(`/api/goals/${goalId}/mid-goals`, data);
      onSaved();
    } catch (error) {
      console.error('Failed to save mid goal:', error);
      alert('保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full m-4">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold">中目標作成</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="中目標名"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="中目標名を入力"
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

