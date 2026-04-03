import React, { useState } from 'react';
import { X, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import { api } from '../../utils/api';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../common/Button';

type AttendanceStatus = 'PRESENT' | 'REMOTE' | 'ABSENT' | 'HALF_DAY';

interface GovernmentAttendance {
  id: string;
  userId: string;
  date: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  status: AttendanceStatus;
  note?: string | null;
  user: {
    id: string;
    name: string;
    avatarColor: string;
    avatarLetter?: string | null;
    role: string;
  };
}

interface DraftEntry {
  status: AttendanceStatus;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  note?: string;
}

interface GovernmentAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: '◯ (出勤)',
  REMOTE: '出張',
  ABSENT: '✕ (休み)',
  HALF_DAY: '△ (半休・短時間)',
};

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border-green-300 dark:border-green-700',
  REMOTE: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-700',
  ABSENT: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border-red-300 dark:border-red-700',
  HALF_DAY: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
};

const STATUS_DOT: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-green-500',
  REMOTE: 'bg-blue-500',
  ABSENT: 'bg-red-500',
  HALF_DAY: 'bg-yellow-500',
};

function isDateInRange(dateStr: string, startStr: string, endStr: string | null | undefined): boolean {
  const end = endStr || startStr;
  return dateStr >= startStr && dateStr <= end;
}

