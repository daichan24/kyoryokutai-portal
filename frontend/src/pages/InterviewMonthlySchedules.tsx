import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addMonths, format, subMonths } from 'date-fns';
import { ja } from 'date-fns/locale';
import { api } from '../utils/api';
import { formatWeekLabel } from '../utils/date';
import type { User } from '../types';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EnhancedInterviewCalendar } from '../components/interview/EnhancedInterviewCalendar';
import { ActivityExpensesByProject } from '../components/interview/ActivityExpensesByProject';
import { sortUsersByDisplayOrder } from '../utils/userSort';

interface InterviewParticipantUser {
  id: string;
  name: string;
  avatarColor: string;
  role: string;
}

interface InterviewSchedule {
  id: string;
  startDate: string;
  endDate: string;
  date: string;
  startTime: string;
  endTime: string;
  shortTitle: string | null;
  activityDescription: string;
  freeNote: string | null;
  locationText: string | null;
  location: { id: string; name: string } | null;
  project: { id: string; projectName: string; themeColor: string | null } | null;
  scheduleParticipants: Array<{
    userId: string;
    user: InterviewParticipantUser;
  }>;
  legacyParticipantUsers: InterviewParticipantUser[];
}

interface InterviewWeeklyReport {
  id: string;
  week: string;
  nextWeekPlan: string | null;
  note: string | null;
  thisWeekActivities: unknown;
  submittedAt: string | null;
}

interface MissionKpiRow {
  id: string;
  missionName: string;
  missionType: string;
  startDate: string | null;
  endDate: string | null;
  progress: number;
  goalTasks: { total: number; completed: number };
  standaloneTasks: { total: number; completed: number };
}

interface ProjectKpiRow {
  id: string;
  projectName: string;
  phase: string;
  themeColor: string | null;
  startDate: string | null;
  endDate: string | null;
  mission: { id: string; missionName: string } | null;
  progress: number;
  projectTasks: { total: number; completed: number };
  relatedTasks: { total: number; completed: number };
}

interface InterviewConsultation {
  id: string;
  audience: string;
  subject: string | null;
  body: string;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  resolutionNote: string | null;
  targetUser?: { id: string; name: string; role: string } | null;
  resolvedBy?: { id: string; name: string } | null;
}

interface ActivityExpenseSummaryLite {
  allocatedAmount: number;
  totalSpent: number;
  remaining: number;
  memo: string | null;
  budgetUpdatedAt: string | null;
  recentEntries: Array<{
    id: string;
    spentAt: string;
    description: string;
    amount: number;
    status?: 'PLANNED' | 'PENDING' | 'APPROVED' | 'REJECTED';
    project?: { id: string; projectName: string; themeColor: string | null } | null;
  }>;
}

interface InterviewMonthResponse {
  member: { id: string; name: string; avatarColor: string };
  month: string;
  range: { from: string; to: string };
  schedules: InterviewSchedule[];
  weeklyReports: InterviewWeeklyReport[];
  missionsKpi: MissionKpiRow[];
  projectsKpi: ProjectKpiRow[];
  consultations?: InterviewConsultation[];
  activityExpenseSummary?: ActivityExpenseSummaryLite;
}

interface InterviewNoteRecord {
  id: string;
  memberId: string;
  month: string;
  memo: string | null;
  snsNote: string | null;
  snsCheckedAt: string | null;
  updatedAt: string;
  updatedBy?: { id: string; name: string } | null;
}

interface InterviewSnsAccountSummary {
  id: string;
  platform: string;
  accountName: string;
  displayName: string | null;
  url: string | null;
  isDefault: boolean;
  latestFollowerCount: number | null;
  latestFollowerAt: string | null;
  monthFollowerCount: number | null;
  monthPostCount: number;
  hasStoryThisMonth: boolean;
  hasFeedThisMonth: boolean;
}

interface InterviewNoteResponse {
  note: InterviewNoteRecord | null;
  snsAccounts: InterviewSnsAccountSummary[];
}

