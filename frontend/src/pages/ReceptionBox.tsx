import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { api } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Button } from '../components/common/Button';

interface ReceptionData {
  scheduleInvites: Array<{
    id: string;
    status: string;
    createdAt: string;
    schedule: { id: string; activityDescription: string; user: { id: string; name: string } };
    user?: { id: string; name: string };
  }>;
  consultations: Array<{
    id: string;
    subject: string | null;
    createdAt: string;
    member: { id: string; name: string };
    targetUser?: { id: string; name: string };
  }>;
  expenses: Array<{
    id: string;
    amount: number;
    description: string;
    createdAt: string;
    user: { id: string; name: string };
  }>;
  weeklyReports: Array<{
    id: string;
    submittedAt: string;
    user: { id: string; name: string };
  }>;
  inspections: Array<{
    id: string;
    destination: string;
    createdAt: string;
    user: { id: string; name: string };
  }>;
  monthlyReports: Array<{
    id: string;
    targetMonth: string;
    submittedAt: string;
    creator: { id: string; name: string };
  }>;
}

export const ReceptionBox: React.FC = () => {
  const { user } = useAuthStore();
  const isMember = user?.role === 'MEMBER';

  const { data, isLoading } = useQuery<ReceptionData>({
    queryKey: ['reception-box', 'list'],
    queryFn: async () => {
      const response = await api.get('/api/reception-box');
      return response.data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (!data) return null;

  const totalCount =
    data.scheduleInvites.length +
    data.consultations.length +
    data.expenses.length +
    data.weeklyReports.length +
    data.inspections.length +
    data.monthlyReports.length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">受付ボックス</h1>
        <p className="text-gray-600 dark:text-gray-400">
          未確認または未対応の項目が {totalCount} 件あります。
        </p>
      </div>

      <div className="grid gap-6">
        {/* 相談 */}
        {data.consultations.length > 0 && (
          <section className="bg-amber-50 dark:bg-amber-900/10 p-5 rounded-lg border border-amber-200 dark:border-amber-800">
            <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-100 flex items-center justify-between">
              新しい相談（{data.consultations.length}件）
              <Link to="/consultations">
                <Button size="sm" variant="outline">すべて見る</Button>
              </Link>
            </h2>
            <ul className="mt-3 space-y-2">
              {data.consultations.map((c) => (
                <li key={c.id} className="bg-white dark:bg-gray-800 p-3 rounded shadow-sm border border-amber-100 dark:border-amber-800/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {c.member.name}さんからの相談: {c.subject || '（件名なし）'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {format(new Date(c.createdAt), 'yyyy/MM/dd HH:mm', { locale: ja })}
                    </p>
                  </div>
                  <Link to="/consultations" className="w-full sm:w-auto">
                    <Button size="sm" className="w-full sm:w-auto">対応する</Button>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 週次報告 */}
        {data.weeklyReports.length > 0 && (
          <section className="bg-blue-50 dark:bg-blue-900/10 p-5 rounded-lg border border-blue-200 dark:border-blue-800">
            <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100 flex items-center justify-between">
              未確認の週報（{data.weeklyReports.length}件）
              <Link to="/reports/weekly">
                <Button size="sm" variant="outline">すべて見る</Button>
              </Link>
            </h2>
            <ul className="mt-3 space-y-2">
              {data.weeklyReports.map((r) => (
                <li key={r.id} className="bg-white dark:bg-gray-800 p-3 rounded shadow-sm border border-blue-100 dark:border-blue-800/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{r.user.name}さんの週報</p>
                    <p className="text-xs text-gray-500 mt-1">
                      提出日時: {format(new Date(r.submittedAt), 'yyyy/MM/dd HH:mm', { locale: ja })}
                    </p>
                  </div>
                  <Link to="/reports/weekly" className="w-full sm:w-auto">
                    <Button size="sm" variant="outline" className="w-full sm:w-auto">確認する</Button>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 復命書 */}
        {data.inspections.length > 0 && (
          <section className="bg-emerald-50 dark:bg-emerald-900/10 p-5 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <h2 className="text-lg font-semibold text-emerald-900 dark:text-emerald-100 flex items-center justify-between">
              未確認の復命書・視察（{data.inspections.length}件）
              <Link to="/inspections">
                <Button size="sm" variant="outline">すべて見る</Button>
              </Link>
            </h2>
            <ul className="mt-3 space-y-2">
              {data.inspections.map((i) => (
                <li key={i.id} className="bg-white dark:bg-gray-800 p-3 rounded shadow-sm border border-emerald-100 dark:border-emerald-800/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {i.user.name}さんの復命書 ({i.destination || '宛先なし'})
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      作成: {format(new Date(i.createdAt), 'yyyy/MM/dd HH:mm', { locale: ja })}
                    </p>
                  </div>
                  <Link to="/inspections" className="w-full sm:w-auto">
                    <Button size="sm" variant="outline" className="w-full sm:w-auto">確認する</Button>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 月次報告 */}
        {data.monthlyReports.length > 0 && (
          <section className="bg-purple-50 dark:bg-purple-900/10 p-5 rounded-lg border border-purple-200 dark:border-purple-800">
            <h2 className="text-lg font-semibold text-purple-900 dark:text-purple-100 flex items-center justify-between">
              未確認の月次報告（{data.monthlyReports.length}件）
              <Link to="/reports/monthly">
                <Button size="sm" variant="outline">すべて見る</Button>
              </Link>
            </h2>
            <ul className="mt-3 space-y-2">
              {data.monthlyReports.map((m) => (
                <li key={m.id} className="bg-white dark:bg-gray-800 p-3 rounded shadow-sm border border-purple-100 dark:border-purple-800/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {m.creator.name}さんの月次報告 ({m.targetMonth})
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      提出日時: {format(new Date(m.submittedAt), 'yyyy/MM/dd HH:mm', { locale: ja })}
                    </p>
                  </div>
                  <Link to="/reports/monthly" className="w-full sm:w-auto">
                    <Button size="sm" variant="outline" className="w-full sm:w-auto">確認する</Button>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 活動経費承認 */}
        {data.expenses.length > 0 && (
          <section className="bg-rose-50 dark:bg-rose-900/10 p-5 rounded-lg border border-rose-200 dark:border-rose-800">
            <h2 className="text-lg font-semibold text-rose-900 dark:text-rose-100 flex items-center justify-between">
              未承認の活動経費（{data.expenses.length}件）
              <Link to="/activity-expenses">
                <Button size="sm" variant="outline">すべて見る</Button>
              </Link>
            </h2>
            <ul className="mt-3 space-y-2">
              {data.expenses.map((e) => (
                <li key={e.id} className="bg-white dark:bg-gray-800 p-3 rounded shadow-sm border border-rose-100 dark:border-rose-800/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {e.user.name}さん: {e.description} (¥{e.amount.toLocaleString()})
                    </p>
                  </div>
                  <Link to="/activity-expenses" className="w-full sm:w-auto">
                    <Button size="sm" variant="outline" className="w-full sm:w-auto">確認する</Button>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* スケジュール招待 */}
        {data.scheduleInvites.length > 0 && (
          <section className="bg-teal-50 dark:bg-teal-900/10 p-5 rounded-lg border border-teal-200 dark:border-teal-800">
            <h2 className="text-lg font-semibold text-teal-900 dark:text-teal-100 flex items-center justify-between">
              スケジュール承認待ち（{data.scheduleInvites.length}件）
              <Link to="/schedule">
                <Button size="sm" variant="outline">すべて見る</Button>
              </Link>
            </h2>
            <ul className="mt-3 space-y-2">
              {data.scheduleInvites.map((s) => (
                <li key={s.id} className="bg-white dark:bg-gray-800 p-3 rounded shadow-sm border border-teal-100 dark:border-teal-800/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {s.schedule.user.name}さんのスケジュール: {s.schedule.activityDescription}
                    </p>
                    {s.user && (
                      <p className="text-xs text-gray-500 mt-1">対象者: {s.user.name}</p>
                    )}
                  </div>
                  <Link to="/schedule" className="w-full sm:w-auto">
                    <Button size="sm" variant="outline" className="w-full sm:w-auto">確認する</Button>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {totalCount === 0 && (
          <div className="bg-white dark:bg-gray-800 p-8 rounded-lg border border-gray-200 dark:border-gray-700 text-center text-gray-500">
            受付ボックスには未対応の項目はありません。
          </div>
        )}
      </div>
    </div>
  );
};
