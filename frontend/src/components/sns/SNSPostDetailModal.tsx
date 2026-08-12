import React, { useState, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../../utils/api';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { getPostTypeLabels } from './SNSAccountModal';
import { buildSnsPostPayload, EditableSnsPostType, getSnsPostSaveErrorMessage } from '../../utils/snsPostForm';

interface SNSPost {
  id: string;
  postedAt: string;
  postType: EditableSnsPostType;
  url?: string | null;
  note?: string | null;
  followerCount?: number | null;
}

interface SNSAccountOption {
  id: string;
  platform: string;
  accountName: string;
  displayName?: string | null;
}

interface SNSPostDetailModalProps {
  isOpen: boolean;
  post?: SNSPost | null;
  defaultPostType?: 'STORY' | 'FEED';
  defaultPostedDate?: string;
  /** 新規投稿時に紐付けるアカウントID。undefinedの場合はaccountsから選択 */
  accountId?: string | null;
  /** アカウントのプラットフォーム（種別ラベルの切り替えに使用） */
  platform?: string;
  /** 「すべて」タブ時に表示するアカウント選択肢（accountIdがundefinedの場合に使用） */
  accounts?: SNSAccountOption[];
  onClose: () => void;
  onSaved: () => void;
}

export const SNSPostDetailModal: React.FC<SNSPostDetailModalProps> = ({
  isOpen,
  post,
  defaultPostType = 'STORY',
  defaultPostedDate,
  accountId,
  platform: platformProp,
  accounts,
  onClose,
  onSaved,
}) => {
  const [postedAt, setPostedAt] = useState('');
  const [postType, setPostType] = useState<EditableSnsPostType>('STORY');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [followerCount, setFollowerCount] = useState<string>('');
  const [loading, setLoading] = useState(false);
  // 「すべて」タブ時のアカウント選択
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // 実際に使うプラットフォーム: accountIdが指定されていればそのまま、
  // 「すべて」タブ時は選択中アカウントのプラットフォームを使う
  const effectivePlatform = platformProp
    ?? accounts?.find(a => a.id === selectedAccountId)?.platform;

  const labels = getPostTypeLabels(effectivePlatform);

  // 「すべて」タブかどうか（accountIdがundefinedかつaccountsがある）
  const showAccountSelect = accountId === undefined && accounts && accounts.length > 0;

  useEffect(() => {
    if (post) {
      const date = new Date(post.postedAt);
      setPostedAt(format(date, 'yyyy-MM-dd'));
      setPostType(post.postType);
      setUrl(post.url || '');
      setNote(post.note || '');
      setFollowerCount(post.followerCount != null ? String(post.followerCount) : '');
    } else {
      const now = new Date();
      setPostedAt(defaultPostedDate || format(now, 'yyyy-MM-dd'));
      setPostType(defaultPostType);
      setUrl('');
      setNote('');
      setFollowerCount('');
    }
  }, [post, defaultPostType, defaultPostedDate]);

  // アカウント選択肢が変わったらデフォルトを設定
  useEffect(() => {
    if (showAccountSelect && accounts && accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [showAccountSelect, accounts, selectedAccountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = buildSnsPostPayload({
        existingPost: post,
        postedAt,
        postType,
        url,
        note,
        followerCount,
      });

      if (post) {
        await api.put(`/api/sns-posts/${post.id}`, data);
      } else {
        // アカウントIDを設定
        const finalAccountId = accountId !== undefined ? accountId : selectedAccountId || null;
        if (finalAccountId) data.accountId = finalAccountId;
        await api.post('/api/sns-posts', data);
      }
      onSaved();
    } catch (error: any) {
      console.error('Failed to save SNS post:', error);
      alert(`保存に失敗しました: ${getSnsPostSaveErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h2 className="text-2xl font-bold dark:text-gray-100">{post ? '投稿日を変更' : '投稿日を記録'}</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            投稿日だけで保存できます。リンクやフォロワー数などは必要なときだけ入力してください。
          </p>

          {/* 「すべて」タブ時のアカウント選択 */}
          {showAccountSelect && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                アカウント <span className="text-red-500 dark:text-red-400">*</span>
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                required
              >
                {accounts!.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.displayName || acc.accountName}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Input
            label="投稿した日"
            type="date"
            value={postedAt}
            onChange={(e) => setPostedAt(e.target.value)}
            required
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              種別 <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <select
              value={postType}
              onChange={(e) => setPostType(e.target.value as EditableSnsPostType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              required
            >
              <option value="STORY">{labels.story}</option>
              <option value="FEED">{labels.feed}</option>
              {postType === 'BOTH' && <option value="BOTH">両方（旧形式）</option>}
            </select>
          </div>

          <details className="group rounded-md border border-gray-200 dark:border-gray-700">
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              詳細項目（任意）
              <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
            </summary>
            <div className="space-y-4 border-t border-gray-200 p-3 dark:border-gray-700">
              <Input
                label="投稿リンク"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
              />

              <Input
                label="フォロワー数（その時点の人数）"
                type="number"
                min={0}
                value={followerCount}
                onChange={(e) => setFollowerCount(e.target.value)}
                placeholder="例: 1200"
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">備考</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  maxLength={2000}
                />
              </div>
            </div>
          </details>

          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button type="button" variant="outline" onClick={onClose}>キャンセル</Button>
            <Button type="submit" disabled={loading}>{loading ? '保存中...' : post ? '投稿日を更新' : '記録する'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
};
