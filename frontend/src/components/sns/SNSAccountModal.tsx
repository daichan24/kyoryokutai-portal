import React, { useState, useEffect } from 'react';
import { X, Instagram, Twitter, Globe } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
}

const PLATFORMS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'twitter', label: 'X (Twitter)' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'other', label: 'その他' },
];

export const SNSAccountModal: React.FC<SNSAccountModalProps> = ({ account, onClose, onSaved }) => {
  const queryClient = useQueryClient();
  const [platform, setPlatform] = useState('instagram');
  const [accountName, setAccountName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [url, setUrl] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (account) {
      setPlatform(account.platform);
      setAccountName(account.accountName);
      setDisplayName(account.displayName || '');
      setUrl(account.url || '');
      setIsDefault(account.isDefault);
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
      queryClient.invalidateQueries({ queryKey: ['sns-accounts'] });
      onSaved();
    } catch (e: any) {
      alert(`保存に失敗しました: ${e.response?.data?.error || e.message}`);
    } finally {
      setLoading(false);
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
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>キャンセル</Button>
            <Button type="submit" disabled={loading}>{loading ? '保存中...' : '保存'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
};
