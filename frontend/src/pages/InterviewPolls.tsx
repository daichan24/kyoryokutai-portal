import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import {
  AlertTriangle,
  CalendarCheck,
  Check,
  ChevronDown,
  ChevronUp,
  Circle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import type { InterviewAvailabilityStatus, InterviewPoll, InterviewPollAssignment, User } from '../types';
import { sortUsersByDisplayOrder } from '../utils/userSort';
import {
  canMemberEditInterviewAvailability,
  nextStaffInterviewAvailabilityStatus,
} from '../utils/interviewAvailability';

const staffRoles = ['MASTER', 'SUPPORT', 'GOVERNMENT'];
const DEFAULT_CANDIDATE_DATE_COUNT = 3;

type DateRow = {
  id: string;
  date: string;
  capacity: number;
  unavailableDepartments: string[];
};

let candidateDateRowId = 0;

function nextCandidateDateRowId() {
  candidateDateRowId += 1;
  return `candidate-date-${candidateDateRowId}`;
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthDate(month: string, day: number) {
  const [year, rawMonth] = month.split('-').map(Number);
  return `${year}-${String(rawMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function createDateRow(month: string, day: number): DateRow {
  return {
    id: nextCandidateDateRowId(),
    date: monthDate(month, day),
    capacity: 4,
    unavailableDepartments: [],
  };
}

function defaultDateRows(month: string) {
  return Array.from({ length: DEFAULT_CANDIDATE_DATE_COUNT }, (_, index) => createDateRow(month, index + 1));
}

function appendDateRow(rows: DateRow[], month: string) {
  const [year, rawMonth] = month.split('-').map(Number);
  const lastDayOfMonth = new Date(year, rawMonth, 0).getDate();
  const usedDays = rows
    .map((row) => {
      const [rowYear, rowMonth, rowDay] = row.date.split('-').map(Number);
      return rowYear === year && rowMonth === rawMonth ? rowDay : null;
    })
    .filter((day): day is number => day !== null);
  const nextDay = Math.min((usedDays.length ? Math.max(...usedDays) : 0) + 1, lastDayOfMonth);
  return [...rows, createDateRow(month, nextDay)];
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
  const [dateRows, setDateRows] = useState(() => defaultDateRows(currentMonth()));
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [draftAvailability, setDraftAvailability] = useState<Record<string, InterviewAvailabilityStatus>>({});
  const [editingDepartments, setEditingDepartments] = useState(false);
  const [departmentDrafts, setDepartmentDrafts] = useState<Record<string, string>>({});
  const [deletedDepartments, setDeletedDepartments] = useState<Set<string>>(new Set());
  const [editingPoll, setEditingPoll] = useState(false);
  const [editMonth, setEditMonth] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editStartTime, setEditStartTime] = useState('09:00');
  const [editEndTime, setEditEndTime] = useState('17:00');
  const [editDateRows, setEditDateRows] = useState<DateRow[]>([]);
  const [editMemberIds, setEditMemberIds] = useState<Set<string>>(new Set());

  const selectedPoll = useMemo(
    () => polls.find((poll) => poll.id === selectedId) || polls[0] || null,
    [polls, selectedId],
  );
  const memberCanEditAvailability = selectedPoll
    ? canMemberEditInterviewAvailability(selectedPoll.status)
    : false;

  const departments = useMemo(
    () => [...new Set(members.map((m) => (m.department || '').trim()).filter(Boolean))].sort(),
    [members],
  );

  const assignmentsByDate = useMemo(() => {
    const map = new Map<string, InterviewPollAssignment[]>();
    for (const assignment of selectedPoll?.assignments || []) {
      const items = map.get(assignment.dateId) || [];
      items.push(assignment);
      map.set(assignment.dateId, items);
    }
    for (const assignments of map.values()) {
      assignments.sort((a, b) => a.slotOrder - b.slotOrder);
    }
    return map;
  }, [selectedPoll]);

  const assignmentByMember = useMemo(
    () => new Map((selectedPoll?.assignments || []).map((assignment) => [assignment.memberId, assignment])),
    [selectedPoll],
  );

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
  }, []);

  useEffect(() => {
    if (!selectedPoll || !user) return;
    const mine = selectedPoll.myAvailability || selectedPoll.availability.filter((a) => a.memberId === user.id);
    setDraftAvailability(Object.fromEntries(mine.map((a) => [a.dateId, a.status])));
  }, [selectedPoll, user]);

  const updateMonth = (nextMonth: string) => {
    setMonth(nextMonth);
    setTitle(`${nextMonth} 月次面談`);
    setDateRows(defaultDateRows(nextMonth));
  };

  const addDateRow = () => {
    setDateRows((prev) => appendDateRow(prev, month));
  };

  const removeDateRow = (rowId: string) => {
    setDateRows((prev) => (prev.length <= 1 ? prev : prev.filter((row) => row.id !== rowId)));
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
        dates: dateRows.map(({ date, capacity, unavailableDepartments }) => ({
          date,
          capacity,
          unavailableDepartments,
        })),
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

  const openPollEditor = () => {
    if (!selectedPoll) return;
    setEditMonth(selectedPoll.month);
    setEditTitle(selectedPoll.title);
    setEditStartTime(selectedPoll.startTime);
    setEditEndTime(selectedPoll.endTime);
    setEditDateRows(
      selectedPoll.dates.map((date) => ({
        id: date.id,
        date: date.date,
        capacity: date.capacity,
        unavailableDepartments: [...date.unavailableDepartments],
      })),
    );
    setEditMemberIds(new Set(selectedPoll.participants.map((participant) => participant.memberId)));
    setEditingPoll(true);
  };

  const savePollEdits = async () => {
    if (!selectedPoll || !editTitle.trim() || editDateRows.length === 0 || editMemberIds.size === 0) return;
    if (new Set(editDateRows.map((row) => row.date)).size !== editDateRows.length) {
      setError('同じ候補日を複数登録することはできません');
      return;
    }
    const resetConfirmed = selectedPoll.status === 'CONFIRMED';
    if (
      resetConfirmed
      && !window.confirm(
        '確定済みの面談を編集すると、反映済みスケジュールを取り消して回答受付中へ戻します。続けますか？',
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await api.put<InterviewPoll>(`/api/interview-polls/${selectedPoll.id}`, {
        title: editTitle.trim(),
        month: editMonth,
        startTime: editStartTime,
        endTime: editEndTime,
        dates: editDateRows.map(({ date, capacity, unavailableDepartments }) => ({
          date,
          capacity,
          unavailableDepartments,
        })),
        memberIds: [...editMemberIds],
        resetConfirmed,
      });
      setPolls((prev) => prev.map((poll) => (poll.id === res.data.id ? res.data : poll)));
      setEditingPoll(false);
    } catch (err) {
      setError(getErrorMessage(err, '面談日程調整を編集できませんでした'));
    } finally {
      setSaving(false);
    }
  };

  const deletePoll = async () => {
    if (!selectedPoll) return;
    const deleteConfirmed = selectedPoll.status === 'CONFIRMED';
    const message = deleteConfirmed
      ? 'この面談調整と、確定時に反映したスケジュールを取り消します。削除してよろしいですか？'
      : 'この面談調整を削除します。回答内容と暫定日割りも削除されます。よろしいですか？';
    if (!window.confirm(message)) return;

    setSaving(true);
    setError(null);
    try {
      await api.delete(`/api/interview-polls/${selectedPoll.id}`, { data: { deleteConfirmed } });
      const remainingPolls = polls.filter((poll) => poll.id !== selectedPoll.id);
      setPolls(remainingPolls);
      setSelectedId(remainingPolls[0]?.id || null);
      setEditingPoll(false);
    } catch (err) {
      setError(getErrorMessage(err, '面談日程調整を削除できませんでした'));
    } finally {
      setSaving(false);
    }
  };

  const forceAvailability = async (memberId: string, dateId: string) => {
    if (!selectedPoll || !isStaff) return;
    const current = selectedPoll.availability.find(
      (availability) => availability.memberId === memberId && availability.dateId === dateId,
    )?.status;
    const nextStatus = nextStaffInterviewAvailabilityStatus(current);
    const resetConfirmed = selectedPoll.status === 'CONFIRMED';
    if (
      resetConfirmed
      && !window.confirm(
        '確定済みの回答を変更すると、反映済みスケジュールを取り消して再調整状態へ戻します。続けますか？',
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await api.put<InterviewPoll>(`/api/interview-polls/${selectedPoll.id}/availability`, {
        memberId,
        resetConfirmed,
        availability: [{ dateId, status: nextStatus }],
      });
      setPolls((prev) => prev.map((poll) => (poll.id === res.data.id ? res.data : poll)));
    } catch (err) {
      setError(getErrorMessage(err, '回答内容を変更できませんでした'));
    } finally {
      setSaving(false);
    }
  };

  const moveAssignment = async (dateId: string, assignmentId: string, direction: -1 | 1) => {
    if (!selectedPoll || !isStaff) return;
    const assignments = [...(assignmentsByDate.get(dateId) || [])].sort((a, b) => a.slotOrder - b.slotOrder);
    const currentIndex = assignments.findIndex((assignment) => assignment.id === assignmentId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= assignments.length) return;

    const reordered = [...assignments];
    [reordered[currentIndex], reordered[nextIndex]] = [reordered[nextIndex], reordered[currentIndex]];

    setSaving(true);
    setError(null);
    try {
      const res = await api.put<InterviewPoll>(`/api/interview-polls/${selectedPoll.id}/assignments/order`, {
        dateId,
        assignmentIds: reordered.map((assignment) => assignment.id),
      });
      setPolls((prev) => prev.map((poll) => (poll.id === res.data.id ? res.data : poll)));
    } catch (err) {
      setError(getErrorMessage(err, '面談順を変更できませんでした'));
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

  const toggleEditUnavailableDepartment = (index: number, department: string) => {
    setEditDateRows((prev) =>
      prev.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const unavailableDepartments = new Set(row.unavailableDepartments);
        if (unavailableDepartments.has(department)) unavailableDepartments.delete(department);
        else unavailableDepartments.add(department);
        return { ...row, unavailableDepartments: [...unavailableDepartments] };
      }),
    );
  };

  const openDepartmentEditor = () => {
    setDepartmentDrafts(Object.fromEntries(departments.map((department) => [department, department])));
    setDeletedDepartments(new Set());
    setEditingDepartments(true);
  };

  const saveDepartments = async () => {
    const remainingDepartments = departments.filter((department) => !deletedDepartments.has(department));
    const draftNames = remainingDepartments.map((department) => (departmentDrafts[department] || '').trim());
    if (draftNames.some((name) => !name)) {
      setError('課・係名を空欄にはできません');
      return;
    }
    if (new Set(draftNames).size !== draftNames.length) {
      setError('同じ課・係名を複数設定することはできません');
      return;
    }

    const renames = remainingDepartments
      .map((oldName) => ({ oldName, newName: (departmentDrafts[oldName] || '').trim() }))
      .filter(({ oldName, newName }) => oldName !== newName);
    const deletions = [...deletedDepartments];
    if (renames.length === 0 && deletions.length === 0) {
      setEditingDepartments(false);
      return;
    }
    if (
      deletions.length > 0
      && !window.confirm(
        `「${deletions.join('」「')}」を削除します。該当する隊員の所属は未設定になり、既存候補日の課・係NG設定からも削除されます。よろしいですか？`,
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.put('/api/interview-polls/departments', { renames, deletions });
      const renameMap = new Map(renames.map(({ oldName, newName }) => [oldName, newName]));
      const renameValue = (value?: string | null) => {
        if (!value) return value;
        if (deletedDepartments.has(value.trim())) return undefined;
        return renameMap.get(value.trim()) ?? value;
      };
      const renameList = (values: string[]) =>
        [...new Set(values.map((value) => renameValue(value)).filter((value): value is string => !!value))];

      setMembers((prev) => prev.map((member) => ({ ...member, department: renameValue(member.department) || undefined })));
      setDateRows((prev) =>
        prev.map((row) => ({ ...row, unavailableDepartments: renameList(row.unavailableDepartments) })),
      );
      setPolls((prev) =>
        prev.map((poll) => ({
          ...poll,
          dates: poll.dates.map((date) => ({
            ...date,
            unavailableDepartments: renameList(date.unavailableDepartments),
          })),
          participants: poll.participants.map((participant) => ({
            ...participant,
            member: {
              ...participant.member,
              department: renameValue(participant.member.department) || undefined,
            },
          })),
          assignments: poll.assignments.map((assignment) => ({
            ...assignment,
            member: assignment.member
              ? { ...assignment.member, department: renameValue(assignment.member.department) || undefined }
              : assignment.member,
          })),
        })),
      );
      setEditingDepartments(false);
      setDeletedDepartments(new Set());
    } catch (err) {
      setError(getErrorMessage(err, '課・係を変更できませんでした'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-gray-600 dark:text-gray-300">読み込み中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
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
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">候補日・定員・上長NG課</div>
                    <div className="flex items-center gap-1">
                      {departments.length > 0 && (
                        <button
                          type="button"
                          onClick={openDepartmentEditor}
                          className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          課・係を編集
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={addDateRow}
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        追加
                      </button>
                    </div>
                  </div>
                  {editingDepartments && (
                    <div className="mb-3 space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
                      <p className="text-xs text-blue-800 dark:text-blue-200">
                        名称変更は隊員の所属と既存候補日のNG設定にも反映されます。削除すると、該当する隊員の所属は未設定になります。
                      </p>
                      {departments.map((department) => {
                        const isDeleted = deletedDepartments.has(department);
                        return (
                          <div
                            key={department}
                            className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2 text-xs"
                          >
                            <span
                              className={`truncate ${
                                isDeleted
                                  ? 'text-red-600 line-through dark:text-red-300'
                                  : 'text-gray-500 dark:text-gray-400'
                              }`}
                            >
                              {department}
                            </span>
                            <span aria-hidden="true">→</span>
                            {isDeleted ? (
                              <span className="text-sm font-medium text-red-600 dark:text-red-300">削除予定</span>
                            ) : (
                              <input
                                value={departmentDrafts[department] || ''}
                                onChange={(e) =>
                                  setDepartmentDrafts((prev) => ({ ...prev, [department]: e.target.value }))
                                }
                                maxLength={100}
                                aria-label={`${department}の新しい課・係名`}
                                className="min-w-0 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-900"
                              />
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setDeletedDepartments((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(department)) next.delete(department);
                                  else next.add(department);
                                  return next;
                                })
                              }
                              disabled={saving}
                              aria-label={isDeleted ? `${department}の削除を取り消す` : `${department}を削除`}
                              className={`inline-flex h-8 items-center justify-center gap-1 rounded-md border px-2 ${
                                isDeleted
                                  ? 'border-gray-300 text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200'
                                  : 'border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-300'
                              } disabled:opacity-50`}
                            >
                              {isDeleted ? (
                                <>
                                  <RefreshCw className="h-3.5 w-3.5" />
                                  元に戻す
                                </>
                              ) : (
                                <>
                                  <Trash2 className="h-3.5 w-3.5" />
                                  削除
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDepartments(false);
                            setDeletedDepartments(new Set());
                          }}
                          disabled={saving}
                          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:opacity-50 dark:border-gray-600 dark:text-gray-200"
                        >
                          キャンセル
                        </button>
                        <button
                          type="button"
                          onClick={saveDepartments}
                          disabled={saving}
                          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                        >
                          {saving ? '保存中...' : '課・係を保存'}
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {dateRows.map((row, index) => (
                      <div key={row.id} className="rounded-lg border border-gray-200 p-2 dark:border-gray-700">
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
                          <button
                            type="button"
                            onClick={() => removeDateRow(row.id)}
                            disabled={dateRows.length <= 1}
                            aria-label="候補日を削除"
                            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-300 text-gray-500 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                          >
                            <X className="h-4 w-4" />
                          </button>
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
                                  aria-pressed={active}
                                  title={active ? `${department}をNGから戻す` : `${department}をNGにする`}
                                  className={`rounded-full px-2 py-1 text-xs ${
                                    active
                                      ? 'bg-red-100 text-red-700 line-through decoration-2 dark:bg-red-900 dark:text-red-100'
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
                  onClick={() => {
                    setSelectedId(poll.id);
                    setEditingPoll(false);
                  }}
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
                        onClick={openPollEditor}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-700"
                      >
                        <Pencil className="h-4 w-4" />
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={deletePoll}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-200 dark:hover:bg-red-950"
                      >
                        <Trash2 className="h-4 w-4" />
                        削除
                      </button>
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

                {editingPoll && (
                  <div className="mt-5 space-y-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="font-semibold text-blue-950 dark:text-blue-100">面談調整を編集</h3>
                      <span className="text-xs text-blue-700 dark:text-blue-300">行政・サポート・マスター共通</span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        対象月
                        <input
                          type="month"
                          value={editMonth}
                          onChange={(event) => setEditMonth(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                        />
                      </label>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        タイトル
                        <input
                          value={editTitle}
                          onChange={(event) => setEditTitle(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                        />
                      </label>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        開始
                        <input
                          type="time"
                          value={editStartTime}
                          onChange={(event) => setEditStartTime(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                        />
                      </label>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        終了
                        <input
                          type="time"
                          value={editEndTime}
                          onChange={(event) => setEditEndTime(event.target.value)}
                          className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-900"
                        />
                      </label>
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-200">候補日・定員・課NG</span>
                        <button
                          type="button"
                          onClick={() => setEditDateRows((prev) => appendDateRow(prev, editMonth))}
                          className="inline-flex items-center gap-1 rounded-md border border-blue-300 px-2 py-1 text-xs font-medium text-blue-800 dark:border-blue-700 dark:text-blue-200"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          候補日を追加
                        </button>
                      </div>
                      <div className="space-y-2">
                        {editDateRows.map((row, index) => (
                          <div key={row.id} className="rounded-lg border border-blue-200 bg-white p-3 dark:border-blue-800 dark:bg-gray-900">
                            <div className="flex items-center gap-2">
                              <input
                                type="date"
                                value={row.date}
                                onChange={(event) =>
                                  setEditDateRows((prev) =>
                                    prev.map((dateRow, rowIndex) =>
                                      rowIndex === index ? { ...dateRow, date: event.target.value } : dateRow,
                                    ),
                                  )
                                }
                                className="min-w-0 flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-950"
                              />
                              <input
                                type="number"
                                min={1}
                                max={20}
                                value={row.capacity}
                                onChange={(event) =>
                                  setEditDateRows((prev) =>
                                    prev.map((dateRow, rowIndex) =>
                                      rowIndex === index
                                        ? { ...dateRow, capacity: Number(event.target.value) }
                                        : dateRow,
                                    ),
                                  )
                                }
                                aria-label={`${row.date}の定員`}
                                className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-950"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setEditDateRows((prev) =>
                                    prev.length <= 1 ? prev : prev.filter((dateRow) => dateRow.id !== row.id),
                                  )
                                }
                                disabled={editDateRows.length <= 1}
                                aria-label={`${row.date}を削除`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-gray-300 text-gray-500 disabled:opacity-40 dark:border-gray-600"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                            {departments.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {departments.map((department) => {
                                  const active = row.unavailableDepartments.includes(department);
                                  return (
                                    <button
                                      key={department}
                                      type="button"
                                      onClick={() => toggleEditUnavailableDepartment(index, department)}
                                      aria-pressed={active}
                                      className={`rounded-full px-2 py-1 text-xs ${
                                        active
                                          ? 'bg-red-100 text-red-700 line-through decoration-2 dark:bg-red-900 dark:text-red-100'
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
                      <div className="mb-2 flex items-center justify-between text-sm font-medium text-gray-700 dark:text-gray-200">
                        <span>対象隊員</span>
                        <span>{editMemberIds.size}名</span>
                      </div>
                      <div className="grid max-h-48 gap-1 overflow-y-auto rounded-lg border border-blue-200 bg-white p-2 sm:grid-cols-2 dark:border-blue-800 dark:bg-gray-900">
                        {members.map((member) => (
                          <label key={member.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                            <input
                              type="checkbox"
                              checked={editMemberIds.has(member.id)}
                              onChange={() =>
                                setEditMemberIds((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(member.id)) next.delete(member.id);
                                  else next.add(member.id);
                                  return next;
                                })
                              }
                            />
                            <span>{member.name}</span>
                            {member.department && <span className="text-xs text-gray-500">{member.department}</span>}
                          </label>
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-blue-800 dark:text-blue-200">
                      保存すると古い暫定日割りは破棄され、回答受付中へ戻ります。同じ候補日の本人回答は保持されます。
                    </p>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingPoll(false)}
                        disabled={saving}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-gray-600"
                      >
                        キャンセル
                      </button>
                      <button
                        type="button"
                        onClick={savePollEdits}
                        disabled={saving || !editTitle.trim() || editDateRows.length === 0 || editMemberIds.size === 0}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {saving ? '保存中...' : '変更を保存'}
                      </button>
                    </div>
                  </div>
                )}

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
                {selectedPoll.assignments.length > 0 && selectedPoll.assignmentConsistency && (
                  selectedPoll.assignmentConsistency.consistent ? (
                    <div className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
                      本人回答・課NG・現在の割当に不整合はありません。
                    </div>
                  ) : (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <div>
                        <div className="font-semibold">
                          回答内容と割当に{selectedPoll.assignmentConsistency.issues.length}件の不整合があります
                        </div>
                        <div className="mt-1 text-xs">回答を確認して「暫定案を作成」を押し、割当を再計算してください。</div>
                      </div>
                    </div>
                  )
                )}
              </section>

              {!isStaff && (
                <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                  <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">候補日の回答</h3>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                    定員や暫定日割りに関係なく、確定されるまでは希望日を変更できます。
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {selectedPoll.dates.map((d) => {
                      const value = draftAvailability[d.id] || 'NG';
                      const hasDepartmentConflict =
                        !!user?.department && d.unavailableDepartments.includes(user.department);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          disabled={!memberCanEditAvailability}
                          onClick={() =>
                            setDraftAvailability((prev) => ({
                              ...prev,
                              [d.id]: value === 'OK' ? 'NG' : 'OK',
                            }))
                          }
                          className={`flex items-center justify-between rounded-lg border px-3 py-3 text-left ${
                            value === 'OK'
                              ? 'border-green-300 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-100'
                              : 'border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200'
                          } disabled:opacity-60`}
                        >
                          <span>
                            <span className="block font-medium">{dateLabel(d.date)}</span>
                            {hasDepartmentConflict && (
                              <span className="mt-1 block text-xs text-amber-700 dark:text-amber-300">
                                管理側の課・係NGあり（希望回答は可能）
                              </span>
                            )}
                          </span>
                          {value === 'OK' ? <Check className="h-4 w-4 shrink-0" /> : <Circle className="h-4 w-4 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={saveAvailability}
                    disabled={saving || !memberCanEditAvailability}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    回答を保存
                  </button>
                  {!memberCanEditAvailability && (
                    <p className="mt-2 text-xs font-medium text-gray-500 dark:text-gray-400">
                      この日程調整は確定または取消済みのため、回答を変更できません。
                    </p>
                  )}
                </section>
              )}

              {isStaff && (
                <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">回答状況</h3>
                      <p className="mt-1 text-xs text-gray-500">
                        本人回答と課NGを分けて表示しています。日付セルを押すと、本人の回答後でも「ON（参加可能）/OFF（不可）」を強制変更できます。変更後は古い暫定日割りが破棄されるため、再度「暫定案を作成」してください。
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1 text-[11px]">
                      <span className="rounded bg-green-100 px-2 py-1 text-green-700">ON（本人○）</span>
                      <span className="rounded bg-gray-100 px-2 py-1 text-gray-600">OFF（本人×）</span>
                      <span className="rounded bg-red-100 px-2 py-1 text-red-700">課NG</span>
                      <span className="rounded bg-blue-100 px-2 py-1 text-blue-700">割当</span>
                    </div>
                  </div>
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
                              const assignment = assignmentByMember.get(p.memberId);
                              const assignedHere = assignment?.dateId === d.id;
                              const inconsistentAssignment =
                                assignedHere && (answered?.status !== 'OK' || unavailableByDept);
                              return (
                                <td key={d.id} className="px-3 py-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => forceAvailability(p.memberId, d.id)}
                                    disabled={saving}
                                    title={`${p.member.name}の${dateLabel(d.date)}の本人回答を変更`}
                                    className={`mx-auto flex min-w-16 flex-col items-center gap-1 rounded-lg border px-2 py-1.5 disabled:opacity-50 ${
                                      inconsistentAssignment
                                        ? 'border-red-400 bg-red-50 dark:border-red-700 dark:bg-red-950'
                                        : assignedHere
                                          ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-950'
                                          : 'border-transparent hover:border-gray-300 hover:bg-gray-50 dark:hover:border-gray-600 dark:hover:bg-gray-900'
                                    }`}
                                  >
                                    {answered?.status === 'OK' ? (
                                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-300">
                                        <Check className="h-4 w-4" />
                                        ON（本人○）
                                      </span>
                                    ) : answered?.status === 'NG' ? (
                                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                                        <X className="h-4 w-4" />
                                        OFF（本人×）
                                      </span>
                                    ) : (
                                      <span className="text-xs text-gray-400">未回答（押すとON）</span>
                                    )}
                                    <span className="flex flex-wrap justify-center gap-1">
                                      {unavailableByDept && (
                                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900 dark:text-red-200">
                                          課NG
                                        </span>
                                      )}
                                      {assignedHere && (
                                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                          inconsistentAssignment
                                            ? 'bg-red-600 text-white'
                                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200'
                                        }`}>
                                          {inconsistentAssignment ? '割当不整合' : '割当'}
                                        </span>
                                      )}
                                    </span>
                                  </button>
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
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">暫定日割り</h3>
                    {isStaff && (
                      <p className="mt-1 text-xs text-gray-500">各日付の上下ボタンで、面談の順番を変更できます。</p>
                    )}
                  </div>
                </div>
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
                          {rows.map((a, index) => (
                            <div
                              key={a.id}
                              className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm dark:bg-gray-900"
                            >
                              <div className="min-w-0">
                                <span className="font-medium">{a.slotOrder}. {a.member?.name}</span>
                                {a.scheduleId && <span className="ml-2 text-xs text-green-600">反映済み</span>}
                              </div>
                              {isStaff && rows.length > 1 && selectedPoll.status !== 'CANCELLED' && (
                                <div className="flex shrink-0 gap-1">
                                  <button
                                    type="button"
                                    onClick={() => moveAssignment(d.id, a.id, -1)}
                                    disabled={saving || index === 0}
                                    title={`${a.member?.name || '面談'}を上へ移動`}
                                    aria-label={`${a.member?.name || '面談'}を上へ移動`}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-white disabled:cursor-not-allowed disabled:opacity-30 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                                  >
                                    <ChevronUp className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => moveAssignment(d.id, a.id, 1)}
                                    disabled={saving || index === rows.length - 1}
                                    title={`${a.member?.name || '面談'}を下へ移動`}
                                    aria-label={`${a.member?.name || '面談'}を下へ移動`}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-white disabled:cursor-not-allowed disabled:opacity-30 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                                  >
                                    <ChevronDown className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
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
