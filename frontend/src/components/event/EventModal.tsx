import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../../utils/api';
import { formatDate } from '../../utils/date';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useAuthStore } from '../../stores/authStore';

interface Event {
  id: string;
  eventName: string;
  eventType: 'TOWN_OFFICIAL' | 'TEAM' | 'OTHER';
  date: string;
  startTime?: string;
  endTime?: string;
  locationText?: string;
  description?: string;
  maxParticipants?: number;
  projectId?: string;
  participations?: Array<{
    id: string;
    userId: string;
    participationType: 'PARTICIPATION' | 'PREPARATION';
    user: {
      id: string;
      name: string;
    };
  }>;
}

interface Project {
  id: string;
  projectName: string;
}

interface User {
  id: string;
  name: string;
  avatarColor?: string;
}

interface EventModalProps {
  event?: Event | null;
  onClose: () => void;
  onSaved: () => void;
}

export const EventModal: React.FC<EventModalProps> = ({
  event,
  onClose,
  onSaved,
}) => {
  const [eventName, setEventName] = useState('');
  const [eventType, setEventType] = useState<'TOWN_OFFICIAL' | 'TEAM' | 'OTHER'>('TEAM');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [locationText, setLocationText] = useState('');
  const [description, setDescription] = useState('');
  const [maxParticipants, setMaxParticipants] = useState<number | undefined>();
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const { user } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<Array<{
    userId: string;
    participationType: 'PARTICIPATION' | 'PREPARATION';
  }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProjects();
    fetchUsers();

    if (event) {
      setEventName(event.eventName);
      setEventType(event.eventType);
      setDate(formatDate(new Date(event.date)));
      setStartTime(event.startTime || '');
      setEndTime(event.endTime || '');
      setLocationText(event.locationText || '');
      setDescription(event.description || '');
      setMaxParticipants(event.maxParticipants);
      setProjectId(event.projectId || '');
      // 参加メンバーを設定
      if (event.participations) {
        setSelectedParticipants(
          event.participations.map((p) => ({
            userId: p.userId,
            participationType: p.participationType,
          }))
        );
      }
    } else {
      setDate(formatDate(new Date()));
      setSelectedParticipants([]);
    }
  }, [event]);

  const fetchProjects = async () => {
    try {
      const response = await api.get<Project[]>('/api/projects');
      setProjects(response.data || []);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setProjects([]);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get<User[]>('/api/users');
      // サポート・行政・マスターユーザーの場合は「さとうだいち」を除外
      const filteredUsers = (response.data || []).filter(u => {
        if ((user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT' || user?.role === 'MASTER') && u.name === 'さとうだいち' && u.role === 'MEMBER') return false;
        return true;
      });
      setUsers(filteredUsers);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
    }
  };

  const handleParticipantToggle = (userId: string, participationType: 'PARTICIPATION' | 'PREPARATION') => {
    setSelectedParticipants((prev) => {
      const existing = prev.find((p) => p.userId === userId);
      if (existing) {
        if (existing.participationType === participationType) {
          // 同じタイプなら削除
          return prev.filter((p) => p.userId !== userId);
        } else {
          // 異なるタイプなら更新
          return prev.map((p) =>
            p.userId === userId ? { ...p, participationType } : p
          );
        }
      } else {
        // 新規追加
        return [...prev, { userId, participationType }];
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data = {
        eventName,
        eventType,
        date,
        startTime: startTime || undefined,
        endTime: endTime || undefined,
        locationText: locationText || undefined,
        description: description || undefined,
        maxParticipants: maxParticipants || undefined,
        projectId: projectId || undefined,
        participants: selectedParticipants.length > 0 ? selectedParticipants : undefined,
      };

      if (event) {
        await api.put(`/api/events/${event.id}`, data);
      } else {
        await api.post('/api/events', data);
      }

      onSaved();
    } catch (error) {
      console.error('Failed to save event:', error);
      alert('保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!event || !confirm('このイベントを削除しますか？')) return;

    try {
      await api.delete(`/api/events/${event.id}`);
      onSaved();
    } catch (error) {
      console.error('Failed to delete event:', error);
      alert('削除に失敗しました');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700 flex-shrink-0">
          <h2 className="text-2xl font-bold dark:text-gray-100">
            {event ? 'イベント編集' : 'イベント作成'}
          </h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto">
          <Input
            label="イベント名"
            type="text"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            required
            placeholder="イベント名を入力"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              イベントタイプ
            </label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as typeof eventType)}
              className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              required
            >
              <option value="TOWN_OFFICIAL">町主催</option>
              <option value="TEAM">協力隊主催</option>
              <option value="OTHER">その他</option>
            </select>
          </div>

          <Input
            label="日付"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="開始時刻（任意）"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
            <Input
              label="終了時刻（任意）"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </div>

          <Input
            label="場所"
            type="text"
            value={locationText}
            onChange={(e) => setLocationText(e.target.value)}
            placeholder="場所を入力"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              説明
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="イベントの説明を入力"
            />
          </div>

          <Input
            label="最大参加者数（任意）"
            type="number"
            min="1"
            value={maxParticipants?.toString() || ''}
            onChange={(e) => setMaxParticipants(e.target.value ? Number(e.target.value) : undefined)}
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

          <div className="flex justify-between pt-4 border-t dark:border-gray-700 flex-shrink-0">
            <div>
              {event && (
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