export const GovernmentAttendanceModal: React.FC<GovernmentAttendanceModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const canEdit = user?.role === 'GOVERNMENT';
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('PRESENT');
  const [editEndDate, setEditEndDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editNote, setEditNote] = useState('');
  const [draftAttendances, setDraftAttendances] = useState<Record<string, DraftEntry | null>>({});
  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);

  React.useEffect(() => {
    if (isOpen) fetchMembers();
  }, [isOpen]);

  const fetchMembers = async () => {
    try {
      const response = await api.get('/api/users');
      const govMembers = (response.data || [])
        .filter((u: any) => u.role === 'GOVERNMENT')
        .sort((a: any, b: any) => a.name.localeCompare(b.name, 'ja'));
      setMembers(govMembers);
    } catch (error) {
      console.error('Failed to fetch members:', error);
    }
  };

  const from = format(currentDate, 'yyyy-MM-01');
  const to = format(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0), 'yyyy-MM-dd');

  const { data: attendances = [] } = useQuery<GovernmentAttendance[]>({
    queryKey: ['government-attendance', 'modal', from, to, selectedMemberId],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to });
      if (selectedMemberId) params.append('userId', selectedMemberId);
      const res = await api.get('/api/government-attendance', { params });
      return res.data;
    },
    enabled: isOpen && !!from && !!to,
  });

  const bulkSaveMutation = useMutation({
    mutationFn: async (drafts: Record<string, DraftEntry | null>) => {
      const updates = Object.entries(drafts)
        .filter(([_, val]) => val !== null)
        .map(([date, val]) => ({
          date,
          endDate: val!.endDate || null,
          startTime: val!.startTime || null,
          endTime: val!.endTime || null,
          status: val!.status,
          note: val!.note || null,
        }));
      const deletes = Object.entries(drafts)
        .filter(([_, val]) => val === null)
        .map(([date]) => date);
      await api.post('/api/government-attendance/bulk', { updates, deletes });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['government-attendance'] });
      setDraftAttendances({});
      setSelectedDate(null);
      alert('変更を保存しました');
    },
    onError: (error: any) => {
      alert(`保存に失敗しました: ${error.response?.data?.error || error.message}`);
    },
  });

  const handlePrevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const days = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const getAttendancesForDate = (dateStr: string) =>
    attendances.filter((a) => isDateInRange(dateStr, a.date.slice(0, 10), a.endDate?.slice(0, 10)));

  const getMyServerAttendanceForDate = (dateStr: string) =>
    attendances.find((a) => a.userId === user?.id && isDateInRange(dateStr, a.date.slice(0, 10), a.endDate?.slice(0, 10)));

  const getEffectiveMyAttendance = (dateStr: string): DraftEntry | null => {
    const draft = draftAttendances[dateStr];
    if (draft !== undefined) return draft;
    const server = getMyServerAttendanceForDate(dateStr);
    if (!server) return null;
    return {
      status: server.status,
      endDate: server.endDate?.slice(0, 10) || undefined,
      startTime: server.startTime || undefined,
      endTime: server.endTime || undefined,
      note: server.note || undefined,
    };
  };

  const openEdit = (dateStr: string) => {
    if (!canEdit) return;
    if (selectedMemberId && selectedMemberId !== user?.id) return;
    setSelectedDate(dateStr);
    const existing = getEffectiveMyAttendance(dateStr);
    setEditStatus(existing?.status ?? 'PRESENT');
    setEditEndDate(existing?.endDate ?? '');
    setEditStartTime(existing?.startTime ?? '');
    setEditEndTime(existing?.endTime ?? '');
    setEditNote(existing?.note ?? '');
  };

  const handleApplyDraft = () => {
    if (!selectedDate) return;
    setDraftAttendances((prev) => ({
      ...prev,
      [selectedDate]: {
        status: editStatus,
        endDate: editEndDate || undefined,
        startTime: editStartTime || undefined,
        endTime: editEndTime || undefined,
        note: editNote || undefined,
      },
    }));
    setSelectedDate(null);
  };

  const handleDeleteDraft = () => {
    if (!selectedDate) return;
    setDraftAttendances((prev) => ({ ...prev, [selectedDate]: null }));
    setSelectedDate(null);
  };

  const handleSetWeekdays = () => {
    const newDrafts = { ...draftAttendances };
    for (let day = 1; day <= days; day++) {
      const date = new Date(year, month, day);
      const dateStr = format(date, 'yyyy-MM-dd');
      newDrafts[dateStr] = date.getDay() === 0 || date.getDay() === 6 ? null : { status: 'PRESENT' };
    }
    setDraftAttendances(newDrafts);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl m-4 max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg font-bold dark:text-gray-100 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-blue-500" />
            行政出勤カレンダー
          </h2>
          <div className="flex gap-2">
            {canEdit && Object.keys(draftAttendances).length > 0 && (
              <Button size="sm" onClick={() => bulkSaveMutation.mutate(draftAttendances)} disabled={bulkSaveMutation.isPending}>
                {bulkSaveMutation.isPending ? '保存中...' : '変更を保存'}
              </Button>
            )}
            <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* メンバー選択 */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">表示:</label>
            <select
              value={selectedMemberId || ''}
              onChange={(e) => setSelectedMemberId(e.target.value || null)}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
            >
              <option value="">全員</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            {canEdit && (!selectedMemberId || selectedMemberId === user?.id) && (
              <Button variant="outline" size="sm" onClick={handleSetWeekdays}>平日勤務一括設定</Button>
            )}
          </div>

          {/* 月カレンダー */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-b dark:border-gray-700">
              <button onClick={handlePrevMonth} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                {format(currentDate, 'yyyy年M月', { locale: ja })}
              </h3>
              <button onClick={handleNextMonth} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700">
              {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
                <div key={day} className={`py-1.5 text-center text-xs font-medium bg-gray-50 dark:bg-gray-800 ${
                  i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-600 dark:text-gray-400'
                }`}>{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="h-20 bg-white dark:bg-gray-800" />
              ))}
              {Array.from({ length: days }).map((_, i) => {
                const day = i + 1;
                const dateStr = format(new Date(year, month, day), 'yyyy-MM-dd');
                const dayAttendances = getAttendancesForDate(dateStr);
                const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
                const myAttendance = getEffectiveMyAttendance(dateStr);
                const hasDraft = draftAttendances[dateStr] !== undefined;
                const isEditable = canEdit && (!selectedMemberId || selectedMemberId === user?.id);

                return (
                  <div
                    key={day}
                    className={`h-20 p-1 relative transition-colors ${
                      isEditable ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50' : 'cursor-default'
                    } ${isToday ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-white dark:bg-gray-800'} ${
                      hasDraft ? 'ring-2 ring-inset ring-yellow-400' : ''
                    }`}
                    onClick={() => openEdit(dateStr)}
                  >
                    <div className="flex justify-between items-start">
                      <span className={`text-xs font-medium ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                        {day}
                      </span>
                      {hasDraft && <span className="text-[9px] text-yellow-600 font-bold">未保存</span>}
                    </div>
                    <div className="mt-0.5 space-y-0.5">
                      {dayAttendances.filter((a) => a.userId !== user?.id).map((a) => {
                        const startStr = a.date.slice(0, 10);
                        const endStr = a.endDate?.slice(0, 10) || startStr;
                        const isMultiDay = startStr !== endStr;
                        const isStart = dateStr === startStr;
                        const isEnd = dateStr === endStr;
                        return (
                          <div
                            key={a.id}
                            className={`text-[10px] px-1 py-0.5 flex items-center gap-1 truncate border ${STATUS_COLORS[a.status]} ${
                              isMultiDay
                                ? isStart ? 'rounded-l border-r-0' : isEnd ? 'rounded-r border-l-0' : 'rounded-none border-x-0'
                                : 'rounded'
                            }`}
                            title={`${a.user.name}: ${STATUS_LABELS[a.status]}${a.startTime ? ` ${a.startTime}〜${a.endTime || ''}` : ''}${a.note ? ` (${a.note})` : ''}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: a.user.avatarColor }} />
                            <span className="truncate">{a.user.name.split(/[\s　]/)[0]}</span>
                            {a.startTime && isStart && <span className="text-[9px] opacity-75 ml-auto whitespace-nowrap">{a.startTime}</span>}
                          </div>
                        );
                      })}
                      {myAttendance && (() => {
                        const endStr = myAttendance.endDate || dateStr;
                        const isMultiDay = myAttendance.endDate && myAttendance.endDate !== dateStr;
                        return (
                          <div
                            className={`text-[10px] px-1 py-0.5 flex items-center gap-1 truncate border ${STATUS_COLORS[myAttendance.status]} ${
                              isMultiDay ? 'rounded-l border-r-0' : 'rounded'
                            }`}
                            title={`${user?.name}: ${STATUS_LABELS[myAttendance.status]}${myAttendance.startTime ? ` ${myAttendance.startTime}〜${myAttendance.endTime || ''}` : ''}${myAttendance.note ? ` (${myAttendance.note})` : ''}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: user?.avatarColor || '#ccc' }} />
                            <span className="truncate">{(user?.name || '').split(/[\s　]/)[0]}</span>
                            {myAttendance.startTime && <span className="text-[9px] opacity-75 ml-auto whitespace-nowrap">{myAttendance.startTime}</span>}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 出勤記録編集フォーム（行政のみ） */}
          {selectedDate && canEdit && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                  {format(parseISO(selectedDate), 'M月d日（EEE）', { locale: ja })} の出勤記録
                </h3>
                <button onClick={() => setSelectedDate(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">状況</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(Object.entries(STATUS_LABELS) as [AttendanceStatus, string][]).map(([s, label]) => (
                      <button key={s} type="button" onClick={() => setEditStatus(s)}
                        className={`px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                          editStatus === s ? STATUS_COLORS[s] + ' border-2' : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >{label}</button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">終了日（複数日の場合）</label>
                    <input type="date" value={editEndDate} min={selectedDate}
                      onChange={(e) => setEditEndDate(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">連絡可能 開始時刻</label>
                    <input type="time" value={editStartTime}
                      onChange={(e) => setEditStartTime(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">連絡可能 終了時刻</label>
                    <input type="time" value={editEndTime}
                      onChange={(e) => setEditEndTime(e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">メモ（任意）</label>
                  <input type="text" value={editNote} onChange={(e) => setEditNote(e.target.value)}
                    placeholder="例：午前休、午後出勤など" maxLength={500}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={handleDeleteDraft}
                    className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded font-medium"
                  >削除</button>
                  <Button size="sm" onClick={handleApplyDraft}>仮決定</Button>
                </div>
              </div>
            </div>
          )}

          {/* 凡例 */}
          <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-400">
            {(Object.entries(STATUS_LABELS) as [AttendanceStatus, string][]).map(([status, label]) => (
              <span key={status} className="flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[status]}`} />
                {label}
              </span>
            ))}
            <span className="text-gray-400 dark:text-gray-500">※ 時刻はメンバーへの連絡可能時間</span>
          </div>
        </div>
      </div>
    </div>
  );
};
