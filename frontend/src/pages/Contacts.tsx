import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { api } from '../utils/api';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { ContactModal } from '../components/contact/ContactModal';
import { ContactHistoryModal } from '../components/contact/ContactHistoryModal';
import { ContactDetailModal } from '../components/contact/ContactDetailModal';
import { Button } from '../components/common/Button';
import { useAuthStore } from '../stores/authStore';
import { LayoutGrid, List, HelpCircle, X, Trash2, Instagram } from 'lucide-react';

interface Contact {
  id: string;
  name: string;
  organization?: string;
  category?: string; // ジャンル
  relatedMembers?: string[]; // 関わった協力隊
  relationshipType?: '協力的' | '要注意' | '未知' | '未登録'; // 関わり方
  memo?: string; // 備考
  tags: string[];
  // 協力隊メンバー情報（新規追加）
  role?: '現役' | 'OB' | 'サポート' | '役場';
  startYear?: number;
  endYear?: number;
  instagramUrl?: string;
  status?: '在籍中' | '任期終了'; // APIで計算される
  histories: ContactHistory[];
  creator?: { id: string; name: string };
  createdAt?: string;
}

interface ContactHistory {
  id: string;
  date: string;
  content: string;
  user: { id: string; name: string };
  project?: { id: string; projectName: string };
}

