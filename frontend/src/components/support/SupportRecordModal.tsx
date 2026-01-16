import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../../utils/api';
import { formatDate } from '../../utils/date';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { SimpleRichTextEditor } from '../editor/SimpleRichTextEditor';
import { useQuery } from '@tanstack/react-query';

interface SupportRecord {
  id: string;
  supportDate: string;
  supportContent: string;
  supportBy: string;
  userId: string;
  monthlyReportId?: string;
}

interface SupportRecordModalProps {
  record?: SupportRecord | null;
  onClose: () => void;
  onSaved: () => void;
}

interface User {
  id: string;
  name: string;
}

export const SupportRecordModal: React.FC<SupportRecordModalProps> = ({
  record,
  onClose,
  onSaved,
}) => {
  const [supportDate, setSupportDate] = useState(formatDate(new Date()));
  const [userId, setUserId] = useState('');
  const [supportContent, setSupportContent] = useState('');
  const [monthlyReportId, setMonthlyReportId] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const response = await api.get('/api/users');
      return response.data;
    },
  });

  const { data: monthlyReports = [] } = useQuery<any[]>({
    queryKey: ['monthly-reports'],
    queryFn: async () => {
      try {
        const response = await api.get('/api/monthly-reports');
        return response.data || [];
      } catch {
        return [];
      }
    },
  });

  useEffect(() => {
    if (record) {
      setSupportDate(formatDate(new Date(record.supportDate)));
      setUserId(record.userId);
      setSupportContent(record.supportContent);
      setMonthlyReportId(record.monthlyReportId || '');
    }
  }, [record]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        userId,
        supportDate,
        supportContent,
        monthlyReportId, // 必須
      };

      if (record) {
        await api.put(`/api/support-records/${record.id}`, data);
      } else {
        await api.post('/api/support-records', data);
      }
      onSaved();
    } catch (error) {
      console.error('Failed to save support record:', error);
      alert('保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold">
            {record ? '支援記録編集' : '支援記録作成'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="支援日"
            type="date"
            value={supportDate}
            onChange={(e) => setSupportDate(e.target.value)}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              支援対象者 <span className="text-red-500">*</span>
            </label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            >
              <option value="">選択してください</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              支援内容 <span className="text-red-500">*</span>
            </label>
            <SimpleRichTextEditor
              value={supportContent}
              onChange={setSupportContent}
              placeholder="支援内容を入力..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              月次報告 <span className="text-red-500">*</span>
            </label>
            <select
              value={monthlyReportId}
              onChange={(e) => setMonthlyReportId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            >
              <option value="">選択してください</option>
              {monthlyReports.map((report) => (
                <option key={report.id} value={report.id}>
                  {report.month} 月次報告
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              支援者は自動的にあなたのアカウントに紐付けられます
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
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

