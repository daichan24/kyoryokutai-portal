import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import { api } from '../../utils/api';
import { useAuthStore } from '../../stores/authStore';
import { X } from 'lucide-react';
import { Button } from '../common/Button';
import { formatTime } from '../../utils/date';

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
  viewMode: 'week' | 'month' | 'day';
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
  const canEdit = user?.role === 'GOVERNMENT';

  const [popupDate, setPopupDate] = useState<string | null>(null);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('PRESENT');
  const [editNote, setEditNote] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const from = dates[0] ? format(dates[0], 'yyyy-MM-dd') : '';
  const to = dates[dates.length - 1] ? format(dates[dates.length - 1], 'yyyy-MM-dd') : '';
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { data: attendances = [] } = useQuery<GovernmentAttendance[]>({
    queryKey: ['government-attendance', from, to],
    queryFn: async () => {
      const res = await api.get('/api/government-attendance', { params: { from, to } });
      return res.data;
    },
    enabled: !!from && !!to,
  });

  const todayAttendances = attendances.filter((a) =>
    isDateInRange(todayStr, a.date.slice(0, 10), a.endDate?.slice(0, 10))
  );

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

  if (viewMode === 'month') {
    // 月表示: 「今日」と日ごとの出勤状況をコンパクトに確認
    const uniqueDates = Array.from(new Set(dates.map(d => format(d, 'yyyy-MM-dd')))).sort();

    return (
      <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="bg-gray-50 dark:bg-gray-800/80 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              行政出勤カレンダー
              <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
                今日相談できるか確認
              </span>
            </h3>
          </div>
          <span className="inline-flex w-fit items-center rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">
            今日 {format(new Date(), 'M/d（EEE）', { locale: ja })}
          </span>
        </div>
        <div className="p-3 bg-white dark:bg-gray-800">
          <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800/70 dark:bg-blue-900/20">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-blue-900 dark:text-blue-100">今日の行政出勤</p>
              <span className="text-[11px] text-blue-700 dark:text-blue-200">{todayAttendances.length}件</span>
            </div>
            {todayAttendances.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {todayAttendances.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setPopupDate(todayStr)}
                    className={`rounded border px-2 py-1 text-xs ${STATUS_COLORS[a.status]}`}
                    title={`${a.user.name}: ${STATUS_LABELS[a.status]}${a.startTime ? ` ${formatTime(a.startTime)}〜${a.endTime ? formatTime(a.endTime) : ''}` : ''}${a.note ? ` (${a.note})` : ''}`}
                  >
                    {a.user.name.split(/[\s\u3000]/)[0]}・{STATUS_LABELS[a.status]}
                    {a.startTime ? ` ${formatTime(a.startTime)}` : ''}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-blue-800 dark:text-blue-100">今日の出勤記録はまだありません。</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsCalendarOpen((v) => !v)}
            className="mb-3 inline-flex items-center rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {isCalendarOpen ? '行政カレンダーを閉じる' : '行政カレンダーを表示'}
          </button>

          {isCalendarOpen && (
            <>
          {/* 凡例 */}
          <div className="flex flex-wrap gap-3 mb-3">
            {(Object.entries(STATUS_LABELS) as [AttendanceStatus, string][]).map(([status, label]) => (
              <span key={status} className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />
                {label}
              </span>
            ))}
          </div>

          <div className="mb-4 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-7 bg-gray-50 text-center text-[11px] font-semibold text-gray-500 dark:bg-gray-900/60 dark:text-gray-400">
              {['日', '月', '火', '水', '木', '金', '土'].map((day, i) => (
                <div key={day} className={`py-1.5 ${i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : ''}`}>
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700">
              {uniqueDates.map((dateStr) => {
                const date = parseISO(dateStr);
                const dayAttendances = attendances.filter((a) =>
                  isDateInRange(dateStr, a.date.slice(0, 10), a.endDate?.slice(0, 10))
                );
                const isToday = dateStr === todayStr;
                const maxVisible = 4;
                return (
                  <button
                    key={dateStr}
                    type="button"
                    onClick={() => setPopupDate(dayAttendances.length > 0 ? dateStr : null)}
                    className={`min-h-[54px] p-1.5 text-left transition-colors ${
                      dayAttendances.length > 0 ? 'hover:bg-blue-50 dark:hover:bg-blue-900/20' : ''
                    } ${isToday ? 'relative z-10 bg-blue-50 ring-2 ring-inset ring-blue-500 dark:bg-blue-900/30' : 'bg-white dark:bg-gray-800'}`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                        isToday ? 'bg-blue-600 text-white' : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {format(date, 'd')}
                      </span>
                      {isToday && <span className="text-[9px] font-semibold text-blue-600 dark:text-blue-300">今日</span>}
                    </div>
                    <div className="flex flex-wrap gap-0.5">
                      {dayAttendances.slice(0, maxVisible).map((a) => (
                        <span key={a.id} className={`h-2 w-2 rounded-full ${STATUS_DOT[a.status]}`} title={`${a.user.name}: ${STATUS_LABELS[a.status]}`} />
                      ))}
                      {dayAttendances.length > maxVisible && (
                        <span className="text-[9px] font-semibold text-gray-500 dark:text-gray-400">+{dayAttendances.length - maxVisible}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {popupDate && (
            <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/40">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">
                  {format(parseISO(popupDate), 'M月d日（EEE）', { locale: ja })} の出勤状況
                </p>
                <button onClick={() => setPopupDate(null)} className="p-0.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                  <X className="h-3 w-3 text-gray-400" />
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {attendances
                  .filter((a) => isDateInRange(popupDate, a.date.slice(0, 10), a.endDate?.slice(0, 10)))
                  .map((a) => (
                    <span key={a.id} className={`rounded border px-2 py-1 text-xs ${STATUS_COLORS[a.status]}`}>
                      {a.user.name.split(/[\s\u3000]/)[0]}・{STATUS_LABELS[a.status]}
                      {a.startTime ? ` ${formatTime(a.startTime)}` : ''}
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* メンバーごとの出勤状況 */}
          {(() => {
            const memberMap = new Map<string, { user: GovernmentAttendance['user']; attendances: GovernmentAttendance[] }>();
            attendances.forEach((a) => {
              if (!memberMap.has(a.userId)) memberMap.set(a.userId, { user: a.user, attendances: [] });
              memberMap.get(a.userId)!.attendances.push(a);
            });
            const members = Array.from(memberMap.values());
            if (members.length === 0) {
              return <p className="text-xs text-gray-500 dark:text-gray-400">この期間の出勤記録はありません。</p>;
            }
            return members.map(({ user: member, attendances: memberAttendances }) => (
              <div key={member.id} className="mb-2 last:mb-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                    style={{ backgroundColor: member.avatarColor }}>
                    {(member.avatarLetter || member.name || '').charAt(0)}
                  </div>
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{member.name}</span>
                </div>
                <div className="flex flex-wrap gap-1 ml-7">
                  {memberAttendances.map((a) => {
                    const startStr = a.date.slice(0, 10);
                    const endStr = a.endDate?.slice(0, 10) || startStr;
                    const label = startStr === endStr
                      ? format(parseISO(startStr), 'M/d')
                      : `${format(parseISO(startStr), 'M/d')}〜${format(parseISO(endStr), 'M/d')}`;
                    return (
                      <span key={a.id}
                        className={`text-[10px] px-1.5 py-0.5 rounded border ${STATUS_COLORS[a.status]}`}
                        title={`${STATUS_LABELS[a.status]}${a.startTime ? ` ${formatTime(a.startTime)}〜${a.endTime ? formatTime(a.endTime) : ''}` : ''}${a.note ? ` (${a.note})` : ''}`}>
                        {label} {STATUS_LABELS[a.status]}
                      </span>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
          {/* 自分の記録ボタン（行政のみ） */}
          {canEdit && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">自分の出勤を記録：</p>
              <div className="flex flex-wrap gap-1">
                {dates.filter((d, i, arr) => {
                  const ds = format(d, 'yyyy-MM-dd');
                  return arr.findIndex(x => format(x, 'yyyy-MM-dd') === ds) === i;
                }).slice(0, 31).map((date) => {
                  const myAtt = getMyAttendanceForDate(date);
                  return (
                    <button key={format(date, 'yyyy-MM-dd')}
                      onClick={() => openEdit(date)}
                      className={`text-[10px] px-1.5 py-0.5 rounded border ${myAtt ? `${STATUS_COLORS[myAtt.status]} border-solid` : 'border-dashed border-gray-300 dark:border-gray-600 text-gray-400 hover:border-blue-400 hover:text-blue-500'}`}>
                      {format(date, 'M/d')}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
            </>
          )}
        </div>
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
        <div className="bg-white p-3 dark:bg-gray-800">
          <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800/70 dark:bg-blue-900/20">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-blue-900 dark:text-blue-100">今日の行政出勤</p>
              <span className="text-[11px] text-blue-700 dark:text-blue-200">{todayAttendances.length}件</span>
            </div>
            {todayAttendances.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {todayAttendances.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setPopupDate(todayStr)}
                    className={`rounded border px-2 py-1 text-xs ${STATUS_COLORS[a.status]}`}
                    title={`${a.user.name}: ${STATUS_LABELS[a.status]}${a.startTime ? ` ${formatTime(a.startTime)}〜${a.endTime ? formatTime(a.endTime) : ''}` : ''}${a.note ? ` (${a.note})` : ''}`}
                  >
                    {a.user.name.split(/[\s\u3000]/)[0]}・{STATUS_LABELS[a.status]}
                    {a.startTime ? ` ${formatTime(a.startTime)}` : ''}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-blue-800 dark:text-blue-100">今日の出勤記録はまだありません。</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsCalendarOpen((v) => !v)}
            className="inline-flex items-center rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {isCalendarOpen ? '行政カレンダーを閉じる' : '行政カレンダーを表示'}
          </button>
        </div>
        {isCalendarOpen && (
          <>
        <div className="grid grid-cols-7 divide-x divide-gray-200 dark:divide-gray-700">
          {dates.map((date, i) => {
            const dateStr = format(date, 'yyyy-MM-dd');
            const dayAttendances = getAttendancesForDate(date);
            const myAttendance = getMyAttendanceForDate(date);
            const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');

            return (
              <div
                key={i}
                className={`p-1.5 min-h-[4.75rem] relative ${isToday ? 'bg-blue-50 ring-2 ring-inset ring-blue-500 dark:bg-blue-900/20' : 'bg-white dark:bg-gray-800'}`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className={`text-[11px] font-semibold ${isToday ? 'text-blue-700 dark:text-blue-200' : 'text-gray-500 dark:text-gray-400'}`}>
                    {format(date, 'M/d')}
                  </span>
                  {isToday && (
                    <span className="rounded-full bg-blue-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">今日</span>
                  )}
                </div>
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
                        title={`${a.user.name}: ${STATUS_LABELS[a.status]}${a.startTime ? ` ${formatTime(a.startTime)}〜${a.endTime ? formatTime(a.endTime) : ''}` : ''}${a.note ? ` (${a.note})` : ''}`}
                      >
                        {(isStart || !isMultiDay) && (
                          <span className="truncate font-medium">{a.user.name.split(/[\s\u3000]/)[0]}</span>
                        )}
                        {a.startTime && isStart && (
                          <span className="text-[9px] opacity-75 ml-auto whitespace-nowrap">{formatTime(a.startTime)}</span>
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
                                  {formatTime(a.startTime)}〜{a.endTime ? formatTime(a.endTime) : ''}
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
          </>
        )}

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
