import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../utils/api';
import { User } from '../../types';
import { useAuthStore } from '../../stores/authStore';

interface UserFilterProps {
  selectedUserId: string | null;
  onUserChange: (userId: string | null) => void;
  showAllOption?: boolean;
  label?: string;
}

export const UserFilter: React.FC<UserFilterProps> = ({
  selectedUserId,
  onUserChange,
  showAllOption = true,
  label = 'ユーザー',
}) => {
  const { user } = useAuthStore();

  const { data: users = [], isLoading } = useQuery<User[]>({
    queryKey: ['users', user?.role],
    queryFn: async () => {
      // MEMBERを優先的に取得
      const response = await api.get('/api/users?role=MEMBER');
      // サポート・行政・マスターユーザーの場合は「さとうだいち」を除外
      const filteredUsers = (response.data || []).filter(
        (u: User) => !(user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT' || user?.role === 'MASTER') || u.name !== 'さとうだいち'
      );
      return filteredUsers;
    },
  });

  if (isLoading) {
    return (
      <select
        className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        disabled
      >
        <option>読み込み中...</option>
      </select>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
        {label}:
      </label>
      <select
        value={selectedUserId || ''}
        onChange={(e) => onUserChange(e.target.value || null)}
        className="border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent min-w-[180px]"
      >
        {showAllOption && <option value="">全て</option>}
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    </div>
  );
};

