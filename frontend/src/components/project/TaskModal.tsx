import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, RefreshCw } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Task, Project, Location, User, Schedule } from '../../types';
import { api } from '../../utils/api';
import { useAuthStore } from '../../stores/authStore';
import { formatDate } from '../../utils/date';

interface TaskModalProps {
  missionId?: string;
  projectId?: string;
  task?: Task | null;
  schedule?: Schedule | null;
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

// 繰り返しスケジュールモーダル
interface RecurringModalProps {
  onClose: () => void;
  onSaved: () => void;
  defaultTitle?: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
  defaultProjectId?: string | null;
  defaultCustomColor?: string;
}

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

const RecurringScheduleModal: React.FC<RecurringModalProps> = ({
  onClose, onSaved, defaultTitle = '', defaultStartTime = '09:00',
  defaultEndTime = '17:00', defaultProjectId = null, defaultCustomColor = '',
}) => {
  const [title, setTitle] = useState(defaultTitle);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);
  const [locationText, setLocationText] = useState('');
  const [recurrenceType, setRecurrenceType] = useState<'weekly' | 'daily'>('weekly');
  const [weekdays, setWeekdays] = useState<number[]>([3]); // デフォルト水曜
  const [startDate, setStartDate] = useState('');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId);
  const [customColor, setCustomColor] = useState(defaultCustomColor);
  const [projects, setProjects] = useState<Project[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([api.get('/api/projects'), api.get('/api/locations')]).then(([pr, lr]) => {
      setProjects(pr.data || []);
      setLocations(lr.data || []);
    }).catch(console.error);
  }, []);

  const timeOptions = Array.from({ length: 24 * 4 }, (_, i) => {
    const h = Math.floor(i / 4);
    const m = (i % 4) * 15;
    const v = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    return { value: v, label: `${h}:${String(m).padStart(2, '0')}` };
  });

  const toggleWeekday = (d: number) => {
    setWeekdays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { alert('タイトルを入力してください'); return; }
    if (!startDate) { alert('開始日を入力してください'); return; }
    if (!recurrenceEndDate) { alert('終了日を入力してください'); return; }
    if (recurrenceType === 'weekly' && weekdays.length === 0) { alert('曜日を選択してください'); return; }
    setLoading(true);
    try {
      const res = await api.post('/api/schedules/recurring', {
        title: title.trim(),
        startTime, endTime,
        locationText: locationText || undefined,
        projectId: projectId || null,
        customColor: customColor || null,
        recurrenceType,
        weekdays: recurrenceType === 'weekly' ? weekdays : undefined,
        startDate,
        recurrenceEndDate,
      });
      alert(`${res.data.count}件のスケジュールを作成しました`);
      onSaved();
    } catch (err: any) {
      alert(err.response?.data?.error || '作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[90]">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full m-4 max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center px-6 py-4 border-b dark:border-gray-700">
          <h2 className="text-xl font-bold dark:text-gray-100">繰り返しスケジュール</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300">
            <X className="h-6 w-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          <Input label="タイトル *" value={title} onChange={e => setTitle(e.target.value)} required placeholder="例: 定例ミーティング" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">開始時刻</label>
              <select value={startTime} onChange={e => setStartTime(e.target.value)}
                className="w-full max-w-[140px] px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm">
                {timeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">終了時刻</label>
              <select value={endTime} onChange={e => setEndTime(e.target.value)}
                className="w-full max-w-[140px] px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm">
                {timeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">場所（任意）</label>
            <select value={locationText} onChange={e => setLocationText(e.target.value)}
              className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm">
              <option value="">選択してください</option>
              {locations.map(loc => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">繰り返しタイプ</label>
            <div className="flex gap-3">
              {(['weekly', 'daily'] as const).map(t => (
                <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" checked={recurrenceType === t} onChange={() => setRecurrenceType(t)} className="h-4 w-4" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{t === 'weekly' ? '毎週' : '毎日'}</span>
                </label>
              ))}
            </div>
          </div>

          {recurrenceType === 'weekly' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">曜日を選択</label>
              <div className="flex gap-2 flex-wrap">
                {WEEKDAY_LABELS.map((label, i) => (
                  <button key={i} type="button" onClick={() => toggleWeekday(i)}
                    className={`w-9 h-9 rounded-full text-sm font-medium transition-colors ${
                      weekdays.includes(i)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">開始日 *</label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">終了日 *</label>
              <Input type="date" value={recurrenceEndDate} min={startDate} onChange={e => setRecurrenceEndDate(e.target.value)} required />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">プロジェクト（任意）</label>
            <select value={projectId || ''} onChange={e => setProjectId(e.target.value || null)}
              className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm">
              <option value="">未設定</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.projectName}</option>)}
            </select>
          </div>
        </form>
        <div className="flex justify-end gap-3 px-6 py-4 border-t dark:border-gray-700">
          <Button type="button" variant="outline" onClick={onClose}>キャンセル</Button>
          <Button type="button" disabled={loading} onClick={handleSubmit as any}>
            {loading ? '作成中...' : '一括作成'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export const TaskModal: React.FC<TaskModalProps> = ({
  missionId,
  projectId: defaultProjectId,
  task,
  schedule,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
  onClose,
  onSaved,
  onDuplicate,
  readOnly = false,
  suspendOutsidePointerClose = false,
}) => {
  const { user: currentUser } = useAuthStore();
  const isScheduleMode = !!schedule && !task;

  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [locationText, setLocationText] = useState('');
  const [selectedMissionId, setSelectedMissionId] = useState(missionId || '');
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId || null);
  const [attachMode, setAttachMode] = useState<'PROJECT' | 'UNSET' | 'KYORYOKUTAI' | 'TRIAGE'>('UNSET');
  const [memo, setMemo] = useState('');
  const [customColor, setCustomColor] = useState('');
  const [supportEventId, setSupportEventId] = useState<string | null>(null);
  const [showSupportEvents, setShowSupportEvents] = useState(false);
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [showRecurringModal, setShowRecurringModal] = useState(false);

  const [missions, setMissions] = useState<Array<{ id: string; missionName: string }>>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [supportEvents, setSupportEvents] = useState<Array<{ id: string; eventName: string; startDate: string }>>([]);

  const [loading, setLoading] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [isDuplicateMode, setIsDuplicateMode] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const toDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  useEffect(() => {
    if (schedule) {
      setTitle(schedule.title || schedule.activityDescription || '');
      const sd = formatDate(schedule.date);
      setDueDate(sd);
      const ed = (schedule as any).endDate ? formatDate(new Date((schedule as any).endDate)) : sd;
      setEndDate(ed);
      setStartTime(schedule.startTime);
      setEndTime(schedule.endTime);
      setLocationText(schedule.locationText || '');
      setProjectId(schedule.projectId || null);
      setAttachMode(schedule.projectId ? 'PROJECT' : 'UNSET');
      const combined = [schedule.activityDescription, schedule.freeNote].filter(Boolean).join('\n');
      setMemo(combined);
      setCustomColor((schedule as any).customColor || '');
      setSupportEventId(schedule.supportEventId || null);
      setShowSupportEvents(!!schedule.supportEventId);
      setIsCollaborative(!!(schedule.scheduleParticipants && schedule.scheduleParticipants.length > 0));
      if (schedule.scheduleParticipants) {
        setSelectedParticipantIds(
          schedule.scheduleParticipants.filter(p => p.status === 'APPROVED' && p.userId !== schedule.userId).map(p => p.userId)
        );
      }
    } else if (task) {
      setTitle(task.title);
      setDueDate(task.dueDate ? task.dueDate.split('T')[0] : '');
      setEndDate((task as any).endDate ? (task as any).endDate.split('T')[0] : (task.dueDate ? task.dueDate.split('T')[0] : ''));
      setStartTime((task as any).startTime || '09:00');
      setEndTime((task as any).endTime || '17:00');
      setLocationText((task as any).locationText || '');
      setProjectId(task.projectId || null);
      setAttachMode(task.projectId ? 'PROJECT' : task.linkKind === 'KYORYOKUTAI_WORK' ? 'KYORYOKUTAI' : task.linkKind === 'TRIAGE_PENDING' ? 'TRIAGE' : 'UNSET');
      const combined = [(task as any).description, (task as any).freeNote].filter(Boolean).join('\n');
      setMemo(combined);
      setCustomColor((task as any).customColor || '');
      setSupportEventId((task as any).supportEventId || null);
      setShowSupportEvents(!!(task as any).supportEventId);
      if (task.missionId) setSelectedMissionId(task.missionId);
    } else {
      setTitle('');
      const dateStr = defaultDate ? toDateStr(defaultDate) : '';
      setDueDate(dateStr);
      setEndDate(dateStr);
      setStartTime(defaultStartTime || '09:00');
      setEndTime(defaultEndTime || '17:00');
      setLocationText('');
      setProjectId(defaultProjectId || null);
      setAttachMode(defaultProjectId ? 'PROJECT' : 'UNSET');
      setMemo('');
      setCustomColor('');
      setSupportEventId(null);
      setShowSupportEvents(false);
      setIsCollaborative(false);
      setSelectedParticipantIds([]);
    }
  }, [task, schedule, missionId, defaultDate, defaultStartTime, defaultEndTime, defaultProjectId]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const effectiveMissionId = missionId || (task?.missionId);
        const [projRes, locRes, userRes, evRes, misRes] = await Promise.all([
          effectiveMissionId ? api.get(`/api/projects?missionId=${effectiveMissionId}`) : api.get('/api/projects'),
          api.get('/api/locations'),
          api.get<User[]>('/api/users'),
          api.get<any[]>('/api/events?status=upcoming').catch(() => ({ data: [] })),
          api.get('/api/missions'),
        ]);
        setProjects(projRes.data || []);
        setLocations(locRes.data || []);
        setAvailableUsers((userRes.data || []).filter((u: User) => u.role === 'MEMBER' && u.id !== currentUser?.id));
        setSupportEvents((evRes.data || []).map((e: any) => ({ id: e.id, eventName: e.eventName, startDate: e.startDate || e.date })));
        setMissions(misRes.data || []);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      }
    };
    fetchAll();
  }, [missionId, task?.missionId, currentUser?.id]);

  useEffect(() => {
    if (readOnly || suspendOutsidePointerClose) return;
    const handler = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        if (title || memo || dueDate) setShowCloseConfirm(true);
        else onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [title, memo, dueDate, readOnly, suspendOutsidePointerClose]);

  const effectiveMissionId = missionId || selectedMissionId || task?.missionId || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { alert('タイトルを入力してください'); return; }
    setLoading(true);
    try {
      if (isScheduleMode && schedule) {
        const data: any = {
          date: dueDate,
          endDate: endDate !== dueDate ? endDate : undefined,
          startTime, endTime,
          title: title.trim(),
          activityDescription: memo.trim() || title.trim(),
          locationText: locationText.trim() || undefined,
          customColor: customColor || null,
          supportEventId: supportEventId || null,
          projectId: attachMode === 'PROJECT' ? projectId : null,
        };
        if (isCollaborative && selectedParticipantIds.length > 0) data.participantsUserIds = selectedParticipantIds;
        if (isDuplicateMode) {
          await api.post('/api/schedules', data);
        } else {
          await api.put(`/api/schedules/${schedule.id}`, data);
        }
      } else {
        if (!effectiveMissionId && attachMode !== 'KYORYOKUTAI') { alert('ミッション（方向性）を選択してください'); setLoading(false); return; }
        if (attachMode === 'PROJECT' && !projectId) { alert('プロジェクトを選ぶか、別の紐づけ方を選んでください'); setLoading(false); return; }
        const linkKind = attachMode === 'PROJECT' ? 'PROJECT' : attachMode === 'KYORYOKUTAI' ? 'KYORYOKUTAI_WORK' : attachMode === 'TRIAGE' ? 'TRIAGE_PENDING' : 'UNSET';
        // 協力隊業務の場合は最初のミッションを使用（バックエンドはmissionId必須）
        const targetMissionId = effectiveMissionId || (missions.length > 0 ? missions[0].id : '');
        if (!targetMissionId) { alert('ミッション（方向性）を選択してください'); setLoading(false); return; }
        const data: any = {
          title: title.trim(),
          description: memo.trim() || undefined,
          projectId: attachMode === 'PROJECT' ? projectId : null,
          linkKind,
          dueDate: dueDate || null,
          endDate: endDate || dueDate || null,
          startTime, endTime,
          locationText: locationText.trim() || undefined,
          customColor: customColor || undefined,
          supportEventId: supportEventId || undefined,
          participantsUserIds: isCollaborative && selectedParticipantIds.length > 0 ? selectedParticipantIds : undefined,
        };
        if (task) {
          await api.put(`/api/missions/${targetMissionId}/tasks/${task.id}`, data);
        } else {
          await api.post(`/api/missions/${targetMissionId}/tasks`, data);
        }
      }
      onSaved();
    } catch (err) {
      console.error('Failed to save:', err);
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
    } catch { alert('削除に失敗しました'); }
  };

  const timeOptions = Array.from({ length: 24 * 4 }, (_, i) => {
    const h = Math.floor(i / 4);
    const m = (i % 4) * 15;
    const v = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    return { value: v, label: `${h}:${String(m).padStart(2, '0')}` };
  });

  const modalTitle = isDuplicateMode ? '複製（新規作成）' : schedule ? 'タスク編集' : task ? 'タスク編集' : 'タスク追加';

  return (
    <>
    {showRecurringModal && (
      <RecurringScheduleModal
        onClose={() => setShowRecurringModal(false)}
        onSaved={() => { setShowRecurringModal(false); onSaved(); }}
        defaultTitle={title}
        defaultStartTime={startTime}
        defaultEndTime={endTime}
        defaultProjectId={attachMode === 'PROJECT' ? projectId : null}
        defaultCustomColor={customColor}
      />
    )}
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80]"
      onClick={readOnly ? onClose : () => { if (title || memo || dueDate) setShowCloseConfirm(true); else onClose(); }}>
      <div ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>

        <div className="flex justify-between items-center px-6 py-4 border-b dark:border-gray-700 flex-shrink-0">
          <h2 className="text-xl font-bold dark:text-gray-100">{modalTitle}</h2>
          <div className="flex items-center gap-2">
            {/* 繰り返しボタン（新規作成時のみ） */}
            {!task && !schedule && !readOnly && (
              <button type="button" onClick={() => setShowRecurringModal(true)}
                className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <RefreshCw className="h-4 w-4" />繰り返し
              </button>
            )}
            {task && !readOnly && onDuplicate && (
              <button type="button" onClick={() => onDuplicate(task)}
                className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <Copy className="h-4 w-4" />複製
              </button>
            )}
            {schedule && !readOnly && !isDuplicateMode && (
              <button type="button" onClick={() => { setIsDuplicateMode(true); setDueDate(toDateStr(new Date())); setEndDate(toDateStr(new Date())); }}
                className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <Copy className="h-4 w-4" />複製
              </button>
            )}
            <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

            <Input label="タイトル *" type="text" value={title}
              onChange={(e) => setTitle(e.target.value)} required
              placeholder="タスクのタイトルを入力" disabled={readOnly} readOnly={readOnly} />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">開始日</label>
                <Input type="date" value={dueDate}
                  onChange={(e) => { setDueDate(e.target.value); if (!endDate || endDate < e.target.value) setEndDate(e.target.value); }}
                  disabled={readOnly} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">終了日</label>
                <Input type="date" value={endDate} min={dueDate}
                  onChange={(e) => setEndDate(e.target.value)} disabled={readOnly} />
              </div>
            </div>

            {/* 時刻選択（幅を制限） */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">開始時刻</label>
                <select value={startTime} onChange={(e) => setStartTime(e.target.value)}
                  className="w-full max-w-[140px] px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                  disabled={readOnly} size={1}>
                  {timeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">終了時刻</label>
                <select value={endTime} onChange={(e) => setEndTime(e.target.value)}
                  className="w-full max-w-[140px] px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                  disabled={readOnly} size={1}>
                  {timeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">場所</label>
              <select value={locationText} onChange={(e) => setLocationText(e.target.value)}
                className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                disabled={readOnly}>
                <option value="">選択してください</option>
                {locations.map((loc) => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
              </select>
            </div>

            {/* ミッション・プロジェクト */}
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/30">
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">紐づけ</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">方向性（ミッション）</label>
                  <select value={selectedMissionId} onChange={(e) => {
                      const v = e.target.value;
                      if (v === '__KYORYOKUTAI__') {
                        setSelectedMissionId('');
                        setAttachMode('KYORYOKUTAI');
                        setProjectId(null);
                      } else {
                        setSelectedMissionId(v);
                      }
                    }}
                    className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                    disabled={readOnly || isScheduleMode}>
                    <option value="">未選択</option>
                    <option value="__KYORYOKUTAI__">協力隊業務</option>
                    {missions.map((m) => <option key={m.id} value={m.id}>{m.missionName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">プロジェクト</label>
                  <select value={attachMode === 'PROJECT' ? (projectId || '') : attachMode}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === 'UNSET' || v === 'KYORYOKUTAI' || v === 'TRIAGE') {
                        setAttachMode(v as any); setProjectId(null);
                      } else if (v === '') {
                        setAttachMode('UNSET'); setProjectId(null);
                      } else {
                        setAttachMode('PROJECT'); setProjectId(v);
                      }
                    }}
                    className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                    disabled={readOnly}>
                    <option value="">未設定</option>
                    <option value="KYORYOKUTAI">協力隊業務</option>
                    <option value="TRIAGE">あとで振り分け</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.projectName}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">メモ（任意）</label>
              <textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={3}
                className="w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                placeholder="活動内容・備考など" readOnly={readOnly} disabled={readOnly} />
            </div>

            {!readOnly && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">表示色（任意）</label>
                <div className="flex items-center gap-2 flex-wrap">
                  <input type="color" value={customColor || currentUser?.avatarColor || '#3B82F6'}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="h-8 w-12 rounded border border-border cursor-pointer" />
                  {['#3B82F6','#10B981','#F59E0B','#EF4444','#8B5CF6','#EC4899','#06B6D4','#84CC16'].map(c => (
                    <button key={c} type="button" onClick={() => setCustomColor(c)}
                      className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${customColor === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                  {customColor && (
                    <button type="button" onClick={() => setCustomColor('')}
                      className="text-xs text-gray-500 hover:text-gray-700 underline ml-1">リセット</button>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showSupportEvents}
                  onChange={(e) => { setShowSupportEvents(e.target.checked); if (!e.target.checked) setSupportEventId(null); }}
                  className="h-4 w-4 text-primary border-gray-300 rounded" disabled={readOnly} />
                <span className="text-sm text-gray-700 dark:text-gray-300">オーガナイザーへの応援出勤（任意）</span>
              </label>
              {showSupportEvents && (
                <select value={supportEventId || ''} onChange={(e) => setSupportEventId(e.target.value || null)}
                  className="mt-2 w-full px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                  disabled={readOnly}>
                  <option value="">イベントを選択</option>
                  {supportEvents.map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.eventName}（{ev.startDate?.slice(0, 10)}）</option>
                  ))}
                </select>
              )}
            </div>

            <div className="border-t dark:border-gray-700 pt-3">
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input type="checkbox" checked={isCollaborative}
                  onChange={(e) => setIsCollaborative(e.target.checked)}
                  className="h-4 w-4 text-primary border-gray-300 rounded" />
                <span className="text-sm text-gray-700 dark:text-gray-300">共同作業（他メンバーを巻き込む）</span>
              </label>
              {isCollaborative && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg max-h-40 overflow-y-auto space-y-1">
                  {availableUsers.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 p-1.5 hover:bg-white dark:hover:bg-gray-600 rounded cursor-pointer">
                      <input type="checkbox" checked={selectedParticipantIds.includes(u.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedParticipantIds([...selectedParticipantIds, u.id]);
                          else setSelectedParticipantIds(selectedParticipantIds.filter(id => id !== u.id));
                        }}
                        className="h-4 w-4 text-primary border-gray-300 rounded" />
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0"
                        style={{ backgroundColor: u.avatarColor }}>
                        {(u.avatarLetter || u.name || '').charAt(0)}
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300">{u.name}</span>
                    </label>
                  ))}
                  {availableUsers.length === 0 && <p className="text-xs text-gray-400">選択可能なメンバーがいません</p>}
                </div>
              )}
            </div>

            {schedule && schedule.scheduleParticipants && schedule.scheduleParticipants.length > 0 && readOnly && (
              <div className="border-t dark:border-gray-700 pt-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">参加メンバー</p>
                <div className="flex flex-wrap gap-2">
                  {schedule.scheduleParticipants.map((p) => (
                    <div key={p.id} className="flex items-center gap-1 px-2 py-1 rounded-full text-xs"
                      style={{ backgroundColor: p.user?.avatarColor + '20', color: p.user?.avatarColor }}>
                      {p.user?.name} ({p.status === 'APPROVED' ? '承認済' : p.status === 'PENDING' ? '未承認' : '却下'})
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          <div className="flex justify-between items-center px-6 py-4 border-t dark:border-gray-700 flex-shrink-0">
            <div>
              {schedule && !readOnly && !isDuplicateMode && (
                <Button type="button" variant="danger" onClick={handleDelete}>削除</Button>
              )}
            </div>
            <div className="flex gap-3">
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
