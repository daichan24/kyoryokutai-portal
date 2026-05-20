import React, { useMemo, useState } from 'react';
import { Mail, RefreshCw, RotateCcw, StopCircle } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

type EmailJobStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED';

type EmailJob = {
  id: string;
  eventType: string;
  status: EmailJobStatus;
  recipientEmail: string;
  recipientName?: string | null;
  subject: string;
  textBody: string;
  link?: string | null;
  relatedType?: string | null;
  attempts: number;
  lastError?: string | null;
  scheduledAt: string;
  sentAt?: string | null;
  createdAt: string;
  actorUser?: { name: string; email: string; role: string } | null;
};

type EmailSummary = {
  counts: {
    pending: number;
    sending: number;
    failed: number;
    sentToday: number;
    cancelled: number;
    total: number;
    emailDisabledUsers: number;
  };
  settings: {
    enabled: boolean;
    provider: string;
    fromConfigured: boolean;
    apiKeyConfigured: boolean;
  };
};

const statusLabels: Record<EmailJobStatus, string> = {
  PENDING: '送信待ち',
  SENDING: '送信中',
  SENT: '送信済み',
  FAILED: '失敗',
  CANCELLED: '停止',
};

const statusClasses: Record<EmailJobStatus, string> = {
  PENDING: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200',
  SENDING: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200',
  SENT: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-200',
  FAILED: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200',
  CANCELLED: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
};

const eventLabels: Record<string, string> = {
  SYSTEM_TEST: 'テスト',
  WEEKLY_REPORT_SUBMITTED: '週次報告 承認依頼',
  WEEKLY_REPORT_APPROVED: '週次報告 承認',
  WEEKLY_REPORT_REJECTED: '週次報告 差し戻し',
  INSPECTION_SUBMITTED: '復命書 承認依頼',
  INSPECTION_APPROVED: '復命書 承認',
  INSPECTION_REJECTED: '復命書 差し戻し',
  MONTHLY_REPORT_SUBMITTED: '月次報告 承認依頼',
  MONTHLY_REPORT_APPROVED: '月次報告 承認',
  MONTHLY_REPORT_REJECTED: '月次報告 差し戻し',
  ACTIVITY_EXPENSE_SUBMITTED: '活動経費 承認依頼',
  ACTIVITY_EXPENSE_APPROVED: '活動経費 承認',
  ACTIVITY_EXPENSE_REJECTED: '活動経費 差し戻し',
  CONSULTATION_CREATED: '相談 作成',
  CONSULTATION_RESOLVED: '相談 対応済み',
  COMPENSATORY_LEAVE_SUBMITTED: '代休 確認依頼',
  COMPENSATORY_LEAVE_CONFIRMED: '代休 確認済み',
  TIME_ADJUSTMENT_SUBMITTED: '時間調整 確認依頼',
  TIME_ADJUSTMENT_CONFIRMED: '時間調整 確認済み',
  MISSION_APPROVED: 'ミッション 承認',
  MISSION_REJECTED: 'ミッション 差し戻し',
  PROJECT_APPROVED: 'プロジェクト 承認',
  PROJECT_REJECTED: 'プロジェクト 差し戻し',
  LEAVE_EXPIRY_REMINDER: '休暇期限リマインド',
  TIME_ADJUSTMENT_EXPIRY_REMINDER: '時間調整期限リマインド',
  SNS_WEEKLY_SUMMARY: 'SNS週次まとめ',
};

const dateTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return dateTimeFormatter.format(new Date(value));
}

