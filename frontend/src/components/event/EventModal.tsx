import React, { useState, useEffect, useRef } from 'react';
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
  const [endDate, setEndDate] = useState(''); // 終了日（デフォルトは開始日と同じ）
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
      const eventDateStr = formatDate(new Date(event.date));
      setDate(eventDateStr);
      setEndDate(eventDateStr); // 終了日は開始日と同じ（後でスキーマ変更時に対応）
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
      const todayStr = formatDate(new Date());
      setDate(todayStr);
      setEndDate(todayStr); // デフォルトは開始日と同じ
      setSelectedParticipants([]);
    }
  }, [event]);

  const fetchProjects = async () => {
    try {
      // 自分のプロジェクトのみ取得
      const response = await api.get<Project[]>(`/api/projects?userId=${user?.id}`);
      setProjects(response.data || []);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setProjects([]);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get<User[]>('/api/users');
      // メンバーだけを追加できるようにする（さとうだいちは除外）
      const filteredUsers = (response.data || []).filter(u => {
        // メンバー以外は除外
        if (u.role !== 'MEMBER') return false;
        // さとうだいちは除外
        if (u.name === 'さとうだいち') return false;
        // 自分自身は除外（共同作業者として追加するため）
        if (u.id === user?.id) return false;
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

  const [isCollaborative, setIsCollaborative] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (event && event.participations && event.participations.length > 0) {
      setIsCollaborative(true);
    }
  }, [event]);

  const hasChanges = () => {
    if (!event) {
      // 新規作成時は、何か入力されていれば変更あり
      return !!(eventName || date || startTime || endTime || locationText || description || projectId || selectedParticipants.length > 0);
    }
    // 編集時は、元の値と比較
    const originalDate = formatDate(new Date(event.date));
    return (
      eventName !== event.eventName ||
      date !== originalDate ||
      startTime !== (event.startTime || '') ||
      endTime !== (event.endTime || '') ||
      locationText !== (event.locationText || '') ||
      description !== (event.description || '') ||
      projectId !== (event.projectId || '') ||
      JSON.stringify(selectedParticipants) !== JSON.stringify(event.participations?.map(p => ({ userId: p.userId, participationType: p.participationType })) || [])
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
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        handleCloseClick();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [eventName, date, startTime, endTime, locationText, description, projectId, selectedParticipants]);

  return (
    <>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={handleCloseClick}>
      <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700 flex-shrink-0">
          <h2 className="text-2xl font-bold dark:text-gray-100">
            {event ? 'イベント編集' : 'イベント作成'}
          </h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0">
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

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="開始日"
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                // 開始日が変更されたら、終了日も同じ日付に設定（終了日が空の場合）
                if (!endDate || endDate === date) {
                  setEndDate(e.target.value);
                }
              }}
              required
            />
            <Input
              label="終了日"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={date} // 終了日は開始日以降
              required
            />
          </div>

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

          <div>
            <label className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={isCollaborative}
                onChange={(e) => {
                  setIsCollaborative(e.target.checked);
                  if (!e.target.checked) {
                    setSelectedParticipants([]);
                  }
                }}
                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary dark:bg-gray-700 dark:border-gray-600"
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                共同作業（他メンバーを巻き込む）
              </span>
            </label>
            {isCollaborative && (
              <div className="mt-2 space-y-2">
                {users
                  .filter((u) => u.id !== user?.id)
                  .map((u) => {
                    const participant = selectedParticipants.find((p) => p.userId === u.id);
                    return (
                      <div key={u.id} className="flex items-center gap-3 p-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800">
                        <div className="flex-1">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {u.name}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleParticipantToggle(u.id, 'PARTICIPATION')}
                            className={`px-3 py-1 text-xs rounded transition-colors ${
                              participant?.participationType === 'PARTICIPATION'
                                ? 'bg-blue-500 text-white dark:bg-blue-600'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            参加
                          </button>
                          <button
                            type="button"
                            onClick={() => handleParticipantToggle(u.id, 'PREPARATION')}
                            className={`px-3 py-1 text-xs rounded transition-colors ${
                              participant?.participationType === 'PREPARATION'
                                ? 'bg-orange-500 text-white dark:bg-orange-600'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            準備
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
          </div>

          {/* フッター固定 */}
          <div className="flex justify-between p-6 border-t dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800">
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

