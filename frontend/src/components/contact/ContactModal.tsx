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
  relatedMembers?: string[]; // 関わった協力隊
  relationshipType?: '協力的' | '要注意' | '未知' | '未登録'; // 関わり方
  memo?: string; // 備考
  tags: string[];
  role?: '現役' | 'OB' | 'サポート' | '役場';
  startYear?: number;
  endYear?: number;
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
  const [relationshipType, setRelationshipType] = useState<'協力的' | '要注意' | '未知' | '未登録' | ''>('');
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);

  // ユーザー一覧を取得（協力隊メンバー選択用）
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api.get<User[]>('/api/users');
        // サポート・行政ユーザーの場合は「佐藤大地」を除外
        const filteredUsers = (response.data || []).filter(u => {
          if ((user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT') && u.name === '佐藤大地') return false;
          return true;
        });
        setUsers(filteredUsers);
      } catch (error) {
        console.error('Failed to fetch users:', error);
        setUsers([]);
      }
    };
    fetchUsers();
  }, [user]);

  // 初期化：編集時は既存データをセット、新規作成時は空にする
  useEffect(() => {
    if (contact) {
      setName(contact.name);
      setOrganization(contact.organization || '');
      setCategory(contact.category || '');
      setRelatedMembers(contact.relatedMembers || []);
      setRelationshipType(contact.relationshipType || '');
      setMemo(contact.memo || '');
    } else {
      // 新規作成時：自分をデフォルトで選択
      setName('');
      setOrganization('');
      setCategory('');
      setRelatedMembers(user ? [user.id] : []);
      setRelationshipType('');
      setMemo('');
    }
  }, [contact, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('🔵 [UI] フォーム送信ボタンがクリックされました');
    
    setLoading(true);

    try {
      const data = {
        name,
        organization: organization || undefined,
        category: category || undefined,
        relatedMembers: relatedMembers,
        relationshipType: relationshipType || undefined,
        memo: memo || undefined,
      };

      console.log('🔵 [UI] APIに送信するデータ:', data);

      if (contact) {
        console.log('🔵 [UI] 編集モード: PUT /api/citizens/' + contact.id);
        await api.put(`/api/citizens/${contact.id}`, data);
      } else {
        console.log('🔵 [UI] 新規作成モード: POST /api/citizens');
        await api.post('/api/citizens', data);
      }

      console.log('✅ [UI] API呼び出し成功');
      onSaved();
    } catch (error: any) {
      console.error('❌ [UI] API呼び出し失敗:', error);
      const errorMessage = error?.response?.data?.error || error?.response?.data?.details || error?.message || '保存に失敗しました';
      console.error('❌ [UI] エラー詳細:', error?.response?.data);
      alert(`保存に失敗しました: ${typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage)}`);
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-2xl font-bold">
            {contact ? '町民情報編集' : '町民情報登録'}
          </h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              関わった協力隊
            </label>
            <div className="border border-gray-300 rounded-lg p-3 max-h-48 overflow-y-auto">
              {users.length === 0 ? (
                <p className="text-sm text-gray-500">ユーザーを読み込み中...</p>
              ) : (
                <div className="space-y-2">
                  {users.map((u) => (
                    <label key={u.id} className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={relatedMembers.includes(u.id)}
                        onChange={() => handleToggleMember(u.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <div className="flex items-center space-x-2">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium"
                          style={{ backgroundColor: u.avatarColor }}
                        >
                          {u.name.charAt(0)}
                        </div>
                        <span className="text-sm text-gray-900">{u.name}</span>
                        <span className="text-xs text-gray-500">({u.role})</span>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            {relatedMembers.length > 0 && (
              <p className="text-xs text-gray-500 mt-2">
                選択中: {relatedMembers.length}名
              </p>
            )}
          </div>

          {/* 関わり方（選択式） */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              関わり方
            </label>
            <select
              value={relationshipType}
              onChange={(e) => setRelationshipType(e.target.value as typeof relationshipType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">選択してください</option>
              <option value="協力的">協力的</option>
              <option value="要注意">要注意</option>
              <option value="未知">未知</option>
              <option value="未登録">未登録</option>
            </select>
          </div>

          {/* 備考 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              備考
            </label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="備考を入力"
            />
          </div>

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