export const EmailJobsSettings: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<EmailJobStatus | 'ALL'>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [testRecipientEmail, setTestRecipientEmail] = useState('');
  const [processResult, setProcessResult] = useState<{
    sent: number;
    failed: number;
    cancelled: number;
    processed: number;
    skipped?: boolean;
  } | null>(null);
  const [cleanupResult, setCleanupResult] = useState<{ deleted: number; days: number } | null>(null);

  const queryParams = useMemo(() => {
    const params = new URLSearchParams({ limit: '80' });
    if (status !== 'ALL') params.set('status', status);
    return params.toString();
  }, [status]);

  const summaryQuery = useQuery({
    queryKey: ['email-jobs-summary'],
    queryFn: async () => (await api.get<EmailSummary>('/api/admin/email-jobs/summary')).data,
  });

  const jobsQuery = useQuery({
    queryKey: ['email-jobs', queryParams],
    queryFn: async () => (await api.get<EmailJob[]>(`/api/admin/email-jobs?${queryParams}`)).data || [],
    refetchInterval: 30000,
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['email-jobs-summary'] }),
      queryClient.invalidateQueries({ queryKey: ['email-jobs'] }),
    ]);
  };

  const processMutation = useMutation({
    mutationFn: async () => (await api.post('/api/admin/email-jobs/process')).data,
    onSuccess: async (result) => {
      setProcessResult(result);
      await invalidate();
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (id: string) => (await api.post(`/api/admin/email-jobs/${id}/retry`)).data,
    onSuccess: invalidate,
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => (await api.post(`/api/admin/email-jobs/${id}/cancel`)).data,
    onSuccess: invalidate,
  });

  const testMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post('/api/admin/email-jobs/test', {
          recipientEmail: testRecipientEmail.trim() || undefined,
        })
      ).data,
    onSuccess: invalidate,
  });

  const cleanupMutation = useMutation({
    mutationFn: async () => (await api.post('/api/admin/email-jobs/cleanup', { days: 90 })).data,
    onSuccess: async (result) => {
      setCleanupResult(result);
      await invalidate();
    },
  });

  const summary = summaryQuery.data;
  const jobs = jobsQuery.data || [];
  const isBusy =
    processMutation.isPending ||
    retryMutation.isPending ||
    cancelMutation.isPending ||
    testMutation.isPending ||
    cleanupMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">メール通知キュー</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            承認依頼・結果通知・期限リマインドの送信状況を確認します。
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            value={testRecipientEmail}
            onChange={(event) => setTestRecipientEmail(event.target.value)}
            placeholder="テスト宛先（空なら自分）"
            className="w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 sm:w-56"
          />
          <Button
            variant="outline"
            onClick={() => testMutation.mutate()}
            disabled={isBusy}
            className="w-full sm:w-auto"
          >
            <Mail className="mr-2 h-4 w-4" />
            テストメール作成
          </Button>
          <Button
            onClick={() => processMutation.mutate()}
            disabled={isBusy}
            className="w-full sm:w-auto"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            送信処理を実行
          </Button>
          {user?.role === 'MASTER' && (
            <Button
              variant="ghost"
              onClick={() => {
                if (window.confirm('90日より古い送信済み・停止済みログを削除します。よろしいですか？')) {
                  cleanupMutation.mutate();
                }
              }}
              disabled={isBusy}
              className="w-full sm:w-auto"
            >
              古いログ削除
            </Button>
          )}
        </div>
      </div>

      {summaryQuery.isLoading ? (
        <LoadingSpinner />
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            {[
              ['送信待ち', summary.counts.pending],
              ['送信中', summary.counts.sending],
              ['失敗', summary.counts.failed],
              ['本日送信', summary.counts.sentToday],
              ['停止', summary.counts.cancelled],
              ['通知OFF', summary.counts.emailDisabledUsers],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
                <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{value}</div>
              </div>
            ))}
          </div>

          <div className="rounded-lg border border-border bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <Mail className="h-4 w-4 text-primary" />
              <span>送信設定:</span>
              <span className="font-semibold">{summary.settings.enabled ? '有効' : '無効'}</span>
              <span>provider={summary.settings.provider}</span>
              <span>FROM={summary.settings.fromConfigured ? '設定済み' : '未設定'}</span>
              <span>APIキー={summary.settings.apiKeyConfigured ? '設定済み' : '未設定'}</span>
            </div>
            {!summary.settings.enabled && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                EMAIL_ENABLED が true ではないため、ジョブは作成されますが実送信は行われません。
              </p>
            )}
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              テストメール作成後、送信設定が有効なら「送信処理を実行」で実送信まで確認できます。
            </p>
            {processResult && (
              <div className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-200">
                直近の送信処理: 対象 {processResult.processed} 件 / 送信 {processResult.sent} 件 / 失敗 {processResult.failed} 件 / 停止 {processResult.cancelled} 件
                {processResult.skipped && '（EMAIL_ENABLED が無効です）'}
              </div>
            )}
            {cleanupResult && (
              <div className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-200">
                古いログ削除: {cleanupResult.days}日より古い送信済み・停止済みログを {cleanupResult.deleted} 件削除しました。
              </div>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-red-600 dark:text-red-300">メール通知キューの集計を取得できませんでした。</p>
      )}

      <div className="flex flex-wrap gap-2">
        {(['ALL', 'PENDING', 'FAILED', 'SENT', 'CANCELLED'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setStatus(item)}
            className={`rounded-md border px-3 py-2 text-sm font-medium ${
              status === item
                ? 'border-primary bg-primary text-white'
                : 'border-border bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {item === 'ALL' ? 'すべて' : statusLabels[item]}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white dark:border-gray-700 dark:bg-gray-800">
        {jobsQuery.isLoading ? (
          <div className="p-6">
            <LoadingSpinner />
          </div>
        ) : jobs.length === 0 ? (
          <p className="p-6 text-sm text-gray-600 dark:text-gray-400">対象のメール通知ジョブはありません。</p>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {jobs.map((job) => (
              <div key={job.id} className="p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${statusClasses[job.status]}`}>
                        {statusLabels[job.status]}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {eventLabels[job.eventType] || job.eventType}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{formatDateTime(job.createdAt)}</span>
                    </div>
                    <div className="mt-2 font-semibold text-gray-900 dark:text-gray-100">{job.subject}</div>
                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      宛先: {job.recipientName || job.recipientEmail} / {job.recipientEmail}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      作成者: {job.actorUser?.name || '-'} / 送信予定: {formatDateTime(job.scheduledAt)} / 送信日時: {formatDateTime(job.sentAt)} / 試行: {job.attempts}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        {expandedId === job.id ? '本文を閉じる' : '本文を確認'}
                      </button>
                      {job.link && (
                        <a
                          href={job.link}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          関連画面を開く
                        </a>
                      )}
                      {job.relatedType && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          関連: {job.relatedType}
                        </span>
                      )}
                    </div>
                    {expandedId === job.id && (
                      <pre className="mt-3 whitespace-pre-wrap rounded-md border border-gray-200 bg-gray-50 p-3 text-xs leading-relaxed text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
                        {job.textBody}
                      </pre>
                    )}
                    {job.lastError && (
                      <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/20 dark:text-red-200">
                        {job.lastError}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {job.status !== 'SENT' && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => retryMutation.mutate(job.id)}
                      >
                        <RotateCcw className="mr-1 h-4 w-4" />
                        再送
                      </Button>
                    )}
                    {job.status !== 'SENT' && job.status !== 'CANCELLED' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => cancelMutation.mutate(job.id)}
                      >
                        <StopCircle className="mr-1 h-4 w-4" />
                        停止
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
