import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { useAuthStore } from '../../stores/authStore';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { Plus, X } from 'lucide-react';

interface SNSLink {
  platform: string;
  url: string | null;
}

const AVATAR_COLOR_PRESETS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];

export const ProfileSettings: React.FC = () => {
  const { user, fetchMe } = useAuthStore();
  const queryClient = useQueryClient();
  const [snsLinks, setSnsLinks] = useState<SNSLink[]>([]);
  const [darkMode, setDarkMode] = useState(false);
  const [avatarColor, setAvatarColor] = useState('#3B82F6');
  const [avatarLetter, setAvatarLetter] = useState('');

  useEffect(() => {
    if (user) {
      setDarkMode(!!user.darkMode);
      setAvatarColor(user.avatarColor || '#3B82F6');
      setAvatarLetter(user.avatarLetter ?? '');
    }
  }, [user]);

  const { data: currentLinks, isLoading } = useQuery<SNSLink[]>({
    queryKey: ['sns-links', user?.id],
    queryFn: async () => {
      const response = await api.get('/api/me/sns-links');
      return response.data || [];
    },
  });

  useEffect(() => {
    if (currentLinks) {
      setSnsLinks(currentLinks.length > 0 ? [...currentLinks] : [{ platform: '', url: '' }]);
    }
  }, [currentLinks]);

  const profileMutation = useMutation({
    mutationFn: async (data: { avatarColor?: string; avatarLetter?: string | null; darkMode?: boolean }) => {
      const response = await api.put('/api/me/profile', data);
      return response.data;
    },
    onSuccess: async () => {
      await fetchMe();
      alert('表示設定を保存しました');
    },
    onError: (error: any) => {
      console.error('Failed to save profile:', error);
      const errorMessage = error?.response?.data?.error || error?.response?.data?.details?.[0]?.message || error?.message || '表示設定の保存に失敗しました';
      alert(`保存に失敗しました: ${errorMessage}`);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (links: SNSLink[]) => {
      return api.put('/api/me/sns-links', links);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sns-links'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      alert('保存しました');
    },
    onError: (error: any) => {
      console.error('Failed to save SNS links:', error);
      alert('保存に失敗しました');
    },
  });

  const handleAddLink = () => {
    setSnsLinks([...snsLinks, { platform: '', url: '' }]);
  };

  const handleRemoveLink = (index: number) => {
    setSnsLinks(snsLinks.filter((_, i) => i !== index));
  };

  const handlePlatformChange = (index: number, platform: string) => {
    const updated = [...snsLinks];
    updated[index].platform = platform;
    setSnsLinks(updated);
  };

  const handleUrlChange = (index: number, url: string) => {
    const updated = [...snsLinks];
    updated[index].url = url;
    setSnsLinks(updated);
  };

  const handleSaveProfile = () => {
    profileMutation.mutate({
      darkMode: darkMode,
      avatarColor: avatarColor,
      avatarLetter: avatarLetter === '' ? null : avatarLetter.slice(0, 1),
    });
  };

  const handleSave = () => {
    const validLinks = snsLinks
      .filter((link) => link.platform.trim() !== '')
      .map((link) => ({
        platform: link.platform.trim(),
        url: link.url?.trim() || null,
      }));
    saveMutation.mutate(validLinks);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">プロフィール設定</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">表示設定とSNSリンクを設定できます</p>
      </div>

      {/* 表示設定: ダークモード・アイコン色・アイコン1文字 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">表示設定</h2>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">ダークモード</label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={darkMode}
                onChange={(e) => setDarkMode(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
              <span className="ms-3 text-sm text-gray-600 dark:text-gray-400">{darkMode ? 'ON' : 'OFF'}</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">アイコンの色</label>
            <div className="flex flex-wrap gap-2 items-center">
              {AVATAR_COLOR_PRESETS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAvatarColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition ${avatarColor === c ? 'border-gray-900 dark:border-white scale-110' : 'border-gray-200 dark:border-gray-600 hover:border-gray-400'}`}
                  style={{ backgroundColor: c }}
                  aria-label={`色 ${c}`}
                />
              ))}
              <label className="flex items-center gap-2 ml-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">カスタム:</span>
                <input
                  type="color"
                  value={avatarColor}
                  onChange={(e) => setAvatarColor(e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border border-gray-300 dark:border-gray-600"
                />
              </label>
            </div>
          </div>

          <div className="max-w-xs">
            <Input
              label="アイコンの文字（1文字）"
              type="text"
              maxLength={1}
              value={avatarLetter}
              onChange={(e) => setAvatarLetter(e.target.value)}
              placeholder={user?.name?.charAt(0) || '未設定時は名前の頭文字'}
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">空欄の場合は名前の頭文字が表示されます</p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-medium flex-shrink-0"
              style={{ backgroundColor: avatarColor }}
            >
              {(avatarLetter || user?.name || '').charAt(0)}
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">プレビュー</span>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSaveProfile} disabled={profileMutation.isPending}>
            {profileMutation.isPending ? '保存中...' : '表示設定を保存'}
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">SNSリンク</h2>

        <div className="space-y-4">
          {snsLinks.map((link, index) => (
            <div key={index} className="flex gap-3 items-start">
              <div className="flex-1">
                <Input
                  label="プラットフォーム"
                  type="text"
                  value={link.platform}
                  onChange={(e) => handlePlatformChange(index, e.target.value)}
                  placeholder="例: Instagram"
                />
              </div>
              <div className="flex-1">
                <Input
                  label="URL"
                  type="url"
                  value={link.url || ''}
                  onChange={(e) => handleUrlChange(index, e.target.value)}
                  placeholder="https://instagram.com/..."
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => handleRemoveLink(index)}
                  className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                  disabled={snsLinks.length === 1}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4">
          <Button variant="outline" onClick={handleAddLink} className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            リンクを追加
          </Button>
        </div>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? '保存中...' : '保存'}
          </Button>
        </div>
      </div>
    </div>
  );
};