function schedulePeople(s: InterviewSchedule): InterviewParticipantUser[] {
  const m = new Map<string, InterviewParticipantUser>();
  for (const p of s.scheduleParticipants || []) {
    if (p.user) m.set(p.user.id, p.user);
  }
  for (const u of s.legacyParticipantUsers || []) {
    m.set(u.id, u);
  }
  return [...m.values()];
}

function formatScheduleDateRange(s: InterviewSchedule): string {
  const a = new Date(s.startDate);
  const b = new Date(s.endDate);
  if (format(a, 'yyyy-MM-dd') === format(b, 'yyyy-MM-dd')) {
    return format(a, 'M月d日（EEE）', { locale: ja });
  }
  return `${format(a, 'M/d', { locale: ja })}〜${format(b, 'M/d', { locale: ja })}`;
}

function summarizeThisWeek(json: unknown): string {
  if (json == null) return '';
  if (typeof json === 'string') return json;
  if (Array.isArray(json)) {
    return json
      .map((row) => {
        if (row && typeof row === 'object' && 'activity' in row) {
          const r = row as { date?: string; activity?: string };
          return [r.date, r.activity].filter(Boolean).join(' ');
        }
        return JSON.stringify(row);
      })
      .filter(Boolean)
      .join(' / ');
  }
  return JSON.stringify(json);
}

function progressBarColor(progress: number) {
  if (progress >= 80) return 'bg-green-500';
  if (progress >= 50) return 'bg-blue-500';
  if (progress >= 25) return 'bg-yellow-500';
  return 'bg-gray-400';
}

function phaseLabelJa(phase: string): string {
  const map: Record<string, string> = {
    PREPARATION: '準備',
    EXECUTION: '実行',
    COMPLETED: '完了',
    REVIEW: '振り返り',
  };
  return map[phase] ?? phase;
}

function consultationAudienceJa(a: string): string {
  const m: Record<string, string> = {
    ANY: '誰でも',
    SUPPORT_ONLY: 'サポート宛',
    GOVERNMENT_ONLY: '行政宛',
    SPECIFIC_USER: '特定の相手',
  };
  return m[a] ?? a;
}

function formatYenInterview(n: number) {
  return `¥${n.toLocaleString('ja-JP')}`;
}

function formatFollowerCount(n: number | null) {
  return n == null ? '未記録' : n.toLocaleString('ja-JP');
}

