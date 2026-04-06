import React, { useState, useEffect, useRef } from 'react';
import { X, Copy } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Task, Project, Location, User } from '../../types';
import { api } from '../../utils/api';
import { useAuthStore } from '../../stores/authStore';

interface TaskModalProps {
  missionId?: string;
  projectId?: string;
  task?: Task | null;
  /** スケジュールページから開く場合のデフォルト日付 */
  defaultDate?: Date | null;
  defaultStartTime?: string | null;
  defaultEndTime?: string | null;
  onClose: () => void;
  onSaved: () => void;
  onDuplicate?: (task: Task) => void;
  readOnly?: boolean;
  suspendOutsidePointerClose?: boolean;
  onCreateProjectRequest?: () => void;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  missionId,
  projectId: initialProjectId,
  task,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
  onClose,
  onSaved,
  onDuplicate,
  readOnly = false,
  suspendOutsidePointerClose = false,
  onCreateProjectRequest,
}) => {
  const { user: currentUser } = useAuthStore();

  // --- タスク基本フィールド ---
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState(''); // 活動内容（詳細）
  const [projectId, setProjectId] = useState<string | null>(initialProjectId || null);
  const [attachMode, setAttachMode] = useState<'PROJECT' | 'UNSET' | 'KYORYOKUTAI' | 'TRIAGE'>('UNSET');

  // --- 日時フィールド ---
  const [dueDate, setDueDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('17:00');

  // --- スケジュール追加フィールド ---
  const [locationText, setLocationText] = useState('');
  const [freeNote, setFreeNote] = useState('');
  const [customColor, setCustomColor] = useState('');
  const [supportEventId, setSupportEventId] = useState<string | null>(null);
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);

  // --- データ ---
  const [projects, setProjects] = useState<Project[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [supportEvents, setSupportEvents] = useState<Array<{ id: string; eventName: string; startDate: string }>>([]);
  const [missions, setMissions] = useState<Array<{ id: string; missionName: string }>>([]);
  const [selectedMissionId, setSelectedMissionId] = useState<string>(missionId || '');

  const [loading, setLoading] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const toDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // 初期値セット
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setProjectId(task.projectId || initialProjectId || null);
      setAttachMode(
        task.projectId ? 'PROJECT'
        : task.linkKind === 'KYORYOKUTAI_WORK' ? 'KYORYOKUTAI'
        : task.linkKind === 'TRIAGE_PENDING' ? 'TRIAGE'
        : 'UNSET'
      );
      setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
      setEndDate((task as any).endDate ? (task as any).endDate.split('T')[0] : (task.dueDate ? task.dueDate.split('T')[0] : ''));
      setStartTime((task as any).startTime || '09:00');
      setEndTime((task as any).endTime || '17:00');
      setLocationText((task as any).locationText || '');
      setFreeNote((task as any).freeNote || '');
      setCustomColor((task as any).customColor || '');
      setSupportEventId((task as any).supportEventId || null);
      if (task.missionId) setSelectedMissionId(task.missionId);
    } else {
      setTitle('');
      setDescription('');
      setProjectId(initialProjectId || null);
      setAttachMode(initialProjectId ? 'PROJECT' : 'UNSET');
      const dateStr = defaultDate ? toDateStr(defaultDate) : '';
      setDueDate(dateStr);
      setEndDate(dateStr);
      setStartTime(defaultStartTime || '09:00');
      setEndTime(defaultEndTime || '17:00');
      setLocationText('');
      setFreeNote('');
      setCustomColor('');
      setSupportEventId(null);
      setIsCollaborative(false);
      setSelectedParticipantIds([]);
    }
  }, [task, initialProjectId, defaultDate, defaultStartTime, defaultEndTime]);

  // データ取得
  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [projRes, locRes, userRes, evRes, misRes] = await Promise.all([
          missionId ? api.get(`/api/projects?missionId=${missionId}`) : api.get('/api/projects'),
          api.get('/api/locations'),
          api.get<User[]>('/api/users'),
          api.get<any[]>('/api/events?status=upcoming').catch(() => ({ data: [] })),
          !missionId ? api.get('/api/missions') : Promise.resolve({ data: [] }),
        ]);
        setProjects(projRes.data || []);
        setLocations(locRes.data || []);
        const users = (userRes.data || []).filter((u: User) => {
          if (u.role !== 'MEMBER' || u.id === currentUser?.id) return false;
          return true;
        });
        setAvailableUsers(users);
        setSupportEvents((evRes.data || []).map((e: any) => ({
          id: e.id, eventName: e.eventName, startDate: e.startDate || e.date,
        })));
        if (!missionId) {
          setMissions(misRes.data || []);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      }
    };
    fetchAll();
  }, [missionId, currentUser?.id]);

  // 外側クリックで閉じる
  useEffect(() => {
    if (readOnly || suspendOutsidePointerClose) return;
    const handler = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        if (title || description || dueDate) {
          setShowCloseConfirm(true);
        } else {
          onClose();
        }
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [title, description, dueDate, readOnly, suspendOutsidePointerClose]);

  const effectiveMissionId = missionId || selectedMissionId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { alert('タイトルを入力してください'); return; }
    if (!effectiveMissionId) { alert('ミッション（方向性）を選択してください'); return; }
    if (attachMode === 'PROJECT' && !projectId) {
      alert('プロジェクトを選ぶか、別の紐づけ方を選んでください'); return;
    }

    setLoading(true);
    try {
      const effectiveProjectId = attachMode === 'PROJECT' ? projectId : null;
      const linkKind = attachMode === 'PROJECT' ? 'PROJECT'
        : attachMode === 'KYORYOKUTAI' ? 'KYORYOKUTAI_WORK'
        : attachMode === 'TRIAGE' ? 'TRIAGE_PENDING'
        : 'UNSET';

      const data: any = {
        title: title.trim(),
        description: description.trim() || undefined,
        projectId: effectiveProjectId,
        linkKind,
        dueDate: dueDate || null,
        endDate: endDate || dueDate || null,
        startTime,
        endTime,
        locationText: locationText.trim() || undefined,
        freeNote: freeNote.trim() || undefined,
        customColor: customColor || undefined,
        supportEventId: supportEventId || undefined,
        participantsUserIds: isCollaborative && selectedParticipantIds.length > 0 ? selectedParticipantIds : undefined,
      };

      if (task) {
        await api.put(`/api/missions/${effectiveMissionId}/tasks/${task.id}`, data);
      } else {
        await api.post(`/api/missions/${effectiveMissionId}/tasks`, data);
      }
      onSaved();
    } catch (err) {
      console.error('Failed to save task:', err);
      alert('保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const timeOptions = Array.from({ length: 24 * 4 }, (_, i) => {
    const h = Math.floor(i / 4);
    const m = (i % 4) * 15;
    const v = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    return { value: v, label: `${h}:${String(m).padStart(2, '0')}` };
  });

  return (
    <>
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80]" onClick={readOnly ? onClose : () => { if (title || description || dueDate) setShowCloseConfirm(true); else onClose(); }}>
      <div ref={modalRef} className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-bold dark:text-gray-100">
            {task ? 'タスク編集' : 'タスク追加'}
          </h2>
          <div className="flex items-center gap-2">
            {task && !readOnly && onDuplicate && (
              <button type="button" onClick={() => onDuplicate(task)}
                className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <Copy className="h-4 w-4" />複製
              </button>
            )}
            <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">

            {/* ミッション選択（missionIdが渡されていない場合のみ） */}
            {!missionId && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  方向性（ミッション）<span className="text-red-500">*</span>
                </label>
                <select value={selectedMissionId} onChange={(e) => setSelectedMissionId(e.target.value)}
                  className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  disabled={readOnly} required>
                  <option value="">ミッションを選択</option>
                  {missions.map((m) => (
                    <option key={m.id} value={m.id}>{m.missionName}</option>
                  ))}
                </select>
              </div>
            )}

            {/* タイトル */}
            <Input label="タイトル *" type="text" value={title}
              onChange={(e) => setTitle(e.target.value)} required
              placeholder="タスクのタイトルを入力" disabled={readOnly} readOnly={readOnly} />

            {/* 日時 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">開始日</label>
                <Input type="date" value={dueDate}
                  onChange={(e) => { setDueDate(e.target.value); if (!endDate || endDate < e.target.value) setEndDate(e.target.value); }}
                  disabled={readOnly} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">終了日</label>
                <Input type="date" value={endDate} min={dueDate}
                  onChange={(e) => setEndDate(e.target.value)} disabled={readOnly} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">開始時刻</label>
                <select value={startTime} onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  disabled={readOnly}>
                  {timeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">終了時刻</label>
                <select value={endTime} onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  disabled={readOnly}>
                  {timeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            {/* 場所 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">場所</label>
              <select value={locationText} onChange={(e) => setLocationText(e.target.value)}
                className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                disabled={readOnly}>
                <option value="">選択してください</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.name}>{loc.name}</option>
                ))}
              </select>
            </div>

            {/* プロジェクト紐づけ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">プロジェクトとの紐づけ</label>
              <select value={attachMode}
                onChange={(e) => { const v = e.target.value as typeof attachMode; setAttachMode(v); if (v !== 'PROJECT') setProjectId(null); }}
                className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 mb-2"
                disabled={readOnly}>
                <option value="PROJECT">プロジェクトに紐づける</option>
                <option value="UNSET">未設定</option>
                <option value="KYORYOKUTAI">協力隊業務</option>
                <option value="TRIAGE">あとで振り分け</option>
              </select>
              {attachMode === 'PROJECT' && (
                <>
                  <select value={projectId || ''} onChange={(e) => setProjectId(e.target.value || null)}
                    className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                    disabled={readOnly}>
                    <option value="">プロジェクトを選択</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.projectName}</option>)}
                  </select>
                  {!readOnly && missionId && onCreateProjectRequest && (
                    <button type="button" className="mt-2 text-sm text-primary hover:underline"
                      onClick={onCreateProjectRequest}>＋ 新規プロジェクトを作成</button>
                  )}
                </>
              )}
            </div>

            {/* 活動内容 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">活動内容（任意）</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                placeholder="活動内容の詳細を入力" readOnly={readOnly} disabled={readOnly} />
            </div>

            {/* 備考 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">備考</label>
              <textarea value={freeNote} onChange={(e) => setFreeNote(e.target.value)} rows={2}
                className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                readOnly={readOnly} disabled={readOnly} />
            </div>

            {/* 表示色 */}
            {!readOnly && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">表示色（任意）</label>
                <div className="flex items-center gap-3">
                  <input type="color"
                    value={customColor || currentUser?.avatarColor || '#3B82F6'}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="h-9 w-14 rounded border border-border cursor-pointer" />
                  <div className="flex gap-2">
                    {['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#84CC16'].map(c => (
                      <button key={c} type="button" onClick={() => setCustomColor(c)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${customColor === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  {customColor && (
                    <button type="button" onClick={() => setCustomColor('')}
                      className="text-xs text-gray-500 hover:text-gray-700 underline">リセット</button>
                  )}
                </div>
              </div>
            )}

            {/* 応援出勤 */}
            <div>
              <div className="flex items-center mb-2">
                <input type="checkbox" id="isSupportEvent" checked={!!supportEventId}
                  onChange={(e) => { if (!e.target.checked) setSupportEventId(null); }}
                  className="h-4 w-4 text-primary border-gray-300 rounded" />
                <label htmlFor="isSupportEvent" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  オーガナイザーへの応援出勤（任意）
                </label>
              </div>
              {supportEventId !== null && (
                <select value={supportEventId || ''} onChange={(e) => setSupportEventId(e.target.value || null)}
                  className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  disabled={readOnly}>
                  <option value="">イベントを選択</option>
                  {supportEvents.map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.eventName}（{ev.startDate?.slice(0, 10)}）</option>
                  ))}
                </select>
              )}
            </div>

            {/* 共同作業 */}
            <div className="border-t dark:border-gray-700 pt-4">
              <div className="flex items-center mb-3">
                <input type="checkbox" id="isCollaborative" checked={isCollaborative}
                  onChange={(e) => setIsCollaborative(e.target.checked)}
                  className="h-4 w-4 text-primary border-gray-300 rounded" />
                <label htmlFor="isCollaborative" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  共同作業（他メンバーを巻き込む）
                </label>
              </div>
              {isCollaborative && (
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg max-h-48 overflow-y-auto space-y-2">
                  {availableUsers.map((u) => (
                    <label key={u.id} className="flex items-center p-2 hover:bg-white dark:hover:bg-gray-600 rounded cursor-pointer">
                      <input type="checkbox" checked={selectedParticipantIds.includes(u.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedParticipantIds([...selectedParticipantIds, u.id]);
                          else setSelectedParticipantIds(selectedParticipantIds.filter(id => id !== u.id));
                        }}
                        className="h-4 w-4 text-primary border-gray-300 rounded" />
                      <div className="ml-3 flex items-center">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium mr-2"
                          style={{ backgroundColor: u.avatarColor }}>
                          {(u.avatarLetter || u.name || '').charAt(0)}
                        </div>
                        <span className="text-sm text-gray-700 dark:text-gray-300">{u.name}</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* フッター */}
          <div className="flex justify-end gap-3 p-6 border-t dark:border-gray-700 flex-shrink-0">
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

    {showCloseConfirm && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[90]">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full m-4 p-6">
          <h3 className="text-xl font-bold dark:text-gray-100 mb-4">編集内容が保存されていません</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">編集内容は保存されませんが、よろしいですか？</p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowCloseConfirm(false)}>編集に戻る</Button>
            <Button variant="danger" onClick={() => { setShowCloseConfirm(false); onClose(); }}>OK</Button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};
