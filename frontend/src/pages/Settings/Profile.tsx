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

export const ProfileSettings: React.FC = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [snsLinks, setSnsLinks] = useState<SNSLink[]>([]);

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
        <h1 className="text-3xl font-bold text-gray-900">プロフィール設定</h1>
        <p className="mt-2 text-gray-600">SNSリンクを設定できます</p>
      </div>

      <div className="bg-white rounded-lg shadow border border-border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">SNSリンク</h2>

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

