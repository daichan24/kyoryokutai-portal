import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { addMonths, format, parseISO, subMonths } from 'date-fns';
import { ja } from 'date-fns/locale';
import { api } from '../utils/api';
import type { User } from '../types';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { EnhancedInterviewCalendar } from '../components/interview/EnhancedInterviewCalendar';
import { ActivityExpensesByProject } from '../components/interview/ActivityExpensesByProject';

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

const UNLINKED_KEY = '__none__';

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
    () => [...members].sort((a, b) => a.name.localeCompare(b.name, 'ja')),
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

  const schedules = useMemo(() => data?.schedules ?? [], [data]);
  const nextMonthSchedules = useMemo(() => nextMonthData?.schedules ?? [], [nextMonthData]);
  const consultations = useMemo(() => data?.consultations ?? [], [data]);
  const expenseSummary = data?.activityExpenseSummary;
  const missionsKpi = useMemo(() => data?.missionsKpi ?? [], [data]);
  const projectsKpi = useMemo(() => data?.projectsKpi ?? [], [data]);

  const byProject = useMemo(() => {
    const map = new Map<string, InterviewSchedule[]>();
    for (const s of schedules) {
      const key = s.project?.id ?? UNLINKED_KEY;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [schedules]);

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
      <div>
        <h1 className="text-2xl sm:text-3xl whitespace-nowrap font-bold text-gray-900 dark:text-gray-100">面談</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
          隊員と対象月を選ぶと、スケジュールカレンダー、ミッション・プロジェクトの達成状況、活動経費、相談内容などを一画面で確認できます。面談で使いやすいように情報を整理して表示します。
        </p>
      </div>

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
          {/* 面談の流れ */}
          <section className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">面談の流れ</h2>
            <ol className="text-sm text-blue-950/90 dark:text-blue-100/90 space-y-2 list-decimal list-inside">
              <li>
                <strong>スケジュール確認</strong> - カレンダーで対象月の活動状況を把握
              </li>
              <li>
                <strong>ミッション・プロジェクトの達成状況</strong> - 進捗率とタスク完了状況を確認
              </li>
              <li>
                <strong>相談内容の確認</strong> - 隊員からの相談事項を事前に把握
              </li>
              <li>
                <strong>活動経費</strong> - 予算の使用状況とプロジェクト別の支出を確認
              </li>
              <li>
                <strong>プロジェクト別の活動</strong> - 各プロジェクトでの予定を確認
              </li>
              <li>
                <strong>協働した人</strong> - 誰と一緒に活動したかを確認
              </li>
              <li>
                <strong>来月の予定</strong> - 翌月の計画を確認
              </li>
              <li>
                <strong>週次報告</strong> - 提出された週次報告から今後の計画を確認
              </li>
            </ol>
          </section>

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

          <section id="missions-projects" className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
              ミッション・プロジェクトの達成状況
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              対象月と期間が重なるミッション・プロジェクトの進捗状況です。ミッションとプロジェクトの関連性を確認できます。
            </p>

            {/* ミッション別にプロジェクトをグループ化 */}
            {missionsKpi.length === 0 && projectsKpi.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">該当するミッション・プロジェクトはありません。</p>
            ) : (
              <div className="space-y-6">
                {missionsKpi.map((mi) => {
                  const relatedProjects = projectsKpi.filter((p) => p.mission?.id === mi.id);
                  return (
                    <div key={mi.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800/80">
                      {/* ミッション情報 */}
                      <div className="mb-4">
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-lg text-gray-900 dark:text-gray-100">{mi.missionName}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200">
                              {mi.missionType === 'PRIMARY' ? '主目標' : '副目標'}
                            </span>
                          </div>
                          <span className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                            {mi.progress}%
                          </span>
                        </div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden mb-2">
                          <div
                            className={`h-full transition-all ${progressBarColor(mi.progress)}`}
                            style={{ width: `${Math.min(100, mi.progress)}%` }}
                          />
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
                          <span>
                            目標ツリー内タスク: {mi.goalTasks.completed}/{mi.goalTasks.total} 完了
                            {mi.goalTasks.total > 0 && (
                              <span className="text-gray-400 ml-1">
                                （{Math.round((mi.goalTasks.completed / mi.goalTasks.total) * 100)}%）
                              </span>
                            )}
                          </span>
                          <span>
                            ミッション直下タスク: {mi.standaloneTasks.completed}/{mi.standaloneTasks.total} 完了
                          </span>
                        </div>
                      </div>

                      {/* 関連プロジェクト */}
                      {relatedProjects.length > 0 && (
                        <div className="ml-4 space-y-2 border-l-2 border-gray-300 dark:border-gray-600 pl-4">
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">関連プロジェクト</p>
                          {relatedProjects.map((p) => (
                            <div key={p.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900/40">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span
                                  className="inline-block w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: p.themeColor || '#6366f1' }}
                                />
                                <span className="font-medium text-gray-900 dark:text-gray-100">{p.projectName}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                                  {phaseLabelJa(p.phase)}
                                </span>
                                <span className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums ml-auto">
                                  {p.progress}%
                                </span>
                              </div>
                              <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden mb-2">
                                <div
                                  className={`h-full transition-all ${progressBarColor(p.progress)}`}
                                  style={{ width: `${Math.min(100, p.progress)}%` }}
                                />
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
                                <span>
                                  プロジェクトタスク: {p.projectTasks.completed}/{p.projectTasks.total}
                                </span>
                                <span>
                                  関連タスク: {p.relatedTasks.completed}/{p.relatedTasks.total} 完了
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* ミッションに紐づかないプロジェクト */}
                {projectsKpi.filter((p) => !p.mission).length > 0 && (
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800/80">
                    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3">ミッション未設定のプロジェクト</p>
                    <div className="space-y-2">
                      {projectsKpi
                        .filter((p) => !p.mission)
                        .map((p) => (
                          <div key={p.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900/40">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span
                                className="inline-block w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: p.themeColor || '#6366f1' }}
                              />
                              <span className="font-medium text-gray-900 dark:text-gray-100">{p.projectName}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200">
                                {phaseLabelJa(p.phase)}
                              </span>
                              <span className="text-lg font-bold text-gray-900 dark:text-gray-100 tabular-nums ml-auto">
                                {p.progress}%
                              </span>
                            </div>
                            <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden mb-2">
                              <div
                                className={`h-full transition-all ${progressBarColor(p.progress)}`}
                                style={{ width: `${Math.min(100, p.progress)}%` }}
                              />
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-300">
                              <span>
                                プロジェクトタスク: {p.projectTasks.completed}/{p.projectTasks.total}
                              </span>
                              <span>
                                関連タスク: {p.relatedTasks.completed}/{p.relatedTasks.total} 完了
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-3 text-sm">
              <Link to="/goals" className="text-blue-600 dark:text-blue-400 hover:underline">
                ミッション（目標）を開く →
              </Link>
              <Link to="/projects" className="text-blue-600 dark:text-blue-400 hover:underline">
                プロジェクトを開く →
              </Link>
            </div>
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
                  <p className="text-xs text-gray-500">使用累計額</p>
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

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
              プロジェクト別
            </h2>
            {schedules.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">予定がないためプロジェクト別の集計はありません。</p>
            ) : (
            [...byProject.entries()]
              .sort(([a], [b]) => {
                if (a === UNLINKED_KEY) return 1;
                if (b === UNLINKED_KEY) return -1;
                return 0;
              })
              .map(([key, list]) => {
                const proj = list[0]?.project;
                const label = proj?.projectName ?? 'プロジェクト未設定';
                return (
                  <div key={key} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                    <div
                      className="px-3 py-2 text-sm font-medium text-white flex items-center gap-2"
                      style={{ backgroundColor: proj?.themeColor || '#64748b' }}
                    >
                      {label}
                      <span className="opacity-90 font-normal text-xs">（{list.length} 件）</span>
                    </div>
                    <ul className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800/60">
                      {list.map((s) => (
                        <li key={s.id} className="px-3 py-2 text-sm text-gray-800 dark:text-gray-200">
                          <span className="text-gray-500 dark:text-gray-400 mr-2">{formatScheduleDateRange(s)}</span>
                          {s.shortTitle?.trim() || s.activityDescription?.trim()?.slice(0, 80)}
                          {(s.activityDescription?.length ?? 0) > 80 ? '…' : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })
            )}
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
                      週 {w.week}
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

        {/* 右カラム（サマリー情報） */}
        <div className="lg:col-span-1 space-y-6">
          <div className="sticky top-4 space-y-6">
            {/* 統計サマリー */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">
              {data.member.name}さん · {format(new Date(`${data.month}-01`), 'yyyy年M月', { locale: ja })}
            </h3>
            
            <div className="space-y-3">
              <a
                href="#missions-projects"
                className="flex items-center justify-between text-sm hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded transition-colors cursor-pointer"
              >
                <span className="text-gray-600 dark:text-gray-400">ミッション・プロジェクト</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{missionsKpi.length + projectsKpi.length} 件</span>
              </a>
              <a
                href="#consultations"
                className="flex items-center justify-between text-sm hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded transition-colors cursor-pointer"
              >
                <span className="text-gray-600 dark:text-gray-400">相談</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">{consultations.length} 件</span>
              </a>
              {expenseSummary && (
                <a
                  href="#activity-expenses"
                  className="flex items-center justify-between text-sm hover:bg-gray-50 dark:hover:bg-gray-700 p-2 rounded transition-colors cursor-pointer"
                >
                  <span className="text-gray-600 dark:text-gray-400">活動経費</span>
                  <span className={`font-semibold tabular-nums ${
                    expenseSummary.remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'
                  }`}>
                    {formatYenInterview(expenseSummary.remaining)}
                  </span>
                </a>
              )}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">予定</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{schedules.length} 件</span>
                </div>
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

            <Link
              to="/schedule"
              className="mt-4 block text-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              スケジュール画面で確認 →
            </Link>
          </div>

          {/* 相談サマリー */}
          {consultations.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">
                相談状況
              </h3>
              <div className="space-y-2">
                {consultations.slice(0, 3).map((c) => (
                  <div key={c.id} className="text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-900 dark:text-gray-100 truncate flex-1">
                        {c.subject?.trim() || '（件名なし）'}
                      </span>
                      <span
                        className={`text-xs ml-2 ${
                          c.status === 'OPEN'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-green-600 dark:text-green-400'
                        }`}
                      >
                        {c.status === 'OPEN' ? '未対応' : '対応済み'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {format(new Date(c.createdAt), 'M/d', { locale: ja })}
                    </p>
                  </div>
                ))}
                {consultations.length > 3 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    他 {consultations.length - 3} 件
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 活動経費サマリー */}
          {expenseSummary && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3 border-b border-gray-200 dark:border-gray-700 pb-2">
                活動経費
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">設定上限額</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                    {formatYenInterview(expenseSummary.allocatedAmount)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">使用累計額</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                    {formatYenInterview(expenseSummary.totalSpent)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">残り額</span>
                  <span
                    className={`font-semibold tabular-nums ${
                      expenseSummary.remaining < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    {formatYenInterview(expenseSummary.remaining)}
                  </span>
                </div>
              </div>
              {expenseSummary.remaining < 0 && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  ⚠️ 予算を超過しています
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

        </>
      )}
    </div>
  );
};
