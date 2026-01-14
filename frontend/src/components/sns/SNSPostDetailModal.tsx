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
  theme?: string | null;
  followerDelta?: number | null;
  views?: number | null;
  likes?: number | null;
  note?: string | null;
}

interface SNSPostDetailModalProps {
  isOpen: boolean;
  post?: SNSPost | null;
  onClose: () => void;
  onSaved: () => void;
}

export const SNSPostDetailModal: React.FC<SNSPostDetailModalProps> = ({
  isOpen,
  post,
  onClose,
  onSaved,
}) => {
  const [postedAt, setPostedAt] = useState('');
  const [postedTime, setPostedTime] = useState('');
  const [postType, setPostType] = useState<'STORY' | 'FEED'>('STORY');
  const [url, setUrl] = useState('');
  const [theme, setTheme] = useState('');
  const [followerDelta, setFollowerDelta] = useState('');
  const [views, setViews] = useState('');
  const [likes, setLikes] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (post) {
      const date = new Date(post.postedAt);
      setPostedAt(date.toISOString().split('T')[0]);
      setPostedTime(date.toTimeString().slice(0, 5));
      setPostType(post.postType);
      setUrl(post.url || '');
      setTheme(post.theme || '');
      setFollowerDelta(post.followerDelta?.toString() || '');
      setViews(post.views?.toString() || '');
      setLikes(post.likes?.toString() || '');
      setNote(post.note || '');
    } else {
      const now = new Date();
      setPostedAt(now.toISOString().split('T')[0]);
      setPostedTime(now.toTimeString().slice(0, 5));
      setPostType('STORY');
      setUrl('');
      setTheme('');
      setFollowerDelta('');
      setViews('');
      setLikes('');
      setNote('');
    }
  }, [post]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const postedAtDateTime = new Date(`${postedAt}T${postedTime}`);
      const data: any = {
        postedAt: postedAtDateTime.toISOString(),
        postType,
      };

      // 任意項目は値がある場合のみ追加
      if (url.trim()) {
        data.url = url.trim();
      }
      if (theme.trim()) {
        data.theme = theme.trim();
      }
      if (followerDelta && followerDelta !== '') {
        const delta = parseInt(followerDelta, 10);
        if (!isNaN(delta)) {
          data.followerDelta = delta;
        }
      }
      if (views && views !== '') {
        const v = parseInt(views, 10);
        if (!isNaN(v)) {
          data.views = v;
        }
      }
      if (likes && likes !== '') {
        const l = parseInt(likes, 10);
        if (!isNaN(l)) {
          data.likes = l;
        }
      }
      if (note.trim()) {
        data.note = note.trim();
      }

      if (post) {
        await api.put(`/api/sns-posts/${post.id}`, data);
      } else {
        await api.post('/api/sns-posts', data);
      }

      onSaved();
    } catch (error) {
      console.error('Failed to save SNS post:', error);
      alert('保存に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold">
            {post ? '投稿を編集' : '投稿を追加'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="投稿日"
              type="date"
              value={postedAt}
              onChange={(e) => setPostedAt(e.target.value)}
              required
            />
            <Input
              label="投稿時刻"
              type="time"
              value={postedTime}
              onChange={(e) => setPostedTime(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              投稿種別 <span className="text-red-500">*</span>
            </label>
            <select
              value={postType}
              onChange={(e) => setPostType(e.target.value as 'STORY' | 'FEED')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            >
              <option value="STORY">ストーリーズ</option>
              <option value="FEED">フィード</option>
            </select>
          </div>

          <Input
            label="投稿リンク（任意）"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://instagram.com/p/..."
          />

          <Input
            label="テーマ（タイトル、任意）"
            type="text"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="投稿のテーマ"
            maxLength={200}
          />

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="フォロワー増減（任意）"
              type="number"
              value={followerDelta}
              onChange={(e) => setFollowerDelta(e.target.value)}
              placeholder="0"
            />
            <Input
              label="閲覧数（任意）"
              type="number"
              value={views}
              onChange={(e) => setViews(e.target.value)}
              placeholder="0"
              min="0"
            />
            <Input
              label="いいね数（任意）"
              type="number"
              value={likes}
              onChange={(e) => setLikes(e.target.value)}
              placeholder="0"
              min="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              備考（任意）
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="備考・メモ"
              maxLength={2000}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '保存中...' : '保存'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

