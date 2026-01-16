import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../common/Button';
import { ContactModal } from '../contact/ContactModal';
import { useQueryClient } from '@tanstack/react-query';

type DisplayMode = 'view-only' | 'view-with-add' | 'add-only';

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

  // 表示+追加ボタンモード（将来的に実装）
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
      <p className="text-sm text-gray-500 text-center py-4">
        町民データベースの一覧表示は準備中です
      </p>
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