function MissionProjectCompact({
  missions,
  projects,
}: {
  missions: MissionKpiRow[];
  projects: ProjectKpiRow[];
}) {
  const [openMissionIds, setOpenMissionIds] = useState<Set<string>>(() => new Set());
  const unlinkedProjects = projects.filter((p) => !p.mission);

  if (missions.length === 0 && projects.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">該当するミッション・プロジェクトはありません。</p>;
  }

  const toggleMission = (id: string) => {
    setOpenMissionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      {missions.map((mission) => {
        const relatedProjects = projects.filter((p) => p.mission?.id === mission.id);
        const isOpen = openMissionIds.has(mission.id);
        return (
          <div key={mission.id} className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
            <button
              type="button"
              onClick={() => toggleMission(mission.id)}
              className="w-full text-left"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{mission.missionName}</p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    タスク {mission.goalTasks.completed + mission.standaloneTasks.completed}/
                    {mission.goalTasks.total + mission.standaloneTasks.total}・プロジェクト {relatedProjects.length}件
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">{mission.progress}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div className={`h-full ${progressBarColor(mission.progress)}`} style={{ width: `${Math.min(100, mission.progress)}%` }} />
              </div>
              {relatedProjects.length > 0 && (
                <p className="mt-2 text-xs text-blue-600 dark:text-blue-300">
                  {isOpen ? 'プロジェクトを閉じる' : 'プロジェクトを開く'}
                </p>
              )}
            </button>
            {isOpen && relatedProjects.length > 0 && (
              <div className="mt-3 space-y-2 border-t border-gray-100 pt-3 dark:border-gray-700">
                {relatedProjects.map((project) => (
                  <div key={project.id} className="rounded-md bg-gray-50 p-2 dark:bg-gray-900/40">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: project.themeColor || '#6366f1' }} />
                        <span className="truncate text-xs font-medium text-gray-900 dark:text-gray-100">{project.projectName}</span>
                      </div>
                      <span className="text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-200">{project.progress}%</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-gray-500 dark:text-gray-400">
                      <span>{phaseLabelJa(project.phase)}</span>
                      <span>関連 {project.relatedTasks.completed}/{project.relatedTasks.total}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {unlinkedProjects.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          <p className="mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400">ミッション未設定のプロジェクト</p>
          <div className="space-y-2">
            {unlinkedProjects.map((project) => (
              <div key={project.id} className="flex items-center justify-between gap-2 rounded-md bg-gray-50 p-2 dark:bg-gray-900/40">
                <span className="truncate text-xs font-medium text-gray-900 dark:text-gray-100">{project.projectName}</span>
                <span className="text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-200">{project.progress}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-xs">
        <Link to="/goals" className="text-blue-600 hover:underline dark:text-blue-400">ミッションを開く</Link>
        <Link to="/projects" className="text-blue-600 hover:underline dark:text-blue-400">プロジェクトを開く</Link>
      </div>
    </div>
  );
}

function MissionProjectScheduleSection({
  missions,
  projects,
  schedules,
}: {
  missions: MissionKpiRow[];
  projects: ProjectKpiRow[];
  schedules: InterviewSchedule[];
}) {
  const projectSchedulesMap = useMemo(() => {
    const map = new Map<string, InterviewSchedule[]>();
    schedules.forEach((s) => {
      const projectId = s.project?.id;
      if (!projectId) return;
      if (!map.has(projectId)) map.set(projectId, []);
      map.get(projectId)!.push(s);
    });
    return map;
  }, [schedules]);

  const projectsByMission = useMemo(() => {
    const map = new Map<string, ProjectKpiRow[]>();
    projects.forEach((project) => {
      const key = project.mission?.id || '__none__';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(project);
    });
    return map;
  }, [projects]);

  const knownProjectIds = useMemo(() => new Set(projects.map((p) => p.id)), [projects]);
  const schedulesWithoutProject = schedules.filter((s) => !s.project);
  const schedulesWithUnknownProject = schedules.filter((s) => s.project?.id && !knownProjectIds.has(s.project.id));
  const unlinkedProjects = projectsByMission.get('__none__') || [];

  const renderProject = (project: ProjectKpiRow | { id: string; projectName: string; themeColor: string | null }) => {
    const projectSchedules = projectSchedulesMap.get(project.id) || [];
    return (
      <div key={project.id} className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        <div
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: project.themeColor || '#6366f1' }}
        >
          {project.projectName}
          <span className="text-xs font-normal opacity-90">（{projectSchedules.length} 件）</span>
        </div>
        {projectSchedules.length > 0 ? (
          <ul className="divide-y divide-gray-100 bg-white dark:divide-gray-700 dark:bg-gray-800/60">
            {projectSchedules.map((s) => (
              <li key={s.id} className="px-3 py-2 text-sm text-gray-800 dark:text-gray-200">
                <span className="mr-2 text-gray-500 dark:text-gray-400">{formatScheduleDateRange(s)}</span>
                {s.shortTitle?.trim() || s.activityDescription?.trim()?.slice(0, 80)}
                {(s.activityDescription?.length ?? 0) > 80 ? '…' : ''}
              </li>
            ))}
          </ul>
        ) : (
          <div className="bg-white px-3 py-2 text-sm italic text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
            この月は実行されませんでした
          </div>
        )}
      </div>
    );
  };

  const renderLooseScheduleGroup = (title: string, rows: InterviewSchedule[], color = '#64748b', key = title) => {
    if (rows.length === 0) return null;
    return (
      <div key={key} className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-white" style={{ backgroundColor: color }}>
          {title}
          <span className="text-xs font-normal opacity-90">（{rows.length} 件）</span>
        </div>
        <ul className="divide-y divide-gray-100 bg-white dark:divide-gray-700 dark:bg-gray-800/60">
          {rows.map((s) => (
            <li key={s.id} className="px-3 py-2 text-sm text-gray-800 dark:text-gray-200">
              <span className="mr-2 text-gray-500 dark:text-gray-400">{formatScheduleDateRange(s)}</span>
              {s.shortTitle?.trim() || s.activityDescription?.trim()?.slice(0, 80)}
              {(s.activityDescription?.length ?? 0) > 80 ? '…' : ''}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  if (missions.length === 0 && projects.length === 0 && schedules.length === 0) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">対象月の活動はありません。</p>;
  }

  return (
    <div className="space-y-4">
      {missions.map((mission) => {
        const missionProjects = projectsByMission.get(mission.id) || [];
        return (
          <div key={mission.id} className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800/80">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-2 dark:border-gray-700">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{mission.missionName}</h3>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  進捗 {mission.progress}%・プロジェクト {missionProjects.length}件
                </p>
              </div>
              <div className="h-1.5 w-32 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                <div className={`h-full ${progressBarColor(mission.progress)}`} style={{ width: `${Math.min(100, mission.progress)}%` }} />
              </div>
            </div>
            {missionProjects.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">このミッションに紐づくプロジェクトはありません。</p>
            ) : (
              <div className="space-y-3">{missionProjects.map(renderProject)}</div>
            )}
          </div>
        );
      })}

      {unlinkedProjects.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800/80">
          <h3 className="mb-3 border-b border-gray-100 pb-2 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
            ミッション未設定
          </h3>
          <div className="space-y-3">{unlinkedProjects.map(renderProject)}</div>
        </div>
      )}

      {schedulesWithUnknownProject.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800/80">
          <h3 className="mb-3 border-b border-gray-100 pb-2 text-sm font-semibold text-gray-900 dark:border-gray-700 dark:text-gray-100">
            マスタ未取得のプロジェクト
          </h3>
          <div className="space-y-3">
            {Object.values(
              schedulesWithUnknownProject.reduce<Record<string, { project: NonNullable<InterviewSchedule['project']>; rows: InterviewSchedule[] }>>((acc, s) => {
                const project = s.project!;
                if (!acc[project.id]) acc[project.id] = { project, rows: [] };
                acc[project.id].rows.push(s);
                return acc;
              }, {}),
            ).map(({ project, rows }) => renderLooseScheduleGroup(project.projectName, rows, project.themeColor || '#6366f1', project.id))}
          </div>
        </div>
      )}

      {renderLooseScheduleGroup('プロジェクト未設定', schedulesWithoutProject, '#64748b', '__no_project__')}
    </div>
  );
}

function InterviewMemoPanel({
  memberId,
  month,
  noteData,
}: {
  memberId: string;
  month: string;
  noteData?: InterviewNoteResponse;
}) {
  const queryClient = useQueryClient();
  const [memo, setMemo] = useState('');
  const [snsNote, setSnsNote] = useState('');
  const [snsChecked, setSnsChecked] = useState(false);

  React.useEffect(() => {
    setMemo(noteData?.note?.memo || '');
    setSnsNote(noteData?.note?.snsNote || '');
    setSnsChecked(Boolean(noteData?.note?.snsCheckedAt));
  }, [noteData?.note?.id, noteData?.note?.memo, noteData?.note?.snsNote, noteData?.note?.snsCheckedAt]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await api.put('/api/interview-notes', {
        memberId,
        month,
        memo,
        snsNote,
        snsChecked,
        snsSnapshot: noteData?.snsAccounts || [],
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interview-note', memberId, month] });
    },
  });

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-gray-200 pb-2 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">面談メモ</h3>
        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
        >
          {saveMutation.isPending ? '保存中' : '保存'}
        </button>
      </div>
      <textarea
        value={memo}
        onChange={(e) => setMemo(e.target.value)}
        rows={8}
        className="w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
        placeholder="面談しながら確認事項、決定事項、次回までの宿題を記録"
      />

      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">SNS人数確認</h4>
          <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={snsChecked} onChange={(e) => setSnsChecked(e.target.checked)} />
            確認済み
          </label>
        </div>
        {(noteData?.snsAccounts || []).length === 0 ? (
          <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-200">
            SNSアカウントが見つかりません。
          </p>
        ) : (
          <div className="space-y-2">
            {(noteData?.snsAccounts || []).map((account) => (
              <div key={account.id} className="rounded-md border border-gray-200 p-2 dark:border-gray-700">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-gray-900 dark:text-gray-100">
                      {account.displayName || account.accountName}
                      {account.isDefault && <span className="ml-1 text-[10px] text-blue-600 dark:text-blue-300">標準</span>}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">{account.platform} · {account.accountName}</p>
                  </div>
                  <span className="shrink-0 text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
                    {formatFollowerCount(account.monthFollowerCount ?? account.latestFollowerCount)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                  <span className={`rounded px-1.5 py-0.5 ${account.hasStoryThisMonth ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>
                    {account.hasStoryThisMonth ? 'ストーリーズあり' : 'ストーリーズ未記録'}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 ${account.hasFeedThisMonth ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>
                    {account.hasFeedThisMonth ? 'フィードあり' : 'フィード未記録'}
                  </span>
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-500 dark:bg-gray-700 dark:text-gray-300">
                    月内 {account.monthPostCount}件
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        <textarea
          value={snsNote}
          onChange={(e) => setSnsNote(e.target.value)}
          rows={3}
          className="w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
          placeholder="SNS人数や投稿状況についての補足"
        />
        {noteData?.note?.updatedAt && (
          <p className="text-[11px] text-gray-400">
            最終保存 {format(new Date(noteData.note.updatedAt), 'M/d HH:mm', { locale: ja })}
            {noteData.note.updatedBy && ` · ${noteData.note.updatedBy.name}`}
          </p>
        )}
      </div>
    </div>
  );
}

export const InterviewMonthlySchedules: React.FC = () => {
  /** デフォルトは今日の月 */
  const defaultMonth = format(new Date(), 'yyyy-MM');

  const [memberId, setMemberId] = useState<string>('');
  const [month, setMonth] = useState<string>(defaultMonth);

  const { data: members = [], isLoading: membersLoading } = useQuery<User[]>({
    queryKey: ['interview-monthly', 'members'],
    queryFn: async () => {
      const response = await api.get<User[]>('/api/users?role=MEMBER');
      // 面談ではカレンダーと同じ隊員を選べるよう、displayOrder で除外しない（テスト用0番隊員も含む）
      return response.data || [];
    },
  });

  const sortedMembers = useMemo(
    () => sortUsersByDisplayOrder(members),
    [members]
  );

  const { data, isLoading, isFetching } = useQuery<InterviewMonthResponse>({
    queryKey: ['interview-monthly', 'data', memberId, month],
    queryFn: async () => {
      const response = await api.get<InterviewMonthResponse>('/api/schedules/for-interview-month', {
        params: { userId: memberId, month },
      });
      return response.data;
    },
    enabled: Boolean(memberId && month),
  });

  // カレンダー表示用：前後3ヶ月分のスケジュールを取得
  const calendarMonths = useMemo(() => {
    const current = new Date(`${month}-01`);
    return [
      format(subMonths(current, 3), 'yyyy-MM'),
      format(subMonths(current, 2), 'yyyy-MM'),
      format(subMonths(current, 1), 'yyyy-MM'),
      month,
      format(addMonths(current, 1), 'yyyy-MM'),
      format(addMonths(current, 2), 'yyyy-MM'),
      format(addMonths(current, 3), 'yyyy-MM'),
    ];
  }, [month]);

  const { data: calendarData } = useQuery({
    queryKey: ['interview-calendar', 'schedules', memberId, calendarMonths],
    queryFn: async () => {
      const results = await Promise.all(
        calendarMonths.map(async (m) => {
          const response = await api.get<InterviewMonthResponse>('/api/schedules/for-interview-month', {
            params: { userId: memberId, month: m },
          });
          return response.data.schedules;
        })
      );
      return results.flat();
    },
    enabled: Boolean(memberId && month),
  });

  const allSchedulesForCalendar = useMemo(() => calendarData ?? [], [calendarData]);

  /** 面談開催日の「翌月」の予定（今日基準の翌暦月） */
  const nextMonthYm = useMemo(() => format(addMonths(new Date(), 1), 'yyyy-MM'), []);

  const { data: nextMonthData, isFetching: nextMonthFetching } = useQuery<InterviewMonthResponse>({
    queryKey: ['interview-monthly', 'next', memberId, nextMonthYm],
    queryFn: async () => {
      const response = await api.get<InterviewMonthResponse>('/api/schedules/for-interview-month', {
        params: { userId: memberId, month: nextMonthYm },
      });
      return response.data;
    },
    enabled: Boolean(memberId),
  });

  const { data: interviewNoteData } = useQuery<InterviewNoteResponse>({
    queryKey: ['interview-note', memberId, month],
    queryFn: async () => {
      const response = await api.get<InterviewNoteResponse>('/api/interview-notes', {
        params: { memberId, month },
      });
      return response.data;
    },
    enabled: Boolean(memberId && month),
  });

  const schedules = useMemo(() => data?.schedules ?? [], [data]);
  const nextMonthSchedules = useMemo(() => nextMonthData?.schedules ?? [], [nextMonthData]);
  const consultations = useMemo(() => data?.consultations ?? [], [data]);
  const expenseSummary = data?.activityExpenseSummary;
  const missionsKpi = useMemo(() => data?.missionsKpi ?? [], [data]);
  const projectsKpi = useMemo(() => data?.projectsKpi ?? [], [data]);

  const byPerson = useMemo(() => {
    const map = new Map<string, { user: InterviewParticipantUser; schedules: InterviewSchedule[] }>();
    for (const s of schedules) {
      for (const p of schedulePeople(s)) {
        if (!map.has(p.id)) {
          map.set(p.id, { user: p, schedules: [] });
        }
        map.get(p.id)!.schedules.push(s);
      }
    }
    return [...map.values()].sort((a, b) => a.user.name.localeCompare(b.user.name, 'ja'));
  }, [schedules]);

  const projectCount = useMemo(() => {
    const ids = new Set(schedules.map((s) => s.project?.id).filter(Boolean) as string[]);
    return ids.size;
  }, [schedules]);

  const uniquePeopleCount = byPerson.length;

  if (membersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl">{/* max-w-5xl から max-w-7xl に変更 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">隊員</label>
            <select
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="">選択してください</option>
              {sortedMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">対象月</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          予定は、その月と開始日〜終了日が重なるものすべてです（複数日・共同予定の承認済み参加も含みます）。日付はサーバーと DB の暦日でそろえています。
        </p>
      </div>

      {!memberId && (
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">隊員を選ぶと一覧が表示されます。</p>
      )}

      {memberId && (isLoading || isFetching) && (
        <div className="flex justify-center py-16">
          <LoadingSpinner />
        </div>
      )}

      {memberId && data && !isFetching && (
        <>
          {/* 2カラムレイアウト */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 左カラム（メインコンテンツ） */}
            <div className="lg:col-span-2 space-y-8">
              {/* スケジュールカレンダー */}
              <section>
                <EnhancedInterviewCalendar 
                  schedules={allSchedulesForCalendar} 
                  initialMonth={month} 
                  memberName={data.member.name}
                  onMonthChange={undefined} // カレンダー独立動作
                />
              </section>

          <section id="consultations" className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
              相談（この隊員・対象月に関係なく一覧）
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              面談で扱うため、未対応・対応済みをまとめて表示します（相談機能と同じデータです）。
            </p>
            {consultations.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">相談の記録はありません。</p>
            ) : (
              <ul className="space-y-3">
                {consultations.map((c) => (
                  <li
                    key={c.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800/80"
                  >
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {c.subject?.trim() || '（件名なし）'}
                      </span>
                      <span
                        className={
                          c.status === 'OPEN'
                            ? 'text-amber-600 dark:text-amber-400 text-xs'
                            : 'text-green-600 dark:text-green-400 text-xs'
                        }
                      >
                        {c.status === 'OPEN' ? '未対応' : '対応済み'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {consultationAudienceJa(c.audience)}
                      {c.targetUser && ` → ${c.targetUser.name}`} ·{' '}
                      {format(new Date(c.createdAt), 'yyyy/M/d', { locale: ja })}
                    </p>
                    <p className="text-sm text-gray-800 dark:text-gray-200 mt-2 whitespace-pre-wrap">{c.body}</p>
                    {c.status === 'RESOLVED' && c.resolutionNote && (
                      <div className="mt-3 pt-3 border-t border-dashed border-gray-200 dark:border-gray-600 text-sm">
                        <p className="text-xs font-semibold text-gray-500">対応内容</p>
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{c.resolutionNote}</p>
                        {c.resolvedAt && (
                          <p className="text-xs text-gray-500 mt-1">
                            {format(new Date(c.resolvedAt), 'yyyy/M/d', { locale: ja })}
                            {c.resolvedBy && ` · ${c.resolvedBy.name}`}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <Link to="/consultations" className="inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline">
              相談画面を開く →
            </Link>
          </section>

          {expenseSummary && (
            <section id="activity-expenses" className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
                活動経費
              </h2>
              
              {/* サマリー */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800/80">
                  <p className="text-xs text-gray-500">設定上限額</p>
                  <p className="text-lg font-bold tabular-nums">{formatYenInterview(expenseSummary.allocatedAmount)}</p>
                </div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800/80">
                  <p className="text-xs text-gray-500">使用・予定累計額</p>
                  <p className="text-lg font-bold tabular-nums">{formatYenInterview(expenseSummary.totalSpent)}</p>
                </div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800/80">
                  <p className="text-xs text-gray-500">残り額</p>
                  <p
                    className={`text-lg font-bold tabular-nums ${
                      expenseSummary.remaining < 0 ? 'text-red-600 dark:text-red-400' : ''
                    }`}
                  >
                    {formatYenInterview(expenseSummary.remaining)}
                  </p>
                </div>
              </div>
              
              {expenseSummary.memo && (
                <p className="text-xs text-gray-600 dark:text-gray-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded p-2">
                  {expenseSummary.memo}
                </p>
              )}

              {/* 対象者ごとの使用リスト（プロジェクト別） */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">使用明細（プロジェクト別）</h3>
                <ActivityExpensesByProject entries={expenseSummary.recentEntries} />
              </div>

              <Link
                to="/activity-expenses"
                className="inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                活動経費の詳細を開く →
              </Link>
            </section>
          )}

          <section id="missions-projects" className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
              ミッション別・プロジェクト別
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              ミッションの中にプロジェクトを並べて、対象月に実行された活動を確認します。スケジュールがないプロジェクトも表示されます。
            </p>
            <MissionProjectScheduleSection missions={missionsKpi} projects={projectsKpi} schedules={schedules} />
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
              一緒に働いた人
            </h2>
            {byPerson.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">紐づけされた参加者（協力隊など）はいません。</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {byPerson.map(({ user: pu, schedules: ps }) => (
                  <div
                    key={pu.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-800/80"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
                        style={{ backgroundColor: pu.avatarColor || '#6B7280' }}
                      >
                        {pu.name.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{pu.name}</span>
                      <span className="text-xs text-gray-500">({ps.length} 件)</span>
                    </div>
                    <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
                      {ps.map((s) => (
                        <li key={s.id}>
                          · {formatScheduleDateRange(s)} — {s.shortTitle?.trim() || s.activityDescription?.trim()?.slice(0, 40)}
                          {(s.activityDescription?.length ?? 0) > 40 ? '…' : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
              来月の予定（面談開催月の翌月：{format(new Date(`${nextMonthYm}-01`), 'yyyy年M月', { locale: ja })}）
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              今日の日付から見た翌暦月の予定です。月初の面談では、前月振り返り（対象月）とあわせて翌月の動きを確認する用途向けです。
            </p>
            {nextMonthFetching ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : nextMonthSchedules.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm py-2">翌月に該当する予定はありません。</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {nextMonthSchedules.map((s) => (
                  <li
                    key={s.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-800/80 text-gray-800 dark:text-gray-200"
                  >
                    <span className="text-gray-500 dark:text-gray-400 mr-2">{formatScheduleDateRange(s)}</span>
                    {s.shortTitle?.trim() || s.activityDescription?.trim()?.slice(0, 100)}
                    {(s.activityDescription?.length ?? 0) > 100 ? '…' : ''}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
              週次報告の「来週の予定」（この月に提出された分）
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              「今後の計画」を話すときの材料にしてください。提出日がこの月に入っている週次報告のみ表示します。
            </p>
            {data.weeklyReports.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm py-2">該当する提出済み週次報告はありません。</p>
            ) : (
              <ul className="space-y-4">
                {data.weeklyReports.map((w) => (
                  <li
                    key={w.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800/80"
                  >
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {formatWeekLabel(w.week)}
                      {w.submittedAt && (
                        <span className="text-xs font-normal text-gray-500 ml-2">
                          提出 {format(new Date(w.submittedAt), 'M/d HH:mm', { locale: ja })}
                        </span>
                      )}
                    </div>
                    <div className="mt-2">
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                        来週の予定
                      </p>
                      <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap mt-1">
                        {w.nextWeekPlan?.trim() || '（未記入）'}
                      </p>
                    </div>
                    {summarizeThisWeek(w.thisWeekActivities) && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">その週の活動（要約）</p>
                        <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 line-clamp-4">
                          {summarizeThisWeek(w.thisWeekActivities)}
                        </p>
                      </div>
                    )}
                    {w.note?.trim() && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">備考: {w.note}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <Link to="/reports/weekly" className="inline-block text-sm text-blue-600 dark:text-blue-400 hover:underline">
              週次報告一覧を開く →
            </Link>
          </section>
        </div>

        {/* 右カラム（固定サイドバー） */}
        <div className="lg:col-span-1">
          <div className="sticky top-4 space-y-6">
            <InterviewMemoPanel memberId={memberId} month={month} noteData={interviewNoteData} />

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">
                {data.member.name}さん · {format(new Date(`${data.month}-01`), 'yyyy年M月', { locale: ja })}
              </h3>

              <div className="space-y-3">
                <a
                  href="#consultations"
                  className="flex items-center justify-between rounded p-2 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <span className="text-gray-600 dark:text-gray-400">相談</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{consultations.length} 件</span>
                </a>
                {expenseSummary && (
                  <a
                    href="#activity-expenses"
                    className="flex items-center justify-between rounded p-2 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <span className="text-gray-600 dark:text-gray-400">活動経費残額</span>
                    <span className={`font-semibold tabular-nums ${
                      expenseSummary.remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'
                    }`}>
                      {formatYenInterview(expenseSummary.remaining)}
                    </span>
                  </a>
                )}
                <a
                  href="#missions-projects"
                  className="flex items-center justify-between rounded p-2 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <span className="text-gray-600 dark:text-gray-400">ミッション・プロジェクト</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{missionsKpi.length + projectsKpi.length} 件</span>
                </a>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">予定</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{schedules.length} 件</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">プロジェクト</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{projectCount} 件</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">協働した人</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{uniquePeopleCount} 名</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </>
  )}
</div>
);
};
