import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../../utils/api';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Wish, WishStatus, WishDifficulty, WishEstimate, WishPriority } from '../../types';

interface WishModalProps {
  wish?: Wish | null;
  onClose: () => void;
  onSaved: () => void;
}

const CATEGORY_SUGGESTIONS = [
  '体験（旅・イベント）',
  '学び（資格・読書・スキル）',
  '健康（運動・食・睡眠）',
  '仕事（収益・制作・発信）',
  '人間関係（家族・友人・地域）',
  'お金（貯蓄・投資・買い物）',
  '生活（家・整理・ルーティン）',
  '創作（動画・文章・作品）',
  '地域貢献（協力隊活動・企画）',
  'その他',
];

export const WishModal: React.FC<WishModalProps> = ({
  wish,
  onClose,
  onSaved,
}) => {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<WishStatus>('ACTIVE');
  const [difficulty, setDifficulty] = useState<WishDifficulty | ''>('');
  const [estimate, setEstimate] = useState<WishEstimate | ''>('');
  const [priority, setPriority] = useState<WishPriority | ''>('');
  const [dueMonth, setDueMonth] = useState<number | ''>('');
  const [dueYear, setDueYear] = useState<number>(new Date().getFullYear());
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (wish) {
      setTitle(wish.title);
      setCategory(wish.category || '');
      setStatus(wish.status);
      setDifficulty(wish.difficulty || '');
      setEstimate(wish.estimate || '');
      setPriority(wish.priority || '');
      setDueMonth(wish.dueMonth || '');
      setTags(wish.tags || []);
      setMemo(wish.memo || '');
    } else {
      setTitle('');
      setCategory('');
      setStatus('ACTIVE');
      setDifficulty('');
      setEstimate('');
      setPriority('');
      setDueMonth('');
      setTags([]);
      setMemo('');
    }
  }, [wish]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      alert('タイトルを入力してください');
      return;
    }

    setLoading(true);
    try {
      const data: any = {
        title: title.trim(),
        category: category || undefined,
        status,
        difficulty: difficulty || undefined,
        estimate: estimate || undefined,
        priority: priority || undefined,
        dueMonth: dueMonth ? Number(dueMonth) : undefined,
        tags,
        memo: memo || undefined,
      };

      if (wish) {
        await api.put(`/api/wishes/${wish.id}`, data);
      } else {
        await api.post('/api/wishes', data);
      }
      onSaved();
    } catch (error: any) {
      console.error('Failed to save wish:', error);
      alert(`保存に失敗しました: ${error?.response?.data?.error || error?.message || '不明なエラー'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h2 className="text-2xl font-bold dark:text-gray-100">
            {wish ? 'やりたいことを編集' : 'やりたいことを追加'}
          </h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input
            label="タイトル *"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="やりたいことを短く入力"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              カテゴリ
            </label>
            <div className="flex gap-2">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="">選択しない</option>
                {CATEGORY_SUGGESTIONS.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="または自由入力"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                ステータス
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as WishStatus)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="ACTIVE">進行中</option>
                <option value="DONE">完了</option>
                <option value="PAUSED">中断</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                難易度
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDifficulty(difficulty === 'EASY' ? '' : 'EASY')}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    difficulty === 'EASY'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  簡単
                </button>
                <button
                  type="button"
                  onClick={() => setDifficulty(difficulty === 'MEDIUM' ? '' : 'MEDIUM')}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    difficulty === 'MEDIUM'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  普通
                </button>
                <button
                  type="button"
                  onClick={() => setDifficulty(difficulty === 'HARD' ? '' : 'HARD')}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    difficulty === 'HARD'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  難しい
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                所要感
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEstimate(estimate === 'S' ? '' : 'S')}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    estimate === 'S'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  短
                </button>
                <button
                  type="button"
                  onClick={() => setEstimate(estimate === 'M' ? '' : 'M')}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    estimate === 'M'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  中
                </button>
                <button
                  type="button"
                  onClick={() => setEstimate(estimate === 'L' ? '' : 'L')}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    estimate === 'L'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  長
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                優先度
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPriority(priority === 'LOW' ? '' : 'LOW')}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    priority === 'LOW'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  低
                </button>
                <button
                  type="button"
                  onClick={() => setPriority(priority === 'MID' ? '' : 'MID')}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    priority === 'MID'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  中
                </button>
                <button
                  type="button"
                  onClick={() => setPriority(priority === 'HIGH' ? '' : 'HIGH')}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    priority === 'HIGH'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  高
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              期限
            </label>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">年度:</span>
                <select
                  value={dueYear}
                  onChange={(e) => setDueYear(parseInt(e.target.value, 10))}
                  className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  {Array.from({ length: 5 }, (_, i) => {
                    const year = new Date().getFullYear() - 1 + i;
                    return (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">期限月:</div>
              <div className="grid grid-cols-6 gap-2">
                {Array.from({ length: 12 }, (_, i) => {
                  const month = i + 1;
                  return (
                    <button
                      key={month}
                      type="button"
                      onClick={() => setDueMonth(dueMonth === month ? '' : month)}
                      className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        dueMonth === month
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {month}月
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              タグ
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTag();
                  }
                }}
                placeholder="タグを入力してEnter"
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
              <Button type="button" onClick={handleAddTag} variant="outline">
                追加
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              メモ
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="メモを入力..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
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

