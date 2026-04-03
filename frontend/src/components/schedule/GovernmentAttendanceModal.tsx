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

interface GovernmentAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PRESENT: '出勤',
  REMOTE: 'テレワーク',
  ABSENT: '不在',
  HALF_DAY: '午前/午後休',
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

export const GovernmentAttendanceModal: React.FC<GovernmentAttendanceModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('PRESENT');
  const [editNote, setEditNote] = useState('');

  const [members, setMembers] = useState<{ id: string; name: string }[]>([]);

  // メンバー一覧取得
  React.useEffect(() => {
    if (isOpen) {
      fetchMembers();
    }
  }, [isOpen]);

  const fetchMembers = async () => {
    try {
      const response = await api.get('/api/users');
      // 行政（GOVERNMENT）のみを取得
      const govMembers = (response.data || []).filter((u: any) => 
        u.role === 'GOVERNMENT'
      ).sort((a: any, b: any) => a.name.localeCompare(b.name, 'ja'));
      setMembers(govMembers);
    } catch (error) {
      console.error('Failed to fetch members:', error);
    }
  };

  const from = format(currentDate, 'yyyy-MM-01');
  const to = format(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0), 'yyyy-MM-dd');

  const { data: attendances = [], isLoading } = useQuery<GovernmentAttendance[]>({
    queryKey: ['government-attendance', 'modal', from, to, selectedMemberId],
    queryFn: async () => {
      const params = new URLSearchParams({ from, to });
      if (selectedMemberId) params.append('userId', selectedMemberId);
      const res = await api.get('/api/government-attendance', { params });
      return res.data;
    },
    enabled: isOpen && !!from && !!to,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ date, status, note }: { date: string; status: AttendanceStatus; note: string }) => {
      await api.post('/api/government-attendance', { date, status, note: note.trim() || null });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['government-attendance'] });
      setEditStatus('PRESENT');
      setEditNote('');
      setSelectedDate(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/government-attendance/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['government-attendance'] });
      setSelectedDate(null);
    },
  });

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    return { days, firstDay };
  };

  const { days, firstDay } = getDaysInMonth(currentDate);

  const getAttendancesForDate = (dateStr: string) => {
    return attendances.filter((a) => a.date.slice(0, 10) === dateStr);
  };

  const getMyAttendanceForDate = (dateStr: string) => {
    return attendances.find((a) => a.userId === user?.id && a.date.slice(0, 10) === dateStr);
  };

  const openEdit = (dateStr: string) => {
    setSelectedDate(dateStr);
    const existing = getMyAttendanceForDate(dateStr);
    setEditStatus(existing?.status ?? 'PRESENT');
    setEditNote(existing?.note ?? '');
  };

  const handleSave = () => {
    if (selectedDate) {
      saveMutation.mutate({ date: selectedDate, status: editStatus, note: editNote });
    }
  };

  const handleDelete = () => {
    if (selectedDate) {
      const existing = getMyAttendanceForDate(selectedDate);
      if (existing && confirm('この出勤記録を削除しますか？')) {
        deleteMutation.mutate(existing.id);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl m-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700 flex-shrink-0">
          <h2 className="text-2xl font-bold dark:text-gray-100 flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-blue-500" />
            行政出勤カレンダー
          </h2>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* メンバー選択 */}
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">表示メンバー:</label>
            <select
              value={selectedMemberId || ''}
              onChange={(e) => setSelectedMemberId(e.target.value || null)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
            >
              <option value="">全員</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* 月表示 */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <button onClick={handlePrevMonth} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {format(currentDate, 'yyyy年M月', { locale: ja })}
              </h3>
              <button onClick={handleNextMonth} className="p-2 hover:bg-gray-200 dark:hover:bg-gray-700 rounded">
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-700">
              {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
                <div
                  key={day}
                  className={`py-2 text-center text-sm font-medium ${
                    i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} className="h-24 bg-white dark:bg-gray-800" />
              ))}
              {Array.from({ length: days }).map((_, i) => {
                const day = i + 1;
                const dateStr = format(new Date(currentDate.getFullYear(), currentDate.getMonth(), day), 'yyyy-MM-dd');
                const dayAttendances = getAttendancesForDate(dateStr);
                const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
                const myAttendance = getMyAttendanceForDate(dateStr);

                return (
                  <div
                    key={day}
                    className={`h-24 p-1 relative cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      isToday ? 'bg-blue-50 dark:bg-blue-900/10' : 'bg-white dark:bg-gray-800'
                    }`}
                    onClick={() => openEdit(dateStr)}
                  >
                    <span className={`text-sm font-medium ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'}`}>
                      {day}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayAttendances.map((a) => (
                        <div
                          key={a.id}
                          className={`text-[10px] px-1 py-0.5 rounded border flex items-center gap-1 truncate ${STATUS_COLORS[a.status]}`}
                          title={`${a.user.name}: ${STATUS_LABELS[a.status]}${a.note ? ` (${a.note})` : ''}`}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: a.user.avatarColor }}
                          />
                          <span className="truncate">{STATUS_LABELS[a.status]}</span>
                        </div>
                      ))}
                    </div>
                    {myAttendance && (
                      <div className="absolute bottom-1 right-1">
                        <span
                          className={`w-2 h-2 rounded-full ${STATUS_DOT[myAttendance.status]}`}
                          title={STATUS_LABELS[myAttendance.status]}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 出勤記録編集モーダル */}
          {selectedDate && (
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  {format(parseISO(selectedDate), 'M月d日（EEE）', { locale: ja })} の出勤記録
                </h3>
                <button
                  onClick={() => {
                    setSelectedDate(null);
                    setEditStatus('PRESENT');
                    setEditNote('');
                  }}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <X className="h-4 w-4 text-gray-500" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">状況</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(Object.entries(STATUS_LABELS) as [AttendanceStatus, string][]).map(([s, label]) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setEditStatus(s)}
                        className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                          editStatus === s
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
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="例：午前休、午後出勤など"
                    maxLength={500}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
                  />
                </div>

                <div className="flex justify-end gap-2">
                  {getMyAttendanceForDate(selectedDate) && (
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="text-sm text-red-600 dark:text-red-400 hover:underline"
                      disabled={deleteMutation.isPending}
                    >
                      削除
                    </button>
                  )}
                  <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
                    保存
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* 凡例 */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">凡例</h4>
            <div className="flex flex-wrap gap-3">
              {(Object.entries(STATUS_LABELS) as [AttendanceStatus, string][]).map(([status, label]) => (
                <span key={status} className="flex items-center gap-1.5 text-sm">
                  <span className={`w-3 h-3 rounded-full ${STATUS_DOT[status]}`} />
                  <span className="text-gray-700 dark:text-gray-300">{label}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
