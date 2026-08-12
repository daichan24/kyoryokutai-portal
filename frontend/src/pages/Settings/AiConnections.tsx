import React, { useEffect, useState } from 'react';
import type { AxiosError } from 'axios';
import { Check, Copy, KeyRound, ShieldCheck, Trash2 } from 'lucide-react';
import { api } from '../../utils/api';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';

type AiScope =
  | 'tasks:read:self' | 'tasks:write:self'
  | 'schedules:read:self' | 'schedules:write:self'
  | 'notepad:read:self' | 'notepad:write:self'
  | 'missions:read:self' | 'missions:write:self'
  | 'projects:read:self' | 'projects:write:self';

type CapabilityResponse = {
  availableScopes: AiScope[];
  role: string;
  passwordIsNeverSharedWithAi: boolean;
};

type AccessTokenRecord = {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: AiScope[];
  authType: 'MANUAL' | 'OAUTH';
  expiresAt: string | null;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};

const SCOPE_GROUPS: Array<{ label: string; read: AiScope; write: AiScope }> = [
  { label: 'カレンダー・予定・休み', read: 'schedules:read:self', write: 'schedules:write:self' },
  { label: 'タスク', read: 'tasks:read:self', write: 'tasks:write:self' },
  { label: 'ミッション', read: 'missions:read:self', write: 'missions:write:self' },
  { label: 'プロジェクト', read: 'projects:read:self', write: 'projects:write:self' },
  { label: 'メモ帳', read: 'notepad:read:self', write: 'notepad:write:self' },
];

export const AiConnectionsSettings: React.FC = () => {
  const [capabilities, setCapabilities] = useState<CapabilityResponse | null>(null);
  const [tokens, setTokens] = useState<AccessTokenRecord[]>([]);
  const [name, setName] = useState('自分のローカルCodex');
  const [password, setPassword] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<AiScope[]>([]);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const [capabilityResponse, tokenResponse] = await Promise.all([
      api.get<CapabilityResponse>('/api/ai/capabilities'),
      api.get<AccessTokenRecord[]>('/api/ai/access-tokens'),
    ]);
    setCapabilities(capabilityResponse.data);
    setTokens(tokenResponse.data || []);
    setSelectedScopes((current) => current.length > 0 ? current : capabilityResponse.data.availableScopes);
  };

  useEffect(() => {
    load().catch(() => setError('AI接続情報を読み込めませんでした'));
  }, []);

  const toggleScope = (scope: AiScope) => {
    setSelectedScopes((current) => current.includes(scope)
      ? current.filter((candidate) => candidate !== scope)
      : [...current, scope]);
  };

  const createToken = async () => {
    setLoading(true);
    setError(null);
    setNewToken(null);
    try {
      const response = await api.post<{ token: string }>('/api/ai/access-tokens', {
        name,
        currentPassword: password,
        expiresInDays: null,
        scopes: selectedScopes,
      });
      setNewToken(response.data.token);
      setPassword('');
      await load();
    } catch (requestError: unknown) {
      const apiError = requestError as AxiosError<{ error?: unknown }>;
      const message = apiError.response?.data?.error;
      setError(typeof message === 'string' ? message : 'AI接続の発行に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const revokeToken = async (id: string) => {
    if (!window.confirm('このAI接続を失効させますか？')) return;
    await api.delete(`/api/ai/access-tokens/${id}`);
    await load();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-gray-100">
          <KeyRound className="h-6 w-6" /> AI接続
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          CodexやChatGPTから、管理画面と同じタスク・予定・ミッション・プロジェクト・メモを操作するための設定です。
        </p>
      </div>

      <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-900/20">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 text-green-700 dark:text-green-300" />
          <div>
            <p className="font-medium text-green-900 dark:text-green-100">パスワードはAIに渡しません</p>
            <p className="mt-1 text-sm text-green-800 dark:text-green-200">
              現在のパスワードは、本人がAI接続を発行する際の確認にだけ使います。接続はいつでも失効できます。
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-900/20">
        <p className="font-medium text-blue-950 dark:text-blue-100">ChatGPT Workは自動接続です</p>
        <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">
          ChatGPT側でClearBaseを追加すると、この画面とは別のログイン画面が開きます。接続は自動更新され、7日ごとの再設定はありません。下のトークン発行はローカルCodexを使う場合だけ必要です。
        </p>
      </div>

      {capabilities && capabilities.availableScopes.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-100">
          現在の役割で利用できるAI操作は、まだ開放されていません。
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">ローカルCodex用の接続を発行</h2>
          <div className="mt-4">
            <Input label="接続名" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">許可する操作</p>
            {SCOPE_GROUPS.map((group) => (
              <div key={group.label} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700">
                <span className="text-sm text-gray-800 dark:text-gray-200">{group.label}</span>
                <div className="flex gap-4">
                  {([['閲覧', group.read], ['追加・変更', group.write]] as const).map(([label, scope]) => (
                    <label key={scope} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input type="checkbox" checked={selectedScopes.includes(scope)} onChange={() => toggleScope(scope)} className="h-4 w-4 rounded text-primary" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Input label="現在のパスワード（本人確認）" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
          <Button className="mt-4" onClick={createToken} disabled={loading || !password || selectedScopes.length === 0}>
            {loading ? '発行中...' : 'AI接続を発行'}
          </Button>
        </div>
      )}

      {newToken && (
        <div className="rounded-xl border-2 border-blue-400 bg-blue-50 p-5 dark:bg-blue-900/20">
          <h2 className="font-semibold text-blue-950 dark:text-blue-100">接続トークン（今回だけ表示）</h2>
          <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">コピーして、Codexなどの安全な設定画面に登録してください。チャット本文には貼らないでください。</p>
          <div className="mt-3 flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded bg-white p-3 text-xs text-gray-900 dark:bg-gray-950 dark:text-gray-100">{newToken}</code>
            <Button variant="outline" onClick={async () => { await navigator.clipboard.writeText(newToken); setCopied(true); }}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">発行済みのAI接続</h2>
        <div className="mt-3 space-y-3">
          {tokens.map((token) => (
            <div key={token.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">{token.name}</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {token.authType === 'OAUTH' ? 'ChatGPT自動接続' : `${token.tokenPrefix}…`} / {token.expiresAt ? `期限: ${new Date(token.expiresAt).toLocaleDateString('ja-JP')}` : '手動で解除するまで有効'} / 最終利用: {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString('ja-JP') : '未使用'}
                </p>
              </div>
              {token.revokedAt ? (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">失効済み</span>
              ) : (
                <Button variant="danger" size="sm" onClick={() => revokeToken(token.id)}><Trash2 className="mr-1 h-4 w-4" />失効</Button>
              )}
            </div>
          ))}
          {tokens.length === 0 && <p className="text-sm text-gray-500 dark:text-gray-400">まだAI接続はありません。</p>}
        </div>
      </div>
    </div>
  );
};
