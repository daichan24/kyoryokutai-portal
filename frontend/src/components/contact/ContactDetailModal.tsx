import React, { useState, useEffect } from 'react';
import { X, Edit2, Plus } from 'lucide-react';
import { api } from '../../utils/api';
import { format } from 'date-fns';
import { Button } from '../common/Button';
import { ContactHistoryModal } from './ContactHistoryModal';

interface Contact {
  id: string;
  name: string;
  organization?: string;
  category?: string;
  relatedMembers?: string[];
  relationshipType?: '協力的' | '要注意' | '未知' | '未登録';
  memo?: string;
  tags: string[];
  role?: '現役' | 'OB' | 'サポート' | '役場';
  startYear?: number;
  endYear?: number;
  instagramUrl?: string;
  status?: '在籍中' | '任期終了';
  histories: ContactHistory[];
}

interface ContactHistory {
  id: string;
  date: string;
  content: string;
  user: { id: string; name: string };
  project?: { id: string; projectName: string };
}

interface ContactDetailModalProps {
  contact: Contact;
  onClose: () => void;
  onEdit: () => void;
  onHistoryAdded: () => void;
  onDeleted: () => void;
}

export const ContactDetailModal: React.FC<ContactDetailModalProps> = ({
  contact,
  onClose,
  onEdit,
  onHistoryAdded,
  onDeleted,
}) => {
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [contactData, setContactData] = useState<Contact>(contact);
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    // 最新のデータを取得
    const fetchContact = async () => {
      try {
        const response = await api.get(`/api/citizens/${contact.id}`);
        setContactData(response.data);
      } catch (error) {
        console.error('Failed to fetch contact:', error);
      }
    };
    fetchContact();

    // ユーザー一覧を取得（名前解決用）
    const fetchUsers = async () => {
      try {
        const response = await api.get('/api/users');
        setUsers(response.data || []);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      }
    };
    fetchUsers();
  }, [contact.id]);

  const handleAddHistory = () => {
    setIsHistoryModalOpen(true);
  };

  const handleHistorySaved = () => {
    onHistoryAdded();
    setIsHistoryModalOpen(false);
    // データを再取得
    const fetchContact = async () => {
      try {
        const response = await api.get(`/api/citizens/${contact.id}`);
        setContactData(response.data);
      } catch (error) {
        console.error('Failed to fetch contact:', error);
      }
    };
    fetchContact();
  };

  const handleDelete = async () => {
    if (!window.confirm('本当にこの町民情報を削除しますか？\n（関連する履歴も削除されます）')) {
      return;
    }
    try {
      await api.delete(`/api/citizens/${contact.id}`);
      onDeleted();
    } catch (error) {
      console.error('Failed to delete contact:', error);
      alert('削除に失敗しました');
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-3xl w-full m-4 max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center p-6 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
            <h2 className="text-2xl font-bold dark:text-gray-100">町民情報詳細</h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddHistory}
              >
                <Plus className="h-4 w-4 mr-1" />
                履歴追加
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={onEdit}
              >
                <Edit2 className="h-4 w-4 mr-1" />
                編集
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleDelete}
              >
                削除
              </Button>
              <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 ml-2">
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* 基本情報 */}
            <div>
              <h3 className="text-lg font-bold mb-4 dark:text-gray-100">基本情報</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">名前</span>
                  <p className="text-gray-900 dark:text-gray-100 font-semibold">{contactData.name}</p>
                </div>
                {contactData.organization && (
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">所属</span>
                    <p className="text-gray-900 dark:text-gray-100">{contactData.organization}</p>
                  </div>
                )}
                {contactData.category && (
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">ジャンル</span>
                    <p className="text-gray-900 dark:text-gray-100">{contactData.category}</p>
                  </div>
                )}


                {contactData.role && (
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">種別</span>
                    <p className="text-gray-900 dark:text-gray-100">{contactData.role}</p>
                  </div>
                )}
                {(contactData.startYear || contactData.endYear) && (
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">任期</span>
                    <p className="text-gray-900 dark:text-gray-100">
                      {contactData.startYear || '?'}年 ～ {contactData.endYear || '現在'}
                    </p>
                  </div>
                )}
                {contactData.status && (
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">ステータス</span>
                    <p>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        contactData.status === '在籍中' 
                          ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                      }`}>
                        {contactData.status}
                      </span>
                    </p>
                  </div>
                )}
                {contactData.instagramUrl && (
                  <div>
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Instagram</span>
                    <p>
                      <a 
                        href={contactData.instagramUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        <span className="text-sm">プロフィールを表示</span>
                      </a>
                    </p>
                  </div>
                )}
              </div>
              {contactData.relatedMembers && contactData.relatedMembers.length > 0 && (
                <div className="mt-4">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">関わった協力隊</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {contactData.relatedMembers.map((memberId) => {
                      const member = users.find(u => u.id === memberId);
                      return (
                        <span key={memberId} className="text-xs px-2 py-1 bg-blue-50 dark:bg-blue-900/30 rounded text-blue-700 dark:text-blue-300">
                          {member ? member.name : '不明なメンバー'}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
              {contactData.tags.length > 0 && (
                <div className="mt-4">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">タグ</span>
                  <div className="flex gap-2 mt-1">
                    {contactData.tags.map((tag) => (
                      <span key={tag} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-800 dark:text-gray-200">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {contactData.memo && (
                <div className="mt-4">
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">備考</span>
                  <p className="text-gray-900 dark:text-gray-100 whitespace-pre-line mt-1">{contactData.memo}</p>
                </div>
              )}
            </div>

            {/* 接触履歴 */}
            <div>
              <h3 className="text-lg font-bold mb-4 dark:text-gray-100">接触履歴 ({contactData.histories?.length || 0}件)</h3>
              {contactData.histories && contactData.histories.length > 0 ? (
                <div className="space-y-3">
                  {contactData.histories.map((history) => (
                    <div key={history.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-700/50">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {format(new Date(history.date), 'yyyy年M月d日')}
                          </span>
                          {history.project && (
                            <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
                              （{history.project.projectName}）
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-400">{history.user.name}</span>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-line">{history.content}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">接触履歴がありません</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {isHistoryModalOpen && (
        <ContactHistoryModal
          contactId={contact.id}
          onClose={() => setIsHistoryModalOpen(false)}
          onSaved={handleHistorySaved}
        />
      )}
    </>
  );
};

