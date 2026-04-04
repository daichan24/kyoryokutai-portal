import React, { useState, useEffect } from 'react';
import { X, Trash2 } from 'lucide-react';
import { api } from '../../utils/api';
import { Button } from '../common/Button';

interface SNSAccount {
  id: string;
  platform: string;
  accountName: string;
  displayName?: string | null;
  url?: string | null;
  isDefault: boolean;
}

interface SNSAccountModalProps {
  account?: SNSAccount | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleted?: () => void;
}

export const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'twitter', label: 'X (Twitter)' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'other', label: 'その他' },
];

/** プラットフォームごとの投稿種別ラベル（SNSPostDetailModalと共有） */
export const PLATFORM_POST_TYPES: Record<string, { story: string; feed: string }> = {
  instagram: { story: 'ストーリーズ', feed: 'フィード' },
  twitter:   { story: 'リポスト', feed: 'ポスト' },
  x:         { story: 'リポスト', feed: 'ポスト' },
  tiktok:    { story: 'ライブ', feed: '動画' },
  youtube:   { story: 'ショート', feed: '動画' },
  facebook:  { story: 'ストーリーズ', feed: '投稿' },
  other:     { story: 'その他A', feed: 'その他B' },
};

export function getPostTypeLabels(platform?: string): { story: string; feed: string } {
  if (!platform) return { story: 'ストーリーズ', feed: 'フィード' };
  return PLATFORM_POST_TYPES[platform.toLowerCase()] ?? { story: 'ストーリーズ', feed: 'フィード' };
}

export const SNSAccountModal: React.FC<SNSAccountModalProps> = ({ account, onClose, onSaved, onDeleted }) => {
  const [platform, setPlatform] = useState('instagram');
  const [accountName, setAccountName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [url, setUrl] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const labels = getPostTypeLabels(platform);

  useEffect(() => {
    if (account) {
      setPlatform(account.platform);
      setAccountName(account.accountName);
      setDisplayName(account.displayName || '');
      setUrl(account.url || '');
      setIsDefault(account.isDefault);
    } else {
      setPlatform('instagram');
      setAccountName('');
      setDisplayName('');
      setUrl('');
      setIsDefault(false);
    }
  }, [account]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = {
        platform,
        accountName: accountName.trim(),
        displayName: displayName.trim() || null,
        url: url.trim() || null,
        isDefault,
      };
      if (account) {
        await api.put(`/api/sns-accounts/${account.id}`, data);
      } else {
        await api.post('/api/sns-accounts', data);
      }
      onSaved();
    } catch (e: any) {
      alert(`保存に失敗しました: ${e.response?.data?.error || e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!account) return;
    if (!confirm(`「${account.displayName || account.accountName}」を削除しますか？\nこのアカウントに紐付いた投稿記録は残ります。`)) return;
    setDeleting(true);
    try {
      await api.delete(`/api/sns-accounts/${account.id}`);
      onDeleted?.();
      onSaved();
    } catch (e: any) {
      alert(`削除に失敗しました: ${e.response?.data?.error || e.message}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md m-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-bold dark:text-gray-100">
            {account ? 'SNSアカウント編集' : 'SNSアカウント追加'}
          </h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">プラットフォーム</label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
              required
            >
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            {/* プラットフォームに応じた種別ラベルのプレビュー */}
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              投稿種別: <span className="font-medium text-blue-600 dark:text-blue-400">{labels.story}</span> / <span className="font-medium text-green-600 dark:text-green-400">{labels.feed}</span>
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              アカウント名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="@username"
              required
              maxLength={200}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">表示名（任意）</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="例：長沼町地域おこし協力隊"
              maxLength={200}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">プロフィールURL（任意）</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-sm"
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="rounded"
            />
            <span className="text-gray-700 dark:text-gray-300">デフォルトアカウントに設定</span>
          </label>
          <div className="flex items-center justify-between pt-2">
            {account ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" />
                {deleting ? '削除中...' : 'このアカウントを削除'}
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>キャンセル</Button>
              <Button type="submit" disabled={loading}>{loading ? '保存中...' : '保存'}</Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
