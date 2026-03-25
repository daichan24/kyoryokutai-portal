import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import type { User } from '../types';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

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

interface InterviewMonthResponse {
  member: { id: string; name: string; avatarColor: string };
  month: string;
  range: { from: string; to: string };
  schedules: InterviewSchedule[];
  weeklyReports: InterviewWeeklyReport[];
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

export const InterviewMonthlySchedules: React.FC = () => {
  const { user } = useAuthStore();
  const defaultMonth = format(new Date(), 'yyyy-MM');

  const [memberId, setMemberId] = useState<string>('');
  const [month, setMonth] = useState<string>(defaultMonth);

  const { data: members = [], isLoading: membersLoading } = useQuery<User[]>({
    queryKey: ['interview-monthly', 'members', user?.role],
    queryFn: async () => {
      const response = await api.get<User[]>('/api/users?role=MEMBER');
      const list = response.data || [];
      return list.filter(
        (u) =>
          !(user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT' || user?.role === 'MASTER') ||
          (u.displayOrder ?? 0) !== 0
      );
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

  const schedules = useMemo(() => data?.schedules ?? [], [data]);

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
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">面談用・月間スケジュール</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
          隊員と対象月を選ぶと、その月に予定されていたスケジュールを整理して表示します。活動内容・一緒に動いた人・プロジェクトの見通しを踏まえ、面談で「何をしたか／誰と会ったか／プロジェクトの進み／この先の計画」を話しやすくするためのビューです。
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
          表示期間は、その月のカレンダー内で開始・終了が重なる予定すべてです（複数日にまたがる予定も含みます）。
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
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {data.member.name}さん · {format(new Date(`${data.month}-01`), 'yyyy年M月', { locale: ja })}
            </span>
            <span className="text-gray-500 dark:text-gray-400">
              予定 {schedules.length} 件 · プロジェクト {projectCount} 件 · 関わった人（重複除く）{uniquePeopleCount} 名
            </span>
            <Link
              to="/schedule"
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm ml-auto"
            >
              スケジュール画面で確認 →
            </Link>
          </div>

          <section className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-2">面談の観点（ヒント）</h2>
            <ul className="text-sm text-amber-950/90 dark:text-amber-100/90 space-y-1 list-disc list-inside">
              <li>
                <strong>活動内容</strong>：下の「日付順」で、いつ何に時間を使ったかをなぞる
              </li>
              <li>
                <strong>誰とあったか</strong>：「一緒に動いた人」で名前ごとに予定をたどる（町民DBの接触は別途「町民データベース」で確認）
              </li>
              <li>
                <strong>プロジェクトの進み</strong>：「プロジェクト別」で担当プロジェクトごとにまとまりを見る
              </li>
              <li>
                <strong>今後の計画</strong>：「週次報告の来週の予定」に、その月に提出された分の「来週の予定」を集約
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2">
              日付順（この月の予定一覧）
            </h2>
            {schedules.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm py-4">この月に該当する予定はありません。</p>
            ) : (
              <ul className="space-y-3">
                {schedules.map((s) => {
                  const people = schedulePeople(s);
                  const headline =
                    s.shortTitle?.trim() ||
                    s.activityDescription?.trim()?.split(/\n/)?.[0]?.slice(0, 120) ||
                    '（タイトルなし）';
                  return (
                    <li
                      key={s.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-800/80"
                    >
                      <div className="flex flex-wrap gap-2 items-baseline justify-between">
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{formatScheduleDateRange(s)}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                          {s.startTime}–{s.endTime}
                        </div>
                      </div>
                      <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{headline}</p>
                      {s.activityDescription?.trim() && s.activityDescription.trim() !== headline && (
                        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{s.activityDescription}</p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {s.project && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium text-white"
                            style={{ backgroundColor: s.project.themeColor || '#6366f1' }}
                          >
                            {s.project.projectName}
                          </span>
                        )}
                        {(s.location?.name || s.locationText) && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                            📍 {s.location?.name || s.locationText}
                          </span>
                        )}
                        {people.map((p) => (
                          <span
                            key={p.id}
                            className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                          >
                            {p.name}
                          </span>
                        ))}
                      </div>
                      {s.freeNote?.trim() && (
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400 border-t border-dashed border-gray-200 dark:border-gray-600 pt-2">
                          メモ: {s.freeNote}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

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
              一緒に動いた人
            </h2>
            {byPerson.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">参加者として登録されている人はいません。</p>
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
        </>
      )}
    </div>
  );
};
