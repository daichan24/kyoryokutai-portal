import React, { useState } from 'react';
import { Plus, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { api } from '../../utils/api';
import { Button } from '../common/Button';
import { ContactModal } from '../contact/ContactModal';
import { LoadingSpinner } from '../common/LoadingSpinner';

type DisplayMode = 'view-only' | 'view-with-add' | 'add-only';

interface ContactItem {
  id: string;
  name: string;
  organization?: string | null;
  updatedAt: string;
}

interface ContactsWidgetProps {
  displayMode?: DisplayMode;
  showAddButton?: boolean;
  onAddClick?: () => void;
}

export const ContactsWidget: React.FC<ContactsWidgetProps> = ({
  displayMode = 'add-only',
  showAddButton = true,
  onAddClick,
}) => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: recentContacts = [], isLoading } = useQuery<ContactItem[]>({
    queryKey: ['contacts-recent'],
    queryFn: async () => {
      const res = await api.get('/api/citizens?orderBy=updatedAt&limit=10');
      return (res.data || []).map((c: any) => ({
        id: c.id,
        name: c.name,
        organization: c.organization ?? null,
        updatedAt: c.updatedAt,
      }));
    },
    enabled: displayMode === 'view-only' || displayMode === 'view-with-add',
  });

  const handleAddClick = () => {
    if (onAddClick) {
      onAddClick();
    } else {
      setIsModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleSaved = () => {
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
    queryClient.invalidateQueries({ queryKey: ['contacts-recent'] });
    handleCloseModal();
  };

  // 追加ボタンのみモード
  if (displayMode === 'add-only') {
    return (
      <>
        <div className="bg-white rounded-lg shadow border border-border p-6 flex items-center justify-center min-h-[200px]">
          <Button onClick={handleAddClick} className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            町民データベースに追加
          </Button>
        </div>
        {isModalOpen && (
          <ContactModal
            contact={null}
            onClose={handleCloseModal}
            onSaved={handleSaved}
          />
        )}
      </>
    );
  }

  // 表示のみ / 表示+追加ボタン: 直近で更新された人を表示
  return (
    <div className="bg-white rounded-lg shadow border border-border p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-900">町民データベース</h3>
        {showAddButton && (
          <Button size="sm" onClick={handleAddClick} className="flex items-center gap-1">
            <Plus className="w-4 h-4" />
            追加
          </Button>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-2">直近で更新された人</p>
      {isLoading ? (
        <div className="py-6 flex justify-center">
          <LoadingSpinner />
        </div>
      ) : recentContacts.length === 0 ? (
        <p className="text-sm text-gray-500 py-4 text-center">登録がありません</p>
      ) : (
        <ul className="space-y-1.5">
          {recentContacts.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-100 last:border-0">
              <div className="min-w-0 flex-1">
                <span className="font-medium text-gray-900 truncate block">{c.name}</span>
                {c.organization && (
                  <span className="text-xs text-gray-500 truncate block">{c.organization}</span>
                )}
              </div>
              <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                {formatDistanceToNow(new Date(c.updatedAt), { addSuffix: true, locale: ja })}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 pt-2 border-t border-gray-100">
        <Link
          to="/contacts"
          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
        >
          一覧を見る
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      {isModalOpen && (
        <ContactModal
          contact={null}
          onClose={handleCloseModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

