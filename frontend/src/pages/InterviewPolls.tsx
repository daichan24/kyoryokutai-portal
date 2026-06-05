import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { CalendarCheck, Check, Circle, Plus, RefreshCw, Users, X } from 'lucide-react';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import type { InterviewAvailabilityStatus, InterviewPoll, InterviewPollAssignment, User } from '../types';
import { sortUsersByDisplayOrder } from '../utils/userSort';

const staffRoles = ['MASTER', 'SUPPORT', 'GOVERNMENT'];

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function firstHalfDates(month: string) {
  const [year, rawMonth] = month.split('-').map(Number);
  return Array.from({ length: 15 }, (_, index) => {
    const day = index + 1;
    return `${year}-${String(rawMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  });
}

function dateLabel(date: string) {
  return format(new Date(`${date}T00:00:00+09:00`), 'M/d（EEE）', { locale: ja });
}

function statusLabel(status: InterviewPoll['status']) {
  if (status === 'COLLECTING') return '回答受付中';
  if (status === 'PROPOSED') return '暫定案作成済み';
  if (status === 'CONFIRMED') return '確定済み';
  return '取消';
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error === 'object' && error && 'response' in error) {
    const response = (error as { response?: { data?: { error?: string } } }).response;
    return response?.data?.error || fallback;
  }
  return fallback;
}

export const InterviewPolls: React.FC = () => {
  const { user } = useAuthStore();
  const isStaff = !!user && staffRoles.includes(user.role);

  const [polls, setPolls] = useState<InterviewPoll[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [month, setMonth] = useState(currentMonth());
  const [title, setTitle] = useState(`${currentMonth()} 月次面談`);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [dateRows, setDateRows] = useState(() =>
    firstHalfDates(currentMonth()).map((date) => ({ date, capacity: 4, unavailableDepartments: [] as string[] })),
  );
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [draftAvailability, setDraftAvailability] = useState<Record<string, InterviewAvailabilityStatus>>({});

  const selectedPoll = useMemo(
    () => polls.find((poll) => poll.id === selectedId) || polls[0] || null,
    [polls, selectedId],
  );

  const departments = useMemo(
    () => [...new Set(members.map((m) => (m.department || '').trim()).filter(Boolean))].sort(),
    [members],
  );

  const responsesByMember = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const item of selectedPoll?.availability || []) {
      if (!map.has(item.memberId)) map.set(item.memberId, new Set());
      map.get(item.memberId)!.add(item.dateId);
    }
    return map;
  }, [selectedPoll]);

  const assignmentsByDate = useMemo(() => {
    const map = new Map<string, InterviewPollAssignment[]>();
    for (const assignment of selectedPoll?.assignments || []) {
      const items = map.get(assignment.dateId) || [];
      items.push(assignment);
      map.set(assignment.dateId, items);
    }
    return map;
  }, [selectedPoll]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [pollRes, userRes] = await Promise.all([
        api.get<InterviewPoll[]>('/api/interview-polls'),
        api.get<User[]>('/api/users?role=MEMBER'),
      ]);
      setPolls(pollRes.data);
      const orderedMembers = sortUsersByDisplayOrder(userRes.data || []);
      setMembers(orderedMembers);
      setSelectedMemberIds(new Set(orderedMembers.map((m) => m.id)));
      if (!selectedId && pollRes.data[0]) setSelectedId(pollRes.data[0].id);
    } catch (err) {
      setError(getErrorMessage(err, '面談日程調整を取得できませんでした'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedPoll || !user) return;
    const mine = selectedPoll.myAvailability || selectedPoll.availability.filter((a) => a.memberId === user.id);
    setDraftAvailability(Object.fromEntries(mine.map((a) => [a.dateId, a.status])));
  }, [selectedPoll, user]);

  const updateMonth = (nextMonth: string) => {
    setMonth(nextMonth);
    setTitle(`${nextMonth} 月次面談`);
    setDateRows(firstHalfDates(nextMonth).map((date) => ({ date, capacity: 4, unavailableDepartments: [] })));
  };

  const createPoll = async () => {
    if (!isStaff || selectedMemberIds.size === 0) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<InterviewPoll>('/api/interview-polls', {
        title,
        month,
        startTime,
        endTime,
        dates: dateRows,
        memberIds: [...selectedMemberIds],
      });
      setPolls((prev) => [res.data, ...prev]);
      setSelectedId(res.data.id);
    } catch (err) {
      setError(getErrorMessage(err, '面談日程調整を作成できませんでした'));
    } finally {
      setSaving(false);
    }
  };

  const saveAvailability = async () => {
    if (!selectedPoll) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.put<InterviewPoll>(`/api/interview-polls/${selectedPoll.id}/availability`, {
        availability: selectedPoll.dates.map((d) => ({ dateId: d.id, status: draftAvailability[d.id] || 'NG' })),
      });
      setPolls((prev) => prev.map((p) => (p.id === res.data.id ? res.data : p)));
    } catch (err) {
      setError(getErrorMessage(err, '回答を保存できませんでした'));
    } finally {
      setSaving(false);
    }
  };

  const propose = async () => {
    if (!selectedPoll || !isStaff) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<{ poll: InterviewPoll }>(`/api/interview-polls/${selectedPoll.id}/propose`);
      setPolls((prev) => prev.map((p) => (p.id === res.data.poll.id ? res.data.poll : p)));
    } catch (err) {
      setError(getErrorMessage(err, '暫定日割りを作成できませんでした'));
    } finally {
      setSaving(false);
    }
  };

  const confirm = async () => {
    if (!selectedPoll || !isStaff) return;
    if (!window.confirm('暫定日割りを確定し、各隊員のスケジュールに反映します。よろしいですか？')) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<InterviewPoll>(`/api/interview-polls/${selectedPoll.id}/confirm`);
      setPolls((prev) => prev.map((p) => (p.id === res.data.id ? res.data : p)));
    } catch (err) {
      setError(getErrorMessage(err, '面談日程を確定できませんでした'));
    } finally {
      setSaving(false);
    }
  };

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  const toggleUnavailableDepartment = (index: number, department: string) => {
    setDateRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const set = new Set(row.unavailableDepartments);
        if (set.has(department)) set.delete(department);
        else set.add(department);
        return { ...row, unavailableDepartments: [...set] };
      }),
    );
  };

  if (loading) {
    return <div className="p-6 text-gray-600 dark:text-gray-300">読み込み中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">面談日程調整</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            候補日、上長NG日、隊員回答をもとに日割りを作成します。
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <RefreshCw className="h-4 w-4" />
          更新
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <aside className="space-y-4">
          {isStaff && (
            <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
              <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-gray-100">
                <Plus className="h-4 w-4" />
                新規作成
              </h2>
              <div className="mt-4 space-y-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  対象月
                  <input
                    type="month"
                    value={month}
                    onChange={(e) => updateMonth(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  タイトル
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    開始
                    <input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                    />
                  </label>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    終了
                    <input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                    />
                  </label>
                </div>

                <div>
                  <div className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">候補日・定員・上長NG課</div>
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {dateRows.map((row, index) => (
                      <div key={row.date} className="rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) =>
                              setDateRows((prev) => prev.map((r, i) => (i === index ? { ...r, date: e.target.value } : r)))
                            }
                            className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
                          />
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={row.capacity}
                            onChange={(e) =>
                              setDateRows((prev) =>
                                prev.map((r, i) => (i === index ? { ...r, capacity: Number(e.target.value) } : r)),
                              )
                            }
                            className="w-16 rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-900"
                          />
                        </div>
                        {departments.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {departments.map((department) => {
                              const active = row.unavailableDepartments.includes(department);
                              return (
                                <button
                                  key={department}
                                  type="button"
                                  onClick={() => toggleUnavailableDepartment(index, department)}
                                  className={`rounded-full px-2 py-1 text-xs ${
                                    active
                                      ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100'
                                      : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200'
                                  }`}
                                >
                                  {department}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-300">
                    <span>対象隊員</span>
                    <span>{selectedMemberIds.size}名</span>
                  </div>
                  <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                    {members.map((member) => (
                      <label key={member.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                        <input
                          type="checkbox"
                          checked={selectedMemberIds.has(member.id)}
                          onChange={() => toggleMember(member.id)}
                        />
                        <span>{member.name}</span>
                        {member.department && <span className="text-xs text-gray-500">{member.department}</span>}
                      </label>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={createPoll}
                  disabled={saving || !title || selectedMemberIds.size === 0}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  作成
                </button>
              </div>
            </section>
          )}

          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">調整一覧</h2>
            <div className="mt-3 space-y-2">
              {polls.length === 0 && <p className="text-sm text-gray-500">まだ調整がありません。</p>}
              {polls.map((poll) => (
                <button
                  key={poll.id}
                  type="button"
                  onClick={() => setSelectedId(poll.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    selectedPoll?.id === poll.id
                      ? 'border-primary bg-blue-50 dark:bg-blue-950'
                      : 'border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="font-medium text-gray-900 dark:text-gray-100">{poll.title}</div>
                  <div className="mt-1 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{statusLabel(poll.status)}</span>
                    <span>
                      {poll.responseSummary?.respondedParticipants || 0}/{poll.responseSummary?.totalParticipants || 0}名
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        </aside>

        <main className="space-y-4">
          {!selectedPoll ? (
            <div className="rounded-lg border border-gray-200 bg-white p-8 text-center text-gray-500 dark:border-gray-700 dark:bg-gray-800">
              調整を選択してください。
            </div>
          ) : (
            <>
              <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                      <CalendarCheck className="h-4 w-4" />
                      {selectedPoll.month}
                    </div>
                    <h2 className="mt-1 text-xl font-bold text-gray-900 dark:text-gray-100">{selectedPoll.title}</h2>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {selectedPoll.startTime}〜{selectedPoll.endTime} / {statusLabel(selectedPoll.status)}
                    </p>
                  </div>
                  {isStaff && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={propose}
                        disabled={saving || selectedPoll.status === 'CONFIRMED'}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700"
                      >
                        <Users className="h-4 w-4" />
                        暫定案を作成
                      </button>
                      <button
                        type="button"
                        onClick={confirm}
                        disabled={saving || selectedPoll.status === 'CONFIRMED' || selectedPoll.assignments.length === 0}
                        className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" />
                        確定して反映
                      </button>
                    </div>
                  )}
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
                    <div className="text-xs text-gray-500">対象隊員</div>
                    <div className="mt-1 text-lg font-semibold">{selectedPoll.participants.length}名</div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
                    <div className="text-xs text-gray-500">回答済み</div>
                    <div className="mt-1 text-lg font-semibold">
                      {selectedPoll.responseSummary?.respondedParticipants || 0}名
                    </div>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
                    <div className="text-xs text-gray-500">割当済み</div>
                    <div className="mt-1 text-lg font-semibold">{selectedPoll.assignments.length}名</div>
                  </div>
                </div>
              </section>

              {!isStaff && (
                <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">候補日の回答</h3>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedPoll.dates.map((d) => {
                      const value = draftAvailability[d.id] || 'NG';
                      const blocked = user?.department && d.unavailableDepartments.includes(user.department);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          disabled={selectedPoll.status === 'CONFIRMED' || !!blocked}
                          onClick={() =>
                            setDraftAvailability((prev) => ({
                              ...prev,
                              [d.id]: value === 'OK' ? 'NG' : 'OK',
                            }))
                          }
                          className={`flex items-center justify-between rounded-lg border px-3 py-3 text-left ${
                            value === 'OK' && !blocked
                              ? 'border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-100'
                              : 'border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'
                          } disabled:opacity-60`}
                        >
                          <span className="font-medium">{dateLabel(d.date)}</span>
                          {blocked ? <X className="h-4 w-4 text-red-500" /> : value === 'OK' ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={saveAvailability}
                    disabled={saving || selectedPoll.status === 'CONFIRMED'}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    回答を保存
                  </button>
                </section>
              )}

              {isStaff && (
                <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">回答状況</h3>
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left dark:border-gray-700">
                          <th className="sticky left-0 bg-white px-3 py-2 dark:bg-gray-800">隊員</th>
                          {selectedPoll.dates.map((d) => (
                            <th key={d.id} className="px-3 py-2 text-center font-medium">
                              {dateLabel(d.date)}
                              <div className="text-xs font-normal text-gray-500">定員{d.capacity}</div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPoll.participants.map((p) => (
                          <tr key={p.id} className="border-b border-gray-100 dark:border-gray-700">
                            <td className="sticky left-0 bg-white px-3 py-2 dark:bg-gray-800">
                              <div className="font-medium">{p.member.name}</div>
                              <div className="text-xs text-gray-500">{p.member.department || '課未設定'}</div>
                            </td>
                            {selectedPoll.dates.map((d) => {
                              const unavailableByDept =
                                !!p.member.department && d.unavailableDepartments.includes(p.member.department);
                              const answered = selectedPoll.availability.find(
                                (a) => a.memberId === p.memberId && a.dateId === d.id,
                              );
                              const responded = responsesByMember.get(p.memberId)?.has(d.id);
                              return (
                                <td key={d.id} className="px-3 py-2 text-center">
                                  {unavailableByDept ? (
                                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100">
                                      <X className="h-4 w-4" />
                                    </span>
                                  ) : answered?.status === 'OK' ? (
                                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100">
                                      <Check className="h-4 w-4" />
                                    </span>
                                  ) : responded ? (
                                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-700">
                                      <X className="h-4 w-4" />
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">暫定日割り</h3>
                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  {selectedPoll.dates.map((d) => {
                    const rows = assignmentsByDate.get(d.id) || [];
                    return (
                      <div key={d.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-gray-900 dark:text-gray-100">{dateLabel(d.date)}</div>
                          <div className="text-xs text-gray-500">
                            {rows.length}/{d.capacity}
                          </div>
                        </div>
                        <div className="mt-3 space-y-2">
                          {rows.length === 0 && <div className="text-sm text-gray-400">未割当</div>}
                          {rows.map((a) => (
                            <div key={a.id} className="rounded-md bg-gray-50 px-3 py-2 text-sm dark:bg-gray-900">
                              <span className="font-medium">{a.slotOrder}. {a.member?.name}</span>
                              {a.scheduleId && <span className="ml-2 text-xs text-green-600">反映済み</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
};
