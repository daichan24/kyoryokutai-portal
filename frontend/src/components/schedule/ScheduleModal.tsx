import React, { useState, useEffect, useRef } from 'react';
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
  defaultStartTime?: string | null;
  defaultEndTime?: string | null;
  defaultTaskId?: string | null;
  defaultProjectId?: string | null;
  defaultActivityDescription?: string | null;
  readOnly?: boolean; // 閲覧のみモード
  onClose: () => void;
  onSaved: () => void;
}

export const ScheduleModal: React.FC<ScheduleModalProps> = ({
  schedule,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
  defaultTaskId,
  defaultProjectId,
  defaultActivityDescription,
  readOnly = false,
  onClose,
  onSaved,
}) => {
  const [date, setDate] = useState('');
  const [endDate, setEndDate] = useState(''); // 終了日（デフォルトは開始日と同じ）
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [locationText, setLocationText] = useState('');
  const [title, setTitle] = useState(''); // タイトル（短い説明）
  const [activityDescription, setActivityDescription] = useState(''); // 活動内容（詳細）
  const [freeNote, setFreeNote] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [supportEventId, setSupportEventId] = useState<string | null>(null);
  const [supportEvents, setSupportEvents] = useState<Array<{ id: string; eventName: string; startDate: string }>>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [customColor, setCustomColor] = useState<string>(''); // カスタムカラー（空=プロジェクト色/ユーザー色）

  const { user: currentUser } = useAuthStore();

  useEffect(() => {
    fetchLocations();
    fetchUsers();
    fetchProjects();
    fetchSupportEvents();

    if (schedule) {
      const scheduleDateStr = formatDate(schedule.date);
      setDate(scheduleDateStr);
      setEndDate(scheduleDateStr); // 終了日は開始日と同じ（後でスキーマ変更時に対応）
      setStartTime(schedule.startTime);
      setEndTime(schedule.endTime);
      setLocationText(schedule.locationText || '');
      setTitle(schedule.title || '');
      setActivityDescription(schedule.activityDescription);
      setFreeNote(schedule.freeNote || '');
      setSelectedProjectId(schedule.projectId || null);
      setSupportEventId(schedule.supportEventId || null);
      setCustomColor((schedule as any).customColor || '');
      // 編集時も参加者を追加・変更できるようにする
      setIsCollaborative(true);
      // 既存の参加者を選択状態にする
      if (schedule.scheduleParticipants) {
        const existingParticipantIds = schedule.scheduleParticipants
          .filter(p => p.status === 'APPROVED' && p.userId !== schedule.userId)
          .map(p => p.userId);
        setSelectedParticipantIds(existingParticipantIds);
      }
    } else {
      if (defaultDate) {
        const dateStr = formatDate(defaultDate);
        setDate(dateStr);
        setEndDate(dateStr); // デフォルトは開始日と同じ
      }
      if (defaultStartTime) {
        setStartTime(defaultStartTime);
      }
      if (defaultEndTime) {
        setEndTime(defaultEndTime);
      }
      if (defaultProjectId) {
        setSelectedProjectId(defaultProjectId);
      }
      if (defaultActivityDescription) {
        setActivityDescription(defaultActivityDescription);
      }
      setSupportEventId(null);
      setCustomColor('');
    }
  }, [schedule, defaultDate, defaultStartTime, defaultEndTime, defaultProjectId, defaultActivityDescription]);

  const fetchSupportEvents = async () => {
    try {
      const r = await api.get<any[]>('/api/events?status=upcoming');
      const list = r.data || [];
      setSupportEvents(
        list.map((e) => ({
          id: e.id,
          eventName: e.eventName,
          startDate: e.startDate || e.date,
        })),
      );
    } catch {
      setSupportEvents([]);
    }
  };

  const fetchProjects = async () => {
    try {
      // メンバー以外の役職の場合は自分のプロジェクトのみ取得
      let url = '/api/projects';
      if (currentUser?.role !== 'MEMBER') {
        url = `/api/projects?userId=${currentUser?.id}`;
      }
      const response = await api.get(url);
      setProjects(response.data || []);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setProjects([]);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get<User[]>('/api/users');
      // 協力隊メンバーのみ（MASTERを除外、テストユーザーも除外）
      const users = (response.data || []).filter(u => {
        if (u.role !== 'MEMBER' || u.id === currentUser?.id) return false;
        if ((currentUser?.role === 'SUPPORT' || currentUser?.role === 'GOVERNMENT' || currentUser?.role === 'MASTER') && (u.displayOrder ?? 0) === 0) return false;
        return true;
      });
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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    setLoading(true);

    try {
      // 必須項目のバリデーション
      if (!date) {
        alert('開始日を入力してください');
        setLoading(false);
        return;
      }
      if (!startTime) {
        alert('開始時刻を入力してください');
        setLoading(false);
        return;
      }
      if (!endTime) {
        alert('終了時刻を入力してください');
        setLoading(false);
        return;
      }
      if (!title || title.trim() === '') {
        alert('タイトルを入力してください');
        setLoading(false);
        return;
      }

      const data: any = {
        date,
        endDate: endDate !== date ? endDate : undefined, // 終了日が開始日と異なる場合のみ送信
        startTime,
        endTime,
        title: title.trim(),
        activityDescription: activityDescription.trim() || undefined, // 空の場合はundefined
      };
      if (locationText && locationText.trim()) {
        data.locationText = locationText.trim();
      }
      if (freeNote && freeNote.trim()) {
        data.freeNote = freeNote.trim();
      }
      if (customColor) {
        data.customColor = customColor;
      } else {
        data.customColor = null; // 明示的にnullを送信してリセット可能に
      }

      console.log('Sending schedule data:', JSON.stringify(data, null, 2));

      if (selectedProjectId) {
        data.projectId = selectedProjectId;
      }
      if (supportEventId) {
        data.supportEventId = supportEventId;
      } else if (schedule) {
        data.supportEventId = null;
      }

      // 新規作成時・編集時ともに参加者を追加・変更可能
      if (isCollaborative && selectedParticipantIds.length > 0) {
        data.participantsUserIds = selectedParticipantIds;
      }

      // 複製モードの場合は常に新規作成（元のスケジュールはそのまま）
      if (isDuplicateMode || !schedule) {
        await api.post('/api/schedules', data);
        // 複製モードをリセット
        setIsDuplicateMode(false);
        setOriginalScheduleId(null);
      } else {
        await api.put(`/api/schedules/${schedule.id}`, data);
      }

      onSaved();
    } catch (error: any) {
      console.error('Failed to save schedule:', error);
      console.error('Error details:', error.response?.data);
      
      // バリデーションエラーの場合は詳細を表示
      if (error.response?.status === 400) {
        const errorData = error.response.data;
        if (errorData.error && Array.isArray(errorData.error)) {
          // Zodバリデーションエラー
          const errorMessages = errorData.error.map((err: any) => {
            const field = err.path?.join('.') || '不明なフィールド';
            return `${field}: ${err.message}`;
          }).join('\n');
          alert(`バリデーションエラー:\n${errorMessages}`);
        } else if (errorData.error) {
          alert(`エラー: ${errorData.error}`);
        } else {
          alert('保存に失敗しました。入力内容を確認してください。');
        }
      } else if (error.response?.status === 500) {
        // 500エラーの場合は詳細を表示
        const errorData = error.response.data;
        const errorMessage = errorData?.details || errorData?.error || error.message || 'サーバーエラーが発生しました';
        console.error('Server error details:', errorData);
        alert(`サーバーエラーが発生しました:\n${errorMessage}\n\n詳細はコンソールを確認してください。`);
      } else {
        alert(`保存に失敗しました: ${error.response?.data?.error || error.response?.data?.details || error.message || '不明なエラー'}`);
      }
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

  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false);
  const [isDuplicateMode, setIsDuplicateMode] = useState(false);
  const [originalScheduleId, setOriginalScheduleId] = useState<string | null>(null);

  const handleDuplicate = () => {
    if (!schedule) return;
    setShowDuplicateConfirm(true);
  };

  const handleDuplicateConfirm = () => {
    if (!schedule) return;
    setShowDuplicateConfirm(false);
    
    // 複製モードを有効にして、元のスケジュールIDを保存
    setIsDuplicateMode(true);
    setOriginalScheduleId(schedule.id);
    
    // スケジュール情報をコピーして、新しいスケジュールとして編集可能にする
    // 日付は今日の日付に変更
    const todayStr = formatDate(new Date());
    setDate(todayStr);
    setEndDate(todayStr);
    
    // 参加者情報もコピー
    if (schedule.scheduleParticipants && schedule.scheduleParticipants.length > 0) {
      setIsCollaborative(true);
      const existingParticipantIds = schedule.scheduleParticipants
        .filter(p => p.status === 'APPROVED' && p.userId !== schedule.userId)
        .map(p => p.userId);
      setSelectedParticipantIds(existingParticipantIds);
    }
  };

  const handleDuplicateCancel = () => {
    setShowDuplicateConfirm(false);
  };

  return (
    <>
      {/* 複製確認ダイアログ */}
      {showDuplicateConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full m-4 p-6">
            <h3 className="text-xl font-bold dark:text-gray-100 mb-4">
              スケジュールを複製しますか？
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              同じスケジュールを追加します。日付と時間は変更できます。元のスケジュールはそのまま残ります。
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleDuplicateCancel}>
                キャンセル
              </Button>
              <Button onClick={handleDuplicateConfirm}>
                OK
              </Button>
            </div>
          </div>
        </div>
      )}

      <div 
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        onClick={onClose}
      >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700 flex-shrink-0">
          <h2 className="text-2xl font-bold dark:text-gray-100">
            {isDuplicateMode ? 'スケジュール複製（新規作成）' : schedule ? 'スケジュール編集' : 'スケジュール作成'}
          </h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              readOnly={readOnly}
            />
            <Input
              label="終了日"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={date} // 終了日は開始日以降
              required
              readOnly={readOnly}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                開始時刻 *
              </label>
              <select
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                required
                disabled={readOnly}
              >
                {Array.from({ length: 24 * 4 }, (_, i) => {
                  const hour = Math.floor(i / 4);
                  const minute = (i % 4) * 15;
                  const timeValue = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                  return (
                    <option key={timeValue} value={timeValue}>
                      {timeValue}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                終了時刻 *
              </label>
              <select
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                required
                disabled={readOnly}
              >
                {Array.from({ length: 24 * 4 }, (_, i) => {
                  const hour = Math.floor(i / 4);
                  const minute = (i % 4) * 15;
                  const timeValue = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
                  return (
                    <option key={timeValue} value={timeValue}>
                      {timeValue}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              場所
            </label>
            <select
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              disabled={readOnly}
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              プロジェクト（任意）
            </label>
            <select
              value={selectedProjectId || ''}
              onChange={(e) => setSelectedProjectId(e.target.value || null)}
              className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              disabled={readOnly}
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
            <div className="flex items-center mb-2">
              <input
                type="checkbox"
                id="isSupportEvent"
                checked={!!supportEventId}
                onChange={(e) => {
                  if (e.target.checked) {
                    // イベント選択モードに切り替え
                  } else {
                    setSupportEventId(null);
                  }
                }}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600 rounded"
              />
              <label htmlFor="isSupportEvent" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                オーガナイザーへの応援出勤（任意）
              </label>
            </div>

            {supportEventId && (
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  イベントを選択
                </label>
                <select
                  value={supportEventId || ''}
                  onChange={(e) => setSupportEventId(e.target.value || null)}
                  className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">イベントを選択</option>
                  {supportEvents.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {ev.eventName}（{ev.startDate?.slice?.(0, 10) ?? ''}）
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  主催イベントの応援枠として記録します。イベントの日時が自動で反映されます。
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              タイトル <span className="text-error dark:text-red-400">*</span>
            </label>
            <Input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="スケジュールのタイトルを入力"
              maxLength={200}
              required
              readOnly={readOnly}
            />
          </div>

          {/* カラー設定（個人表示用） */}
          {!readOnly && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                表示色（任意・個人表示のみ）
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={customColor || (selectedProjectId ? projects.find(p => p.id === selectedProjectId)?.themeColor || currentUser?.avatarColor || '#3B82F6' : currentUser?.avatarColor || '#3B82F6')}
                  onChange={(e) => setCustomColor(e.target.value)}
                  className="h-9 w-14 rounded border border-border cursor-pointer"
                  disabled={readOnly}
                />
                <div className="flex gap-2">
                  {/* プリセットカラー */}
                  {['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#84CC16'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCustomColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${customColor === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
                {customColor && (
                  <button
                    type="button"
                    onClick={() => setCustomColor('')}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline"
                  >
                    リセット
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                全体表示ではユーザーカラーが使われます
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              活動内容（任意）
            </label>
            <textarea
              value={activityDescription}
              onChange={(e) => setActivityDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="活動内容の詳細を入力"
              readOnly={readOnly}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              備考
            </label>
            <textarea
              value={freeNote}
              onChange={(e) => setFreeNote(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              readOnly={readOnly}
            />
          </div>

          {/* 起票者表示（編集時・詳細表示時） */}
          {schedule && schedule.user && (
            <div className="border-t dark:border-gray-700 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">起票者</h3>
              <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                  style={{ backgroundColor: schedule.user.avatarColor || '#6B7280' }}
                >
                  {(schedule.user.avatarLetter || schedule.user.name || '').charAt(0) || '?'}
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{schedule.user.name}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">({schedule.user.role})</span>
              </div>
            </div>
          )}

          {/* 共同メンバー表示（編集時・詳細表示時） */}
          {schedule && schedule.scheduleParticipants && schedule.scheduleParticipants.length > 0 && (
            <div className="border-t dark:border-gray-700 pt-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">共同メンバー</h3>
              <div className="grid grid-cols-2 gap-4">
                {/* 承認済みメンバー */}
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">承認済み</p>
                  {schedule.scheduleParticipants.filter(p => p.status === 'APPROVED' && p.userId !== schedule.userId).length > 0 ? (
                    <div className="space-y-2">
                      {schedule.scheduleParticipants
                        .filter(p => p.status === 'APPROVED' && p.userId !== schedule.userId)
                        .map((participant) => (
                          <div
                            key={participant.id}
                            className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800"
                          >
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                              style={{ backgroundColor: participant.user?.avatarColor || '#6B7280' }}
                            >
                              {(participant.user?.avatarLetter || participant.user?.name || '').charAt(0) || '?'}
                            </div>
                            <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{participant.user?.name || '不明'}</span>
                            <span className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-200 px-2 py-0.5 rounded">承認済</span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500">なし</p>
                  )}
                </div>

                {/* 未承認メンバー */}
                <div>
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">未承認</p>
                  {schedule.scheduleParticipants.filter(p => p.status === 'PENDING' && p.userId !== schedule.userId).length > 0 ? (
                    <div className="space-y-2">
                      {schedule.scheduleParticipants
                        .filter(p => p.status === 'PENDING' && p.userId !== schedule.userId)
                        .map((participant) => (
                          <div
                            key={participant.id}
                            className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800"
                          >
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                              style={{ backgroundColor: participant.user?.avatarColor || '#6B7280' }}
                            >
                              {(participant.user?.avatarLetter || participant.user?.name || '').charAt(0) || '?'}
                            </div>
                            <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{participant.user?.name || '不明'}</span>
                            <span className="text-xs bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-200 px-2 py-0.5 rounded">未承認</span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500">なし</p>
                  )}
                </div>
              </div>

              {/* 却下メンバー（任意表示） */}
              {schedule.scheduleParticipants.filter(p => p.status === 'REJECTED' && p.userId !== schedule.userId).length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">却下</p>
                  <div className="space-y-2">
                    {schedule.scheduleParticipants
                      .filter(p => p.status === 'REJECTED' && p.userId !== schedule.userId)
                      .map((participant) => (
                        <div
                          key={participant.id}
                          className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600 opacity-60"
                        >
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium"
                            style={{ backgroundColor: participant.user?.avatarColor || '#6B7280' }}
                          >
                            {(participant.user?.avatarLetter || participant.user?.name || '').charAt(0) || '?'}
                          </div>
                          <span className="text-sm text-gray-500 dark:text-gray-400 flex-1">{participant.user?.name || '不明'}</span>
                          <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded">却下</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 共同作業（新規作成時・編集時ともに表示） */}
          <div className="border-t dark:border-gray-700 pt-4">
            <div className="flex items-center mb-3">
              <input
                type="checkbox"
                id="isCollaborative"
                checked={isCollaborative}
                onChange={(e) => setIsCollaborative(e.target.checked)}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600 rounded"
              />
              <label htmlFor="isCollaborative" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                共同作業（他メンバーを巻き込む）
              </label>
            </div>

            {isCollaborative && (
              <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  参加メンバーを選択（協力隊メンバーのみ）
                </label>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {availableUsers.map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center p-2 hover:bg-white dark:hover:bg-gray-600 rounded cursor-pointer"
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
                        className="h-4 w-4 text-primary focus:ring-primary border-gray-300 dark:border-gray-600 rounded"
                      />
                      <div className="ml-3 flex items-center">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium mr-2"
                          style={{ backgroundColor: user.avatarColor }}
                        >
                          {(user.avatarLetter || user.name || '').charAt(0)}
                        </div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{user.name}</span>
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({user.role})</span>
                      </div>
                    </label>
                  ))}
                </div>
                {availableUsers.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">選択可能なメンバーがいません</p>
                )}
              </div>
            )}
          </div>

          </div>
          
          <div className="flex justify-between items-center p-6 border-t dark:border-gray-700 flex-shrink-0">
            {!readOnly && (
              <div className="flex gap-2">
                {schedule && !isDuplicateMode && (
                  <>
                    <Button type="button" variant="danger" onClick={handleDelete}>
                      削除
                    </Button>
                    <Button type="button" variant="outline" onClick={handleDuplicate}>
                      複製
                    </Button>
                  </>
                )}
              </div>
            )}
            <div className={`flex space-x-3 ${readOnly ? 'ml-auto' : ''}`}>
              <Button type="button" variant="outline" onClick={onClose}>
                {readOnly ? '閉じる' : 'キャンセル'}
              </Button>
              {!readOnly && (
                <Button type="submit" disabled={loading}>
                  {loading ? '保存中...' : '保存'}
                </Button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
    </>
  );
};
