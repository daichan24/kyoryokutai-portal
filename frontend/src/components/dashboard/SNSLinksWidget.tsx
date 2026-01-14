import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { useAuthStore } from '../../stores/authStore';
import { ExternalLink, Instagram } from 'lucide-react';

interface SNSLink {
  platform: string;
  url: string | null;
}

export const SNSLinksWidget: React.FC = () => {
  const { user } = useAuthStore();

  const { data: snsLinks, isLoading } = useQuery<SNSLink[]>({
    queryKey: ['sns-links', user?.id],
    queryFn: async () => {
      const response = await api.get('/api/me/sns-links');
      return response.data || [];
    },
  });

  if (isLoading || !snsLinks || snsLinks.length === 0) {
    return null;
  }

  const validLinks = snsLinks.filter((link) => link.url && link.url.trim() !== '');

  if (validLinks.length === 0) {
    return null;
  }

  const getPlatformIcon = (platform: string) => {
    const lower = platform.toLowerCase();
    if (lower.includes('instagram')) {
      return <Instagram className="w-4 h-4" />;
    }
    return <ExternalLink className="w-4 h-4" />;
  };

  return (
    <div className="bg-white rounded-lg shadow border border-border p-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-3">SNSリンク</h3>
      <div className="space-y-2">
        {validLinks.map((link, index) => (
          <a
            key={index}
            href={link.url!}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-2 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
          >
            {getPlatformIcon(link.platform)}
            <span className="text-sm text-gray-700">{link.platform}</span>
            <ExternalLink className="w-3 h-3 ml-auto text-gray-400" />
          </a>
        ))}
      </div>
    </div>
  );
};

