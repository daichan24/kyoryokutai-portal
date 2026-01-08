import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../utils/api';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

interface Contact {
  id: string;
  name: string;
  organization?: string;
  title?: string;
  contactInfo?: string;
  memo?: string;
  tags: string[];
  histories: ContactHistory[];
}

interface ContactHistory {
  id: string;
  date: string;
  content: string;
  user: { id: string; name: string };
  project?: { id: string; projectName: string };
}

export const Contacts: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('');

  const { data: contacts, isLoading } = useQuery<Contact[]>({
    queryKey: ['contacts'],
    queryFn: async () => {
      const response = await api.get('/api/contacts');
      return response.data;
    }
  });

  const filteredContacts = contacts?.filter(contact => {
    const matchesSearch = 
      contact.name.includes(searchTerm) || 
      contact.organization?.includes(searchTerm) ||
      false;
    const matchesTag = !selectedTag || contact.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

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
        <h1 className="text-2xl font-bold text-gray-900">町民データベース</h1>
        <button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors">
          + 新規登録
        </button>
      </div>

      <div className="flex gap-4">
        <input
          type="text"
          placeholder="名前・組織で検索"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <select
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">全てのタグ</option>
          <option value="協力的">協力的</option>
          <option value="要注意">要注意</option>
          <option value="専門家">専門家</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredContacts?.map((contact) => (
          <div key={contact.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-lg text-gray-900">{contact.name}</h3>
              {contact.tags.length > 0 && (
                <div className="flex gap-1">
                  {contact.tags.map((tag) => (
                    <span key={tag} className="text-xs px-2 py-1 bg-gray-100 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {contact.organization && (
              <p className="text-sm text-gray-600">{contact.organization}</p>
            )}

            {contact.title && (
              <p className="text-sm text-gray-500">{contact.title}</p>
            )}

            {contact.memo && (
              <p className="text-sm text-gray-700 mt-2 line-clamp-2">
                {contact.memo}
              </p>
            )}

            <div className="flex justify-between items-center mt-3 pt-3 border-t">
              <span className="text-xs text-gray-500">
                接触履歴: {contact.histories.length}件
              </span>
              <button className="text-sm text-blue-600 hover:underline">
                詳細 →
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredContacts?.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          町民情報がありません
        </div>
      )}
    </div>
  );
};