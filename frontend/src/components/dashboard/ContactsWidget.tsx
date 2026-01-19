import React, { useState } from 'react';
import { Plus, ChevronRight, History } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { ja } from 'date-fns/locale';
import { api } from '../../utils/api';
import { Button } from '../common/Button';
import { ContactModal } from '../contact/ContactModal';
import { ContactHistoryModal } from '../contact/ContactHistoryModal';
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
  contactCount?: number; // 1〜3名まで
}

export const ContactsWidget: React.FC<ContactsWidgetProps> = ({
  displayMode = 'add-only',
  showAddButton = true,
  onAddClick,
  contactCount = 3,
}) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  const { data: recentContacts = [], isLoading } = useQuery<ContactItem[]>({
    queryKey: ['contacts-recent', contactCount],
    queryFn: async () => {
      const limit = Math.max(1, Math.min(3, contactCount || 3)); // 1〜3名に制限
      const res = await api.get(`/api/citizens?orderBy=updatedAt&limit=${limit}`);
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

  const handleHistorySaved = () => {
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
    queryClient.invalidateQueries({ queryKey: ['contacts-recent'] });
    setIsHistoryModalOpen(false);
    setSelectedContactId(null);
  };

  const handleContactClick = (contactId: string) => {
    // 町民データベースカテゴリの当該町民の詳細ページへ飛ぶ
    navigate(`/contacts?contactId=${contactId}`);
  };

  const handleAddHistory = (e: React.MouseEvent, contactId: string) => {
    e.stopPropagation(); // クリックイベントの伝播を防ぐ
    setSelectedContactId(contactId);
    setIsHistoryModalOpen(true);
  };

  // 追加ボタンのみモード
  if (displayMode === 'add-only') {
    return (
      <>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6 flex items-center justify-center min-h-[200px]">
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
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">町民データベース</h3>
        {showAddButton && (
          <Button size="sm" onClick={handleAddClick} className="flex items-center gap-1">
            <Plus className="w-4 h-4" />
            追加
          </Button>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">直近で更新された人</p>
      {isLoading ? (
        <div className="py-6 flex justify-center">
          <LoadingSpinner />
        </div>
      ) : recentContacts.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">登録がありません</p>
      ) : (
        <ul className="space-y-1.5">
          {recentContacts.map((c) => (
            <li 
              key={c.id} 
              className="flex items-center justify-between gap-2 py-1.5 border-b border-gray-100 dark:border-gray-700 last:border-0 group cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded px-2 -mx-2"
              onClick={() => handleContactClick(c.id)}
            >
              <div className="min-w-0 flex-1">
                <span className="font-medium text-gray-900 dark:text-gray-100 truncate block">{c.name}</span>
                {c.organization && (
                  <span className="text-xs text-gray-500 dark:text-gray-400 truncate block">{c.organization}</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={(e) => handleAddHistory(e, c.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  title="履歴追加"
                >
                  <History className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                </button>
                <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                  {formatDistanceToNow(new Date(c.updatedAt), { addSuffix: true, locale: ja })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-700">
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
      {isHistoryModalOpen && selectedContactId && (
        <ContactHistoryModal
          contactId={selectedContactId}
          onClose={() => {
            setIsHistoryModalOpen(false);
            setSelectedContactId(null);
          }}
          onSaved={handleHistorySaved}
        />
      )}
    </div>
  );
};

