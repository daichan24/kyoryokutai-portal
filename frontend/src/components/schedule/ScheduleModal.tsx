import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../../utils/api';
import { Schedule, Location, User } from '../../types';
import { formatDate } from '../../utils/date';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useAuthStore } from '../../stores/authStore';

interface ScheduleModalProps {
  schedule?: Schedule | null;
  defaultDate?: Date | null;
  defaultTaskId?: string | null;
  defaultProjectId?: string | null;
  defaultActivityDescription?: string | null;
  onClose: () => void;
  onSaved: () => void;
}

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  schedule,
  defaultDate,
  defaultTaskId,
  defaultProjectId,
  defaultActivityDescription,
  onClose,
  onSaved,
}) => {
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [locationText, setLocationText] = useState('');
  const [activityDescription, setActivityDescription] = useState('');
  const [freeNote, setFreeNote] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const { user: currentUser } = useAuthStore();

  useEffect(() => {
    fetchLocations();
    fetchUsers();
    fetchTasks();
    fetchProjects();

    if (schedule) {
      setDate(formatDate(schedule.date));
      setStartTime(schedule.startTime);
      setEndTime(schedule.endTime);
      setLocationText(schedule.locationText || '');
      setActivityDescription(schedule.activityDescription);
      setFreeNote(schedule.freeNote || '');
      setSelectedTaskId(schedule.taskId || null);
      setSelectedProjectId(schedule.projectId || null);
      // 編集時は参加者選択を無効化（作成者のみ編集可能）
      setIsCollaborative(false);
    } else {
      if (defaultDate) {
        setDate(formatDate(defaultDate));
      }
      if (defaultTaskId) {
        setSelectedTaskId(defaultTaskId);
      }
      if (defaultProjectId) {
        setSelectedProjectId(defaultProjectId);
      }
      if (defaultActivityDescription) {
        setActivityDescription(defaultActivityDescription);
      }
    }
  }, [schedule, defaultDate, defaultTaskId, defaultProjectId, defaultActivityDescription]);

  const fetchTasks = async () => {
    try {
      // ユーザーのミッションを取得
      const missionsResponse = await api.get('/api/missions');
      const missions = missionsResponse.data || [];
      
      // 各ミッションからタスクを取得
      const allTasks: any[] = [];
      for (const mission of missions) {
        try {
          const tasksResponse = await api.get(`/api/missions/${mission.id}/tasks`);
          const tasks = tasksResponse.data || [];
          allTasks.push(...tasks);
        } catch (error) {
          console.error(`Failed to fetch tasks for mission ${mission.id}:`, error);
        }
      }
      setTasks(allTasks);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      setTasks([]);
    }
  };

  const fetchProjects = async () => {
    try {
      const response = await api.get('/api/projects');
      setProjects(response.data || []);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setProjects([]);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get<User[]>('/api/users');
      // MASTERを除外（招待候補から）
      const users = (response.data || []).filter(u => u.role !== 'MASTER' && u.id !== currentUser?.id);
      setAvailableUsers(users);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setAvailableUsers([]);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await api.get<Location[]>('/api/locations');
      setLocations(response.data || []);
    } catch (error) {
      console.error('Failed to fetch locations:', error);
      setLocations([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data: any = {
        date,
        startTime,
        endTime,
        locationText,
        activityDescription,
        freeNote,
      };

      if (selectedTaskId) {
        data.taskId = selectedTaskId;
      }
      if (selectedProjectId) {
        data.projectId = selectedProjectId;
      }

      // 新規作成時のみ参加者を追加
      if (!schedule && isCollaborative && selectedParticipantIds.length > 0) {
        data.participantsUserIds = selectedParticipantIds;
      }

      if (schedule) {
        await api.put(`/api/schedules/${schedule.id}`, data);
      } else {
        await api.post('/api/schedules', data);
      }

      onSaved();
    } catch (error) {
      console.error('Failed to save schedule:', error);
      alert('保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!schedule || !confirm('このスケジュールを削除しますか?')) return;

    try {
      await api.delete(`/api/schedules/${schedule.id}`);
      onSaved();
    } catch (error) {
      console.error('Failed to delete schedule:', error);
      alert('削除に失敗しました');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold">
            {schedule ? 'スケジュール編集' : 'スケジュール作成'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="日付"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="開始時刻"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
            <Input
              label="終了時刻"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              場所
            </label>
            <select
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-md"
            >
              <option value="">選択してください</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.name}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              プロジェクト（任意）
            </label>
            <select
              value={selectedProjectId || ''}
              onChange={(e) => {
                setSelectedProjectId(e.target.value || null);
                // プロジェクトが変更されたら、そのプロジェクトに紐づくタスクのみ表示
                if (!e.target.value) {
                  setSelectedTaskId(null);
                }
              }}
              className="w-full px-3 py-2 border border-border rounded-md"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              タスク（任意）
            </label>
            <select
              value={selectedTaskId || ''}
              onChange={(e) => setSelectedTaskId(e.target.value || null)}
              className="w-full px-3 py-2 border border-border rounded-md"
              disabled={!selectedProjectId && tasks.filter(t => !t.projectId).length === 0}
            >
              <option value="">選択しない</option>
              {tasks
                .filter((task) => {
                  // プロジェクトが選択されている場合は、そのプロジェクトのタスクのみ表示
                  if (selectedProjectId) {
                    return task.projectId === selectedProjectId;
                  }
                  // プロジェクトが選択されていない場合は、プロジェクトに紐づいていないタスクのみ表示
                  return !task.projectId;
                })
                .map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              活動内容 <span className="text-error">*</span>
            </label>
            <textarea
              value={activityDescription}
              onChange={(e) => setActivityDescription(e.target.value)}
              required
              rows={4}
              className="w-full px-3 py-2 border border-border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              備考
            </label>
            <textarea
              value={freeNote}
              onChange={(e) => setFreeNote(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-md"
            />
          </div>

          {/* 起票者表示（編集時・詳細表示時） */}
          {schedule && schedule.user && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">起票者</h3>
              <div className="flex items-center gap-2 p-2 bg-blue-50 rounded border border-blue-200">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                  style={{ backgroundColor: schedule.user.avatarColor || '#6B7280' }}
                >
                  {schedule.user.name?.charAt(0) || '?'}
                </div>
                <span className="text-sm font-medium text-gray-900">{schedule.user.name}</span>
                <span className="text-xs text-gray-500">({schedule.user.role})</span>
              </div>
            </div>
          )}

          {/* 共同メンバー表示（編集時・詳細表示時） */}
          {schedule && schedule.scheduleParticipants && schedule.scheduleParticipants.length > 0 && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">共同メンバー</h3>
              <div className="grid grid-cols-2 gap-4">
                {/* 承認済みメンバー */}
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">承認済み</p>
                  {schedule.scheduleParticipants.filter(p => p.status === 'APPROVED' && p.userId !== schedule.userId).length > 0 ? (
                    <div className="space-y-2">
                      {schedule.scheduleParticipants
                        .filter(p => p.status === 'APPROVED' && p.userId !== schedule.userId)
                        .map((participant) => (
                          <div
                            key={participant.id}
                            className="flex items-center gap-2 p-2 bg-green-50 rounded border border-green-200"
                          >
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                              style={{ backgroundColor: participant.user?.avatarColor || '#6B7280' }}
                            >
                              {participant.user?.name?.charAt(0) || '?'}
                            </div>
                            <span className="text-sm text-gray-700 flex-1">{participant.user?.name || '不明'}</span>
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">承認済</span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">なし</p>
                  )}
                </div>

                {/* 未承認メンバー */}
                <div>
                  <p className="text-xs font-medium text-gray-600 mb-2">未承認</p>
                  {schedule.scheduleParticipants.filter(p => p.status === 'PENDING' && p.userId !== schedule.userId).length > 0 ? (
                    <div className="space-y-2">
                      {schedule.scheduleParticipants
                        .filter(p => p.status === 'PENDING' && p.userId !== schedule.userId)
                        .map((participant) => (
                          <div
                            key={participant.id}
                            className="flex items-center gap-2 p-2 bg-yellow-50 rounded border border-yellow-200"
                          >
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                              style={{ backgroundColor: participant.user?.avatarColor || '#6B7280' }}
                            >
                              {participant.user?.name?.charAt(0) || '?'}
                            </div>
                            <span className="text-sm text-gray-700 flex-1">{participant.user?.name || '不明'}</span>
                            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">未承認</span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400">なし</p>
                  )}
                </div>
              </div>

              {/* 却下メンバー（任意表示） */}
              {schedule.scheduleParticipants.filter(p => p.status === 'REJECTED' && p.userId !== schedule.userId).length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-gray-600 mb-2">却下</p>
                  <div className="space-y-2">
                    {schedule.scheduleParticipants
                      .filter(p => p.status === 'REJECTED' && p.userId !== schedule.userId)
                      .map((participant) => (
                        <div
                          key={participant.id}
                          className="flex items-center gap-2 p-2 bg-gray-50 rounded border border-gray-200 opacity-60"
                        >
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                            style={{ backgroundColor: participant.user?.avatarColor || '#6B7280' }}
                          >
                            {participant.user?.name?.charAt(0) || '?'}
                          </div>
                          <span className="text-sm text-gray-500 flex-1">{participant.user?.name || '不明'}</span>
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">却下</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 共同作業（新規作成時のみ） */}
          {!schedule && (
            <div className="border-t pt-4">
              <div className="flex items-center mb-3">
                <input
                  type="checkbox"
                  id="isCollaborative"
                  checked={isCollaborative}
                  onChange={(e) => setIsCollaborative(e.target.checked)}
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                />
                <label htmlFor="isCollaborative" className="ml-2 text-sm font-medium text-gray-700">
                  共同作業（他メンバーを巻き込む）
                </label>
              </div>

              {isCollaborative && (
                <div className="mt-3 p-4 bg-gray-50 rounded-lg">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    参加メンバーを選択
                  </label>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {availableUsers.map((user) => (
                      <label
                        key={user.id}
                        className="flex items-center p-2 hover:bg-white rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedParticipantIds.includes(user.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedParticipantIds([...selectedParticipantIds, user.id]);
                            } else {
                              setSelectedParticipantIds(selectedParticipantIds.filter(id => id !== user.id));
                            }
                          }}
                          className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                        />
                        <div className="ml-3 flex items-center">
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium mr-2"
                            style={{ backgroundColor: user.avatarColor }}
                          >
                            {user.name.charAt(0)}
                          </div>
                          <span className="text-sm text-gray-700">{user.name}</span>
                          <span className="ml-2 text-xs text-gray-500">({user.role})</span>
                        </div>
                      </label>
                    ))}
                  </div>
                  {availableUsers.length === 0 && (
                    <p className="text-sm text-gray-500">選択可能なメンバーがいません</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-between pt-4">
            <div>
              {schedule && (
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
