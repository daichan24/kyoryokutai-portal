import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../../utils/api';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useAuthStore } from '../../stores/authStore';
import { User } from '../../types';

interface Contact {
  id: string;
  name: string;
  organization?: string;
  category?: string; // ジャンル
  relatedMembers?: string[]; // 関わった協力隊（MEMBERのみ）
  memo?: string; // 備考
  tags: string[];
  role?: '現役' | 'OB' | 'サポート' | '役場';
  startYear?: number;
  endYear?: number;
  instagramUrl?: string;
}

interface ContactModalProps {
  contact?: Contact | null;
  onClose: () => void;
  onSaved: () => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({
  contact,
  onClose,
  onSaved,
}) => {
  const { user } = useAuthStore();
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [category, setCategory] = useState('');
  const [relatedMembers, setRelatedMembers] = useState<string[]>([]);
  const [memo, setMemo] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

  // ユーザー一覧を取得（協力隊メンバー選択用：MEMBERのみ）
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api.get<User[]>('/api/users');
        // MEMBERロールのみに絞る（テストユーザー除外）
        const filteredUsers = (response.data || []).filter(u => {
          if (u.role !== 'MEMBER') return false;
          if ((u.displayOrder ?? 0) === 0) return false;
          return true;
        });
        setUsers(filteredUsers);
      } catch (error) {
        console.error('Failed to fetch users:', error);
        setUsers([]);
      }
    };
    fetchUsers();
  }, []);

  // 初期化：編集時は既存データをセット、新規作成時は空にする
  useEffect(() => {
    if (contact) {
      setName(contact.name);
      setOrganization(contact.organization || '');
      setCategory(contact.category || '');
      setRelatedMembers(contact.relatedMembers || []);
      setMemo(contact.memo || '');
      setInstagramUrl(contact.instagramUrl || '');
    } else {
      // 新規作成時：自分をデフォルトで選択
      setName('');
      setOrganization('');
      setCategory('');
      setRelatedMembers(user ? [user.id] : []);
      setMemo('');
      setInstagramUrl('');
    }
  }, [contact, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { alert('名前を入力してください'); return; }
    setLoading(true);
    try {
      const data = {
        name: name.trim(),
        organization: organization.trim() || undefined,
        category: category.trim() || undefined,
        relatedMembers,
        memo: memo.trim() || undefined,
        instagramUrl: instagramUrl.trim() || undefined,
        tags: [],
      };
      if (contact) {
        await api.put(`/api/citizens/${contact.id}`, data);
      } else {
        await api.post('/api/citizens', data);
      }
      onSaved();
    } catch (error: any) {
      console.error('❌ [UI] API呼び出し失敗:', error);
      const raw = error?.response?.data;
      let msg = '保存に失敗しました';
      if (raw?.error) msg = raw.error;
      else if (raw?.details) msg = Array.isArray(raw.details) ? raw.details.map((d: any) => d.message || JSON.stringify(d)).join(', ') : String(raw.details);
      else if (error?.message) msg = error.message;
      alert(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMember = (userId: string) => {
    if (relatedMembers.includes(userId)) {
      setRelatedMembers(relatedMembers.filter(id => id !== userId));
    } else {
      setRelatedMembers([...relatedMembers, userId]);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
          <h2 className="text-2xl font-bold dark:text-gray-100">
            {contact ? '町民情報編集' : '町民情報登録'}
          </h2>
          <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 名前（必須） */}
          <Input
            label="名前"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="名前を入力"
          />

          {/* 所属 */}
          <Input
            label="所属"
            type="text"
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            placeholder="所属を入力"
          />

          {/* ジャンル */}
          <Input
            label="ジャンル"
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="ジャンルを入力（例: 農業、観光、教育など）"
          />

          {/* 関わった協力隊（複数選択） */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              関わった協力隊
            </label>
            <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-3 max-h-48 overflow-y-auto bg-white dark:bg-gray-800">
              {users.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">ユーザーを読み込み中...</p>
              ) : (
                <div className="space-y-2">
                  {users.map((u) => (
                    <label key={u.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={relatedMembers.includes(u.id)}
                        onChange={() => handleToggleMember(u.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                      />
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
                          style={{ backgroundColor: u.avatarColor }}
                        >
                          {(u.avatarLetter || u.name || '').charAt(0)}
                        </div>
                        <span className="text-sm text-gray-900 dark:text-gray-100">{u.name}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">({u.role})</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            {relatedMembers.length > 0 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                選択中: {relatedMembers.length}名
              </p>
            )}
          </div>

          {/* 備考 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              備考
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="備考を入力"
            />
          </div>

          {/* Instagram URL */}
          <Input
            label="Instagram URL"
            type="url"
            value={instagramUrl}
            onChange={(e) => setInstagramUrl(e.target.value)}
            placeholder="https://www.instagram.com/username/"
          />

          <div className="flex justify-end space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '保存中...' : '登録'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
