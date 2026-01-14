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
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('MEMBER'); // MEMBER向けの初期フィルター
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

  useEffect(() => {
    fetchUsers();
  }, []);

  // MEMBER向けのroleフィルター適用
  useEffect(() => {
    if (currentUser?.role === 'MEMBER' && roleFilter !== 'all') {
      const filtered = allUsers.filter((user) => user.role === roleFilter);
      setUsers(filtered);
    } else {
      setUsers(allUsers);
    }
  }, [roleFilter, allUsers, currentUser?.role]);

  const fetchUsers = async (filterRole?: string) => {
    try {
      const url = filterRole ? `/api/users?role=${filterRole}` : '/api/users';
      const response = await api.get<User[]>(url);
      const fetchedUsers = response.data || [];
      setAllUsers(fetchedUsers);
      
      // MEMBER向けの初期フィルター適用
      if (currentUser?.role === 'MEMBER' && !filterRole && roleFilter !== 'all') {
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
  
  // MEMBER向けのフィルターUI
  const showRoleFilter = currentUser?.role === 'MEMBER';

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">{pageTitle}</h1>
        {canCreateUser && (
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新規ユーザー追加
          </Button>
        )}
      </div>

      {/* MEMBER向けのroleフィルター */}
      {showRoleFilter && (
        <div className="bg-white rounded-lg shadow border border-border p-4">
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
        <div className="bg-white rounded-lg shadow border border-border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  名前
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  メール
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  役割
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  任期
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  登録日
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium"
                        style={{ backgroundColor: user.avatarColor }}
                      >
                        {user.name.charAt(0)}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{user.name}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {user.termStart && user.termEnd
                      ? `${formatDate(user.termStart, 'yyyy/M/d')} - ${formatDate(user.termEnd, 'yyyy/M/d')}`
                      : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">新規ユーザー追加</h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setFormError(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
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
