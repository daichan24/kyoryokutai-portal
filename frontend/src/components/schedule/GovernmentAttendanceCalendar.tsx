import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import { api } from '../../utils/api';
import { useAuthStore } from '../../stores/authStore';
import { X } from 'lucide-react';
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

interface GovernmentAttendanceCalendarProps {
  dates: Date[];
  viewMode: 'week' | 'month';
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: '出勤',
  REMOTE: '出張',
  ABSENT: '休み',
  HALF_DAY: '半休・時短',
};

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-green-600 text-white border-green-700',
  REMOTE: 'bg-blue-600 text-white border-blue-700',
  ABSENT: 'bg-gray-700 text-white border-gray-800',
  HALF_DAY: 'bg-orange-500 text-white border-orange-600',
};

const STATUS_DOT: Record<AttendanceStatus, string> = {
  PRESENT: 'bg-green-600',
  REMOTE: 'bg-blue-600',
  ABSENT: 'bg-gray-700',
  HALF_DAY: 'bg-orange-500',
};

function isDateInRange(dateStr: string, startStr: string, endStr: string | null | undefined): boolean {
  const end = endStr || startStr;
  return dateStr >= startStr && dateStr <= end;
}

export const GovernmentAttendanceCalendar: React.FC<GovernmentAttendanceCalendarProps> = ({
  dates,
  viewMode,
}) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const canEdit = user?.role === 'GOVERNMENT';

  const [popupDate, setPopupDate] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('PRESENT');
  const [editNote, setEditNote] = useState('');

  const from = dates[0] ? format(dates[0], 'yyyy-MM-dd') : '';
  const to = dates[dates.length - 1] ? format(dates[dates.length - 1], 'yyyy-MM-dd') : '';

  const { data: attendances = [] } = useQuery<GovernmentAttendance[]>({
    queryKey: ['government-attendance', from, to],
    queryFn: async () => {
      const res = await api.get('/api/government-attendance', { params: { from, to } });
      return res.data;
    },
    enabled: !!from && !!to,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ date, status, note }: { date: string; status: AttendanceStatus; note: string }) => {
      await api.post('/api/government-attendance', { date, status, note: note.trim() || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['government-attendance'] });
      setEditingDate(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/government-attendance/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['government-attendance'] });
    },
  });

  const getAttendancesForDate = (date: Date): GovernmentAttendance[] => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return attendances.filter((a) =>
      isDateInRange(dateStr, a.date.slice(0, 10), a.endDate?.slice(0, 10))
    );
  };

  const getMyAttendanceForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return attendances.find(
      (a) => a.userId === user?.id && isDateInRange(dateStr, a.date.slice(0, 10), a.endDate?.slice(0, 10))
    );
  };

  const openEdit = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const existing = getMyAttendanceForDate(date);
    setEditingDate(dateStr);
    setEditStatus(existing?.status ?? 'PRESENT');
    setEditNote(existing?.note ?? '');
  };

  if (viewMode === 'week') {
    return (
      <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800/80 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            🏢 行政出勤カレンダー
            <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
              （今日相談できるか確認できます）
            </span>
          </h3>
        </div>
        <div className="grid grid-cols-7 divide-x divide-gray-200 dark:divide-gray-700">
          {dates.map((date, i) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const dayAttendances = getAttendancesForDate(date);
            const myAttendance = getMyAttendanceForDate(date);
            const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');

            return (
              <div
                key={i}
                className={`p-1.5 min-h-[4rem] relative ${isToday ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-white dark:bg-gray-800'}`}
              >
                {/* 出勤状況バッジ（複数日またがり対応） */}
                <div className="space-y-0.5 mb-1">
                  {dayAttendances.map((a) => {
                    const startStr = a.date.slice(0, 10);
                    const endStr = a.endDate?.slice(0, 10) || startStr;
                    const isMultiDay = startStr !== endStr;
                    const isStart = dateStr === startStr;
                    const isEnd = dateStr === endStr;
                    return (
                      <button
                        key={a.id}
                        onClick={() => setPopupDate(popupDate === dateStr ? null : dateStr)}
                        className={`w-full text-[10px] px-1 py-0.5 flex items-center gap-1 border ${STATUS_COLORS[a.status]} ${
                          isMultiDay
                            ? isStart ? 'rounded-l border-r-0' : isEnd ? 'rounded-r border-l-0' : 'rounded-none border-x-0'
                            : 'rounded'
                        }`}
                        title={`${a.user.name}: ${STATUS_LABELS[a.status]}${a.startTime ? ` ${a.startTime}〜${a.endTime || ''}` : ''}${a.note ? ` (${a.note})` : ''}`}
                      >
                        {(isStart || !isMultiDay) && (
                          <span className="truncate font-medium">{a.user.name.split(/[\s　]/)[0]}</span>
                        )}
                        {a.startTime && isStart && (
                          <span className="text-[9px] opacity-75 ml-auto whitespace-nowrap">{a.startTime}</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* 自分の記録ボタン（行政のみ） */}
                {canEdit && (
                  <button
                    onClick={() => openEdit(date)}
                    className={`w-full text-[10px] rounded border border-dashed py-0.5 transition-colors ${
                      myAttendance
                        ? `${STATUS_COLORS[myAttendance.status]} border-solid`
                        : 'border-gray-300 dark:border-gray-600 text-gray-400 hover:border-blue-400 hover:text-blue-500'
                    }`}
                  >
                    {myAttendance ? STATUS_LABELS[myAttendance.status] : '+ 記録'}
                  </button>
                )}

                {/* ポップアップ */}
                {popupDate === dateStr && dayAttendances.length > 0 && (
                  <div className="absolute top-full left-0 z-30 mt-1 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-2"
                    onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        {format(date, 'M月d日（EEE）', { locale: ja })}
                      </p>
                      <button onClick={() => setPopupDate(null)} className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                        <X className="h-3 w-3 text-gray-400" />
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {dayAttendances.map((a) => (
                        <div key={a.id} className="flex items-start gap-1.5">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0 mt-0.5"
                            style={{ backgroundColor: a.user.avatarColor }}>
                            {(a.user.avatarLetter || a.user.name || '').charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{a.user.name}</p>
                            <div className="flex flex-wrap items-center gap-1">
                              <span className={`text-[10px] px-1 py-0.5 rounded ${STATUS_COLORS[a.status]}`}>
                                {STATUS_LABELS[a.status]}
                              </span>
                              {a.startTime && (
                                <span className="text-[10px] text-gray-600 dark:text-gray-400">
                                  {a.startTime}〜{a.endTime || ''}
                                </span>
                              )}
                            </div>
                            {a.endDate && a.endDate.slice(0, 10) !== a.date.slice(0, 10) && (
                              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                                〜{format(parseISO(a.endDate.slice(0, 10)), 'M/d')}
                              </p>
                            )}
                            {a.note && <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate">{a.note}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* 凡例 */}
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-3">
          {(Object.entries(STATUS_LABELS) as [AttendanceStatus, string][]).map(([status, label]) => (
            <span key={status} className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
              <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
              {label}
            </span>
          ))}
        </div>

        {/* 編集モーダル（行政のみ） */}
        {editingDate && canEdit && (
          <AttendanceEditModal
            date={editingDate}
            existingId={attendances.find((a) => a.userId === user?.id && a.date.slice(0, 10) === editingDate)?.id}
            initialStatus={editStatus}
            initialNote={editNote}
            onClose={() => setEditingDate(null)}
            onSaved={() => setEditingDate(null)}
            onDeleted={() => setEditingDate(null)}
          />
        )}
      </div>
    );
  }

  return null;
};

// 月表示用フック
export function useGovernmentAttendanceForMonth(from: string, to: string) {
  return useQuery<GovernmentAttendance[]>({
    queryKey: ['government-attendance', from, to],
    queryFn: async () => {
      const res = await api.get('/api/government-attendance', { params: { from, to } });
      return res.data;
    },
    enabled: !!from && !!to,
  });
}

// 出勤記録編集モーダル
interface AttendanceEditModalProps {
  date: string;
  existingId?: string;
  initialStatus: AttendanceStatus;
  initialNote: string;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}

export const AttendanceEditModal: React.FC<AttendanceEditModalProps> = ({
  date,
  existingId,
  initialStatus,
  initialNote,
  onClose,
  onSaved,
  onDeleted,
}) => {
  const [status, setStatus] = useState<AttendanceStatus>(initialStatus);
  const [note, setNote] = useState(initialNote);
  const queryClient = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.post('/api/government-attendance', { date, status, note: note.trim() || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['government-attendance'] });
      onSaved();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!existingId) return;
      await api.delete(`/api/government-attendance/${existingId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['government-attendance'] });
      onDeleted?.();
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm m-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
            出勤記録 — {format(parseISO(date), 'M月d日（EEE）', { locale: ja })}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">状況</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(STATUS_LABELS) as [AttendanceStatus, string][]).map(([s, label]) => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    status === s
                      ? STATUS_COLORS[s] + ' border-2'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">メモ（任意）</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="例：午後から出勤" maxLength={500}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
            />
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <div>
            {existingId && (
              <button type="button"
                onClick={() => { if (confirm('この出勤記録を削除しますか？')) deleteMutation.mutate(); }}
                className="text-sm text-red-600 dark:text-red-400 hover:underline"
                disabled={deleteMutation.isPending}>
                削除
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>キャンセル</Button>
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>保存</Button>
          </div>
        </div>
      </div>
    </div>
  );
};
