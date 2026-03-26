import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Megaphone } from 'lucide-react';
import { api } from '../../utils/api';
import { useAuthStore } from '../../stores/authStore';

export const AnnouncementBanner: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const { data } = useQuery({
    queryKey: ['announcements', 'unread-count'],
    queryFn: async () => {
      const r = await api.get<{ count: number }>('/api/announcements/unread-count');
      return r.data;
    },
    enabled: user?.role === 'MEMBER',
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (user?.role !== 'MEMBER' || !data?.count) return null;

  return (
    <Link
      to="/announcements"
      className="block w-full border-b border-amber-200/80 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/40 px-4 py-2.5 text-center text-sm font-medium text-amber-900 dark:text-amber-100 hover:bg-amber-100/90 dark:hover:bg-amber-950/70 transition-colors"
    >
      <span className="inline-flex items-center justify-center gap-2 flex-wrap">
        <Megaphone className="h-4 w-4 shrink-0" aria-hidden />
        <span>
          未読のお知らせが <strong>{data.count}</strong> 件あります。タップして確認
        </span>
      </span>
    </Link>
  );
};
