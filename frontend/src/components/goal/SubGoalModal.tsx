import React, { useState } from 'react';
import { api } from '../../utils/api';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Modal } from '../common/Modal';

interface SubGoalModalProps {
  midGoalId: string;
  onClose: () => void;
  onSaved: () => void;
}

export const SubGoalModal: React.FC<SubGoalModalProps> = ({
  midGoalId,
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

      await api.post(`/api/missions/mid-goals/${midGoalId}/sub-goals`, data);
      onSaved();
    } catch (error) {
      console.error('Failed to save sub goal:', error);
      alert('保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="小目標作成" maxWidthClassName="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="小目標名"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="小目標名を入力"
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
    </Modal>
  );
};
