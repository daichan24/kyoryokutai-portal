import React, { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { api } from '../../utils/api';
import { User } from '../../types';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { formatDate } from '../../utils/date';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { useAuthStore } from '../../stores/authStore';

type RoleFilter = 'MEMBER' | 'GOVERNMENT' | 'SUPPORT' | 'all';

export const UsersSettings: React.FC = () => {
  const { user: currentUser } = useAuthStore();
  const [users, setUsers] = useState<User[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]); // 全ユーザー（フィルター前）
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all'); // 初期は全件表示
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'MEMBER' as 'MASTER' | 'MEMBER' | 'SUPPORT' | 'GOVERNMENT',
    department: '',
    termStart: '',
    termEnd: '',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isUpdatingMemberName, setIsUpdatingMemberName] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  // 全ロールでroleフィルター適用
  useEffect(() => {
    let filtered = roleFilter !== 'all' 
      ? allUsers.filter((user) => user.role === roleFilter)
      : allUsers;
    
    // メンバーの場合はdisplayOrderでソート
    if (roleFilter === 'MEMBER') {
      filtered = filtered.sort((a, b) => {
        const orderA = a.displayOrder || 0;
        const orderB = b.displayOrder || 0;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        // 同じ順位の場合は名前でソート
        return (a.name || '').localeCompare(b.name || '');
      });
    }
    
    setUsers(filtered);
  }, [roleFilter, allUsers]);

  const fetchUsers = async (filterRole?: string) => {
    try {
      const url = filterRole ? `/api/users?role=${filterRole}` : '/api/users';
      const response = await api.get<User[]>(url);
      const fetchedUsers = response.data || [];
      setAllUsers(fetchedUsers);
      
      // 初期フィルター適用
      if (!filterRole && roleFilter !== 'all') {
        const filtered = fetchedUsers.filter((user) => user.role === roleFilter);
        setUsers(filtered);
      } else {
        setUsers(fetchedUsers);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
      setAllUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMemberSatoName = async () => {
    if (!confirm('メンバーの「佐藤大地」を「さとうだいち」に更新しますか？')) {
      return;
    }

    setIsUpdatingMemberName(true);
    try {
      // まず、メンバーの「佐藤大地」を検索
      const memberSato = allUsers.find(
        (user) => user.role === 'MEMBER' && user.name === '佐藤大地'
      );

      if (!memberSato) {
        // 「さとうだいち」が既に存在するか確認
        const memberSatoHiragana = allUsers.find(
          (user) => user.role === 'MEMBER' && user.name === 'さとうだいち'
        );

        if (memberSatoHiragana) {
          alert('ℹ️ メンバー「さとうだいち」は既に存在しています。');
          return;
        } else {
          alert('ℹ️ メンバー「佐藤大地」は見つかりませんでした。');
          return;
        }
      }

      // 既存のユーザー更新APIを使用して名前を更新
      await api.put(`/api/users/${memberSato.id}`, {
        name: 'さとうだいち',
      });

      alert(`✅ ユーザー ${memberSato.email} の名前を「佐藤大地」から「さとうだいち」に更新しました`);
      await fetchUsers(); // 一覧を再取得
    } catch (error: any) {
      console.error('Failed to update member name:', error);
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
      });
      
      let errorMessage = '更新に失敗しました';
      if (error.response?.status === 404) {
        errorMessage = 'ユーザーが見つかりませんでした。';
      } else if (error.response?.status === 403) {
        errorMessage = '権限がありません。MASTERロールでログインしている必要があります。';
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert('❌ エラー: ' + errorMessage);
    } finally {
      setIsUpdatingMemberName(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormLoading(true);

    try {
      await api.post<User>('/api/admin/users', formData);
      setIsModalOpen(false);
      setFormData({
        name: '',
        email: '',
        password: '',
        role: 'MEMBER',
        department: '',
        termStart: '',
        termEnd: '',
      });
      await fetchUsers(); // 一覧を再取得
    } catch (error: any) {
      console.error('Failed to create user:', error);
      const errorMessage = error.response?.data?.error || 'ユーザーの作成に失敗しました';
      const errorDetails = error.response?.data?.details;
      setFormError(errorDetails ? JSON.stringify(errorDetails, null, 2) : errorMessage);
    } finally {
      setFormLoading(false);
    }
  };

  // 管理者（MASTER / SUPPORT）のみが新規作成ボタンを表示
  const canCreateUser = currentUser?.role === 'MASTER' || currentUser?.role === 'SUPPORT';
  
  // ページタイトル（ロール別）
  const pageTitle = currentUser?.role === 'MASTER' ? 'ユーザー管理' : 'ユーザー情報';
  
  // 全ロールでフィルターUIを表示
  const showRoleFilter = true;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{pageTitle}</h1>
        <div className="flex gap-3">
          {currentUser?.role === 'MASTER' && (
            <Button
              variant="outline"
              onClick={handleUpdateMemberSatoName}
              disabled={isUpdatingMemberName}
            >
              {isUpdatingMemberName ? '更新中...' : 'メンバー名更新（佐藤→さとう）'}
            </Button>
          )}
          {canCreateUser && (
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              新規ユーザー追加
            </Button>
          )}
        </div>
      </div>

      {/* ロール別フィルター */}
      {showRoleFilter && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-4">
          <div className="flex space-x-2">
            <Button
              variant={roleFilter === 'MEMBER' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setRoleFilter('MEMBER')}
            >
              メンバー
            </Button>
            <Button
              variant={roleFilter === 'GOVERNMENT' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setRoleFilter('GOVERNMENT')}
            >
              行政
            </Button>
            <Button
              variant={roleFilter === 'SUPPORT' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setRoleFilter('SUPPORT')}
            >
              サポート
            </Button>
            <Button
              variant={roleFilter === 'all' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setRoleFilter('all')}
            >
              すべて
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  名前
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  メール
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  役割
                </th>
                {roleFilter === 'MEMBER' && (currentUser?.role === 'MASTER' || currentUser?.role === 'SUPPORT' || currentUser?.role === 'GOVERNMENT') && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    表示順
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  任期
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  登録日
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium"
                        style={{ backgroundColor: user.avatarColor }}
                      >
                        {(user.avatarLetter || user.name || '').charAt(0)}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs rounded-full bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary">
                      {user.role}
                    </span>
                  </td>
                  {roleFilter === 'MEMBER' && (currentUser?.role === 'MASTER' || currentUser?.role === 'SUPPORT' || currentUser?.role === 'GOVERNMENT') && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="number"
                        min="0"
                        value={user.displayOrder ?? 0}
                        onChange={async (e) => {
                          const inputValue = e.target.value;
                          const newOrder = inputValue === '' ? 0 : parseInt(inputValue, 10);
                          
                          if (isNaN(newOrder)) {
                            return; // 無効な値の場合は何もしない
                          }
                          
                          // 即座にローカル状態を更新
                          const updatedUsers = users.map(u => 
                            u.id === user.id ? { ...u, displayOrder: newOrder } : u
                          );
                          setUsers(updatedUsers);
                          
                          // allUsersも更新
                          const updatedAllUsers = allUsers.map(u => 
                            u.id === user.id ? { ...u, displayOrder: newOrder } : u
                          );
                          setAllUsers(updatedAllUsers);
                          
                          // APIを呼び出し
                          try {
                            await api.put(`/api/users/${user.id}`, { displayOrder: newOrder });
                            // 成功したら再取得（念のため）
                            await fetchUsers();
                          } catch (error) {
                            console.error('Failed to update display order:', error);
                            alert('表示順の更新に失敗しました');
                            // エラー時は元に戻す
                            await fetchUsers();
                          }
                        }}
                        onBlur={async (e) => {
                          // フォーカスが外れた時に最終的な値を確定
                          const inputValue = e.target.value;
                          const newOrder = inputValue === '' ? 0 : parseInt(inputValue, 10);
                          
                          if (isNaN(newOrder)) {
                            return;
                          }
                          
                          try {
                            await api.put(`/api/users/${user.id}`, { displayOrder: newOrder });
                            await fetchUsers();
                          } catch (error) {
                            console.error('Failed to update display order:', error);
                            alert('表示順の更新に失敗しました');
                            await fetchUsers();
                          }
                        }}
                        className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm"
                      />
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {user.termStart && user.termEnd
                      ? `${formatDate(user.termStart, 'yyyy/M/d')} - ${formatDate(user.termEnd, 'yyyy/M/d')}`
                      : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(user.createdAt, 'yyyy/M/d')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 新規ユーザー作成モーダル */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">新規ユーザー追加</h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setFormError(null);
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 px-4 py-3 rounded">
                  <p className="text-sm">{formError}</p>
                </div>
              )}

              <Input
                label="名前 *"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />

              <Input
                label="メールアドレス *"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />

              <Input
                label="パスワード *"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
              />

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  役割 *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as 'MASTER' | 'MEMBER' | 'SUPPORT' | 'GOVERNMENT',
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  required
                >
                  <option value="MEMBER">MEMBER（協力隊）</option>
                  <option value="GOVERNMENT">GOVERNMENT（役場）</option>
                  <option value="SUPPORT">SUPPORT（サポート）</option>
                  <option value="MASTER">MASTER（管理者）</option>
                </select>
              </div>

              <Input
                label="部署"
                type="text"
                value={formData.department}
                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              />

              <Input
                label="任期開始日"
                type="date"
                value={formData.termStart}
                onChange={(e) => setFormData({ ...formData, termStart: e.target.value })}
              />

              <Input
                label="任期終了日"
                type="date"
                value={formData.termEnd}
                onChange={(e) => setFormData({ ...formData, termEnd: e.target.value })}
              />

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsModalOpen(false);
                    setFormError(null);
                  }}
                  disabled={formLoading}
                >
                  キャンセル
                </Button>
                <Button type="submit" disabled={formLoading}>
                  {formLoading ? '作成中...' : '作成'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