export const Contacts: React.FC = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>(''); // ジャンルでフィルタ
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'nameAsc'>('newest'); // ソート順
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card'); // カード/リスト表示切り替え
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [users, setUsers] = useState<any[]>([]);

  // 【データ取得】UIイベント → API → DB の流れ
  // useQueryが自動的にGET /api/citizensを呼び出す
  const { data: contacts, isLoading } = useQuery<Contact[]>({
    queryKey: ['contacts'],
    queryFn: async () => {
      console.log('🔵 [UI] 町民一覧を取得中...');
      const response = await api.get('/api/citizens');
      console.log('✅ [UI] 町民一覧取得成功:', response.data?.length, '件');
      return response.data;
    }
  });

  // ユーザー一覧を取得（名前解決用）
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api.get('/api/users');
        setUsers(response.data || []);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      }
    };
    fetchUsers();
  }, []);

  // URLパラメータからcontactIdを取得して、自動的に詳細モーダルを開く
  useEffect(() => {
    const contactId = searchParams.get('contactId');
    if (!contactId || !contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return;
    }
    
    const contact = contacts.find(c => c && c.id === contactId);
    if (contact) {
      setSelectedContact(contact);
      setIsDetailModalOpen(true);
      // URLパラメータをクリア
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, contacts]);

  const filteredContacts = contacts?.filter(contact => {
    const matchesSearch = 
      contact.name.includes(searchTerm) || 
      contact.organization?.includes(searchTerm) ||
      false;
    const matchesTag = !selectedTag || contact.tags.includes(selectedTag);
    const matchesCategory = !filterCategory || contact.category === filterCategory;
    return matchesSearch && matchesTag && matchesCategory;
  })?.sort((a, b) => {
    if (sortOrder === 'nameAsc') {
      return a.name.localeCompare(b.name, 'ja');
    }
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (sortOrder === 'oldest') {
      return dateA - dateB;
    }
    // デフォルト newest
    return dateB - dateA;
  });

  // ソート用のユニークな値リストを取得
  const categories = Array.from(new Set(contacts?.map(c => c.category).filter(Boolean) || []));

  // 【UIイベント定義】「町民を追加する」ボタンのonClickイベント
  // カレンダーの実装パターンに合わせて関数として定義
  const handleCreateContact = () => {
    console.log('CLICK NEW CONTACT');
    setSelectedContact(null);
    setIsModalOpen(true);
  };


  const handleViewDetail = (contact: Contact) => {
    setSelectedContact(contact);
    setIsDetailModalOpen(true);
  };

  const handleEditContact = (contact: Contact) => {
    setSelectedContact(contact);
    setIsModalOpen(true);
    setIsDetailModalOpen(false);
  };

  const handleAddHistory = (contact: Contact) => {
    setSelectedContact(contact);
    setIsHistoryModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedContact(null);
  };

  const handleCloseHistoryModal = () => {
    setIsHistoryModalOpen(false);
    setSelectedContact(null);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedContact(null);
  };

  // 【UIイベント定義】保存成功時のコールバック
  // カレンダーの実装パターンに合わせて、invalidateQueries + handleCloseModal
  const handleSaved = () => {
    console.log('🔵 [UI] 保存成功: 一覧を再取得します');
    queryClient.invalidateQueries({ queryKey: ['contacts'] }); // 一覧を再取得（即時反映）
    handleCloseModal(); // モーダルを閉じる（stateで制御）
    console.log('✅ [UI] 一覧再取得完了、モーダルを閉じました');
  };

  const handleHistorySaved = () => {
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
    handleCloseHistoryModal();
    if (isDetailModalOpen && selectedContact) {
      const fetchContact = async () => {
        try {
          const response = await api.get(`/api/citizens/${selectedContact.id}`);
          setSelectedContact(response.data);
        } catch (error) {
          console.error('Failed to fetch contact:', error);
        }
      };
      fetchContact();
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/citizens/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  const handleDeleteContact = (contact: Contact) => {
    if (!confirm(`「${contact.name}」を削除しますか？この操作は取り消せません。`)) return;
    deleteMutation.mutate(contact.id);
    if (isDetailModalOpen) handleCloseDetailModal();
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
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">町民データベース</h1>
          <button
            type="button"
            onClick={() => setIsGuideOpen(true)}
            className="p-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            title="使い方を表示"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 border border-gray-300 rounded-lg">
            <button
              onClick={() => setViewMode('card')}
              className={`p-2 ${viewMode === 'card' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              title="カード表示"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
              title="リスト表示"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <Button onClick={handleCreateContact} data-testid="citizens-new">
            <Plus className="h-4 w-4 mr-2" />
            新規登録
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <input
          type="text"
          placeholder="名前・組織で検索"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 min-w-[200px] border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">全てのジャンル</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <select
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value)}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">全てのタグ</option>
          <option value="協力的">協力的</option>
          <option value="要注意">要注意</option>
          <option value="専門家">専門家</option>
        </select>
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as 'newest' | 'oldest' | 'nameAsc')}
          className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="newest">登録日（新しい順）</option>
          <option value="oldest">登録日（古い順）</option>
          <option value="nameAsc">名前（五十音順）</option>
        </select>
      </div>

      {/* 【一覧表示】カード/リスト表示切り替え */}
      {viewMode === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContacts?.map((contact) => (
            <div key={contact.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-lg text-gray-900 dark:text-gray-100">{contact.name}</h3>
                  {contact.instagramUrl && (
                    <a 
                      href={contact.instagramUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-pink-600 hover:text-pink-700 dark:text-pink-400 dark:hover:text-pink-300 transition-colors"
                      title="Instagramプロフィールを表示"
                    >
                      <Instagram className="h-5 w-5" />
                    </a>
                  )}
                </div>
                {contact.tags.length > 0 && (
                  <div className="flex gap-1">
                    {contact.tags.map((tag) => (
                      <span key={tag} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* ジャンル */}
              {contact.category && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  <span className="font-medium">ジャンル:</span> {contact.category}
                </p>
              )}

              {/* 関わった協力隊 */}
              {contact.relatedMembers && contact.relatedMembers.length > 0 && (
                <p className="text-sm mb-2">
                  <span className="font-medium">関わった協力隊:</span>{' '}
                  {contact.relatedMembers.map((memberId, i) => {
                    const member = users.find(u => u.id === memberId);
                    return (
                      <span key={memberId} className="text-gray-600 dark:text-gray-400">
                        {i > 0 ? '、' : ''}{member ? member.name : memberId}
                      </span>
                    );
                  })}
                </p>
              )}

              {/* 所属 */}
              {contact.role && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  <span className="font-medium">所属:</span> {contact.role}
                </p>
              )}

              {/* 任期 */}
              {(contact.startYear || contact.endYear) && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  <span className="font-medium">任期:</span>{' '}
                  {contact.startYear || '?'}年 ～ {contact.endYear || '現在'}
                </p>
              )}

              {/* ステータス */}
              {contact.status && (
                <p className="text-sm mb-2">
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    contact.status === '在籍中' 
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                  }`}>
                    {contact.status}
                  </span>
                </p>
              )}

              {contact.organization && (
                <p className="text-sm text-gray-600 dark:text-gray-400">{contact.organization}</p>
              )}

              {contact.memo && (
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 line-clamp-2">
                  {contact.memo}
                </p>
              )}

              <div className="flex justify-between items-center mt-3 pt-3 border-t dark:border-gray-700">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    接触履歴: {contact.histories.length}件
                  </span>
                  {contact.creator && (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      登録: {contact.creator.name}
                    </span>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddHistory(contact)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    履歴追加
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleViewDetail(contact)}
                  >
                    詳細
                  </Button>
                  <button
                    onClick={() => handleDeleteContact(contact)}
                    className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    title="削除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">名前</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">所属</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">ジャンル</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Instagram</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">接触履歴</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">登録者</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredContacts?.map((contact) => (
                <tr key={contact.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{contact.name}</div>
                      {contact.tags.length > 0 && (
                        <div className="ml-2 flex gap-1">
                          {contact.tags.slice(0, 2).map((tag) => (
                            <span key={tag} className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {contact.organization || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {contact.category || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {contact.instagramUrl ? (
                      <a 
                        href={contact.instagramUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-pink-600 hover:underline flex items-center gap-1"
                      >
                        <Instagram className="h-4 w-4" />
                        <span>リンク</span>
                      </a>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {contact.histories.length}件
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {contact.creator?.name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddHistory(contact)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        履歴追加
                      </Button>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleViewDetail(contact)}
                      >
                        詳細
                      </Button>
                      <button
                        onClick={() => handleDeleteContact(contact)}
                        className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                        title="削除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {filteredContacts?.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          町民情報がありません
        </div>
      )}

      {/* 使い方モーダル */}
      {isGuideOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4"
          onClick={() => setIsGuideOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-xl w-full mt-16 border border-gray-200 dark:border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">町民データベースの使い方</h2>
              <button
                onClick={() => setIsGuideOpen(false)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="h-4 w-4 text-gray-600 dark:text-gray-300" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-2 text-sm text-gray-700 dark:text-gray-200">
              <p>• 追加: 右上の「町民を追加する」から誰でも登録できます（後で編集・削除も可能）。</p>
              <p>• 表示切替: 右上のボタンでカード/リスト表示を切り替えられます。</p>
              <p>• フィルタ: 検索・タグ・ジャンルで絞り込みできます。</p>
              <p>• 履歴: カードから「履歴を追加」で接点の記録を残せます。</p>
            </div>
            <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end">
              <Button variant="outline" onClick={() => setIsGuideOpen(false)}>
                閉じる
              </Button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <ContactModal
          contact={selectedContact}
          onClose={handleCloseModal}
          onSaved={handleSaved}
        />
      )}

      {isHistoryModalOpen && selectedContact && (
        <ContactHistoryModal
          contactId={selectedContact.id}
          onClose={handleCloseHistoryModal}
          onSaved={handleHistorySaved}
        />
      )}

      {isDetailModalOpen && selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          onClose={handleCloseDetailModal}
          onEdit={() => handleEditContact(selectedContact)}
          onHistoryAdded={handleHistorySaved}
          onDeleted={() => {
            handleCloseDetailModal();
            queryClient.invalidateQueries({ queryKey: ['contacts'] });
          }}
        />
      )}
    </div>
  );
};