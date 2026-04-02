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
  dates: Date[]; // 表示中の日付一覧（週または月）
  viewMode: 'week' | 'month';
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: '出勤',
  REMOTE: 'テレワーク',
  ABSENT: '不在',
  HALF_DAY: '半日',
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

export const GovernmentAttendanceCalendar: React.FC<GovernmentAttendanceCalendarProps> = ({
  dates,
  viewMode,
}) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const isGovStaff = user?.role === 'GOVERNMENT' || user?.role === 'MASTER' || user?.role === 'SUPPORT';

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

  const getAttendancesForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return attendances.filter((a) => a.date.slice(0, 10) === dateStr);
  };

  const getMyAttendanceForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return attendances.find((a) => a.userId === user?.id && a.date.slice(0, 10) === dateStr);
  };

  const openEdit = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const existing = getMyAttendanceForDate(date);
    setEditingDate(dateStr);
    setEditStatus(existing?.status ?? 'PRESENT');
    setEditNote(existing?.note ?? '');
  };

  if (viewMode === 'week') {
    // 週表示: 横並びで各日の出勤状況を表示
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
            const dayAttendances = getAttendancesForDate(date);
            const myAttendance = getMyAttendanceForDate(date);
            const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

            return (
              <div
                key={i}
                className={`p-1.5 min-h-[4rem] ${isToday ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-white dark:bg-gray-800'}`}
              >
                {/* 他の人の出勤状況 */}
                <div className="space-y-0.5 mb-1">
                  {dayAttendances.map((a) => (
                    <div
                      key={a.id}
                      className={`text-[10px] px-1 py-0.5 rounded border flex items-center gap-1 ${STATUS_COLORS[a.status]}`}
                      title={`${a.user.name}: ${STATUS_LABELS[a.status]}${a.note ? ` (${a.note})` : ''}`}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: a.user.avatarColor }}
                      />
                      <span className="truncate">{a.user.name.split('')[0]}</span>
                      <span className="truncate">{STATUS_LABELS[a.status]}</span>
                    </div>
                  ))}
                </div>

                {/* 自分の記録ボタン（行政スタッフのみ） */}
                {isGovStaff && (
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
      </div>
    );
  }

  // 月表示: 各日セルに小さいドットで表示（月カレンダーに統合するため、データのみ返す）
  // 月表示では各日のセルに出勤情報を表示するためのヘルパーとして使う
  return null;
};

// 月表示用: 特定の日の出勤状況を取得するフック
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
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-sm m-4"
        onClick={(e) => e.stopPropagation()}
      >
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
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    status === s
                      ? STATUS_COLORS[s] + ' border-2'
                      : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              メモ（任意）
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例：午後から出勤"
              maxLength={500}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
            />
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <div>
            {existingId && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('この出勤記録を削除しますか？')) deleteMutation.mutate();
                }}
                className="text-sm text-red-600 dark:text-red-400 hover:underline"
                disabled={deleteMutation.isPending}
              >
                削除
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>キャンセル</Button>
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              保存
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
