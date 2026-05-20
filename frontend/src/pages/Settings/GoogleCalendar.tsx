import React, { useEffect, useState } from 'react';
import { AlertCircle, CalendarCheck, CheckCircle2, ExternalLink, RefreshCw, Unlink } from 'lucide-react';
import { api } from '../../utils/api';
import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { GoogleCalendarStatus } from '../../types';

function formatDateTime(value?: string | null) {
  if (!value) return '未同期';
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export const GoogleCalendarSettings: React.FC = () => {
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await api.get<GoogleCalendarStatus>('/api/integrations/google-calendar/status');
      setStatus(response.data);
    } catch (error) {
      console.error('Failed to fetch Google Calendar status:', error);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const params = new URLSearchParams(window.location.search);
    const result = params.get('googleCalendar');
    if (result === 'connected') setMessage('Googleカレンダー連携が完了しました。');
    if (result === 'error') setMessage('Googleカレンダー連携に失敗しました。設定を確認してください。');
  }, []);

  const startConnect = async () => {
    try {
      setBusy(true);
      const response = await api.get<{ url: string }>('/api/integrations/google-calendar/auth-url');
      window.location.href = response.data.url;
    } catch (error: any) {
      console.error('Failed to create Google auth url:', error);
      alert(error.response?.data?.details || error.response?.data?.error || 'Google連携URLの作成に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const runSync = async () => {
    try {
      setBusy(true);
      await api.post('/api/integrations/google-calendar/sync');
      setMessage('同期を実行しました。');
      await fetchStatus();
    } catch (error: any) {
      console.error('Failed to sync Google Calendar:', error);
      alert(error.response?.data?.details || error.response?.data?.error || '同期に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!confirm('Googleカレンダー連携を解除しますか？Google上の専用カレンダーは削除されません。')) return;
    try {
      setBusy(true);
      await api.post('/api/integrations/google-calendar/disconnect');
      setMessage('Googleカレンダー連携を解除しました。');
      await fetchStatus();
    } catch (error: any) {
      console.error('Failed to disconnect Google Calendar:', error);
      alert(error.response?.data?.error || '連携解除に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const connection = status?.connection;
  const connected = status?.connected;
  const hasError = connection?.status === 'ERROR' || connection?.status === 'REAUTH_REQUIRED' || !!connection?.lastError;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Googleカレンダー連携</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          専用カレンダー「クリアベース｜活動予定」とスケジュールを同期します。
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200">
          {message}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className={`mt-1 rounded-full p-2 ${connected ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'}`}>
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {connected ? '連携中' : '未連携'}
                </h2>
                {connected && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    ACTIVE
                  </span>
                )}
                {hasError && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    <AlertCircle className="h-3.5 w-3.5" />
                    要確認
                  </span>
                )}
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">Googleアカウント</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100">{connection?.googleAccountEmail || '-'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">専用カレンダー</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100">{connection?.calendarSummary || 'クリアベース｜活動予定'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">最終同期</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100">{formatDateTime(connection?.lastSyncedAt)}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 dark:text-gray-400">watch期限</dt>
                  <dd className="font-medium text-gray-900 dark:text-gray-100">{formatDateTime(connection?.watchExpiration)}</dd>
                </div>
              </dl>
              {connection?.lastError && (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                  {connection.lastError}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!connected ? (
              <Button onClick={startConnect} disabled={busy}>
                <ExternalLink className="mr-2 h-4 w-4" />
                Google連携
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={runSync} disabled={busy}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  手動同期
                </Button>
                <Button variant="outline" onClick={disconnect} disabled={busy}>
                  <Unlink className="mr-2 h-4 w-4" />
                  解除
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
