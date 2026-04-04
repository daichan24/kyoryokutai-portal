import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../../utils/api';
import { Button } from '../common/Button';
import { Input } from '../common/Input';

interface SNSPost {
  id: string;
  postedAt: string;
  postType: 'STORY' | 'FEED';
  url?: string | null;
  note?: string | null;
  followerCount?: number | null;
}

interface SNSPostDetailModalProps {
  isOpen: boolean;
  post?: SNSPost | null;
  defaultPostType?: 'STORY' | 'FEED';
  defaultPostedDate?: string;
  /** 新規投稿時に紐付けるアカウントID */
  accountId?: string | null;
  /** アカウントのプラットフォーム（種別ラベルの切り替えに使用） */
  platform?: string;
  onClose: () => void;
  onSaved: () => void;
}

/** プラットフォームごとの投稿種別ラベル */
const PLATFORM_POST_TYPES: Record<string, { story: string; feed: string }> = {
  instagram: { story: 'ストーリーズ', feed: 'フィード' },
  twitter:   { story: 'リポスト', feed: 'ポスト' },
  x:         { story: 'リポスト', feed: 'ポスト' },
  tiktok:    { story: 'ライブ', feed: '動画' },
  youtube:   { story: 'ショート', feed: '動画' },
  facebook:  { story: 'ストーリーズ', feed: '投稿' },
  other:     { story: 'その他A', feed: 'その他B' },
};

function getPostTypeLabels(platform?: string): { story: string; feed: string } {
  if (!platform) return { story: 'ストーリーズ', feed: 'フィード' };
  return PLATFORM_POST_TYPES[platform.toLowerCase()] ?? { story: 'ストーリーズ', feed: 'フィード' };
}

export const SNSPostDetailModal: React.FC<SNSPostDetailModalProps> = ({
  isOpen,
  post,
  defaultPostType = 'STORY',
  defaultPostedDate,
  accountId,
  platform,
  onClose,
  onSaved,
}) => {
  const [postedAt, setPostedAt] = useState('');
  const [postType, setPostType] = useState<'STORY' | 'FEED'>('STORY');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [followerCount, setFollowerCount] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const labels = getPostTypeLabels(platform);

  useEffect(() => {
    if (post) {
      const date = new Date(post.postedAt);
      setPostedAt(date.toISOString().split('T')[0]);
      setPostType(post.postType);
      setUrl(post.url || '');
      setNote(post.note || '');
      setFollowerCount(post.followerCount != null ? String(post.followerCount) : '');
    } else {
      const now = new Date();
      setPostedAt(defaultPostedDate || now.toISOString().split('T')[0]);
      setPostType(defaultPostType);
      setUrl('');
      setNote('');
      setFollowerCount('');
    }
  }, [post, defaultPostType, defaultPostedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data: Record<string, unknown> = { postedAt, postType };
      if (url.trim()) data.url = url.trim();
      if (note.trim()) data.note = note.trim();
      const fc = followerCount.trim();
      if (fc !== '') {
        const n = parseInt(fc, 10);
        if (!Number.isNaN(n) && n >= 0) data.followerCount = n;
      } else if (post) {
        data.followerCount = null;
      }

      if (post) {
        await api.put(`/api/sns-posts/${post.id}`, data);
      } else {
        if (accountId) data.accountId = accountId;
        await api.post('/api/sns-posts', data);
      }
      onSaved();
    } catch (error: any) {
      console.error('Failed to save SNS post:', error);
      const errMsg = error.response?.data?.error || error.response?.data?.details || error.message || '不明なエラー';
      alert(`保存に失敗しました: ${typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg)}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h2 className="text-2xl font-bold dark:text-gray-100">{post ? '投稿を編集' : '投稿を記録'}</h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            投稿した日付を選んでください（時刻は不要です）。
          </p>

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
              onChange={(e) => setPostType(e.target.value as 'STORY' | 'FEED')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              required
            >
              <option value="STORY">{labels.story}</option>
              <option value="FEED">{labels.feed}</option>
            </select>
          </div>

          <Input
            label="投稿リンク（任意）"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
          />

          <Input
            label="フォロワー数（任意・その時点の人数）"
            type="number"
            min={0}
            value={followerCount}
            onChange={(e) => setFollowerCount(e.target.value)}
            placeholder="例: 1200"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">備考（任意）</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              maxLength={2000}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
            <Button type="button" variant="outline" onClick={onClose}>キャンセル</Button>
            <Button type="submit" disabled={loading}>{loading ? '保存中...' : '保存'}</Button>
          </div>
        </form>
      </div>
    </div>
  );
};
