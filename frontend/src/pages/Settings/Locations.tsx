import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import { api } from '../../utils/api';
import { Location } from '../../types';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useAuthStore } from '../../stores/authStore';

export const LocationsSettings: React.FC = () => {
  const { user } = useAuthStore();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLocationName, setNewLocationName] = useState('');
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [editLocationName, setEditLocationName] = useState('');
  const [editLocationOrder, setEditLocationOrder] = useState(0);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const response = await api.get<Location[]>('/api/locations?includeInactive=true');
      setLocations(response.data || []);
    } catch (error) {
      console.error('Failed to fetch locations:', error);
      setLocations([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocationName.trim()) {
      alert('場所名を入力してください');
      return;
    }

    try {
      await api.post('/api/locations', {
        name: newLocationName,
        order: locations.length + 1,
      });
      setNewLocationName('');
      fetchLocations();
    } catch (error: any) {
      console.error('Failed to add location:', error);
      alert(error?.response?.data?.error || '場所の追加に失敗しました');
    }
  };

  const handleToggleActive = async (location: Location) => {
    try {
      await api.put(`/api/locations/${location.id}`, {
        isActive: !location.isActive,
      });
      fetchLocations();
    } catch (error) {
      console.error('Failed to toggle location:', error);
      alert('更新に失敗しました');
    }
  };

  const handleEditLocation = (location: Location) => {
    setEditingLocation(location);
    setEditLocationName(location.name);
    setEditLocationOrder(location.order);
  };

  const handleCancelEdit = () => {
    setEditingLocation(null);
    setEditLocationName('');
    setEditLocationOrder(0);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLocation || !editLocationName.trim()) return;

    try {
      await api.put(`/api/locations/${editingLocation.id}`, {
        name: editLocationName,
        order: editLocationOrder,
      });
      handleCancelEdit();
      fetchLocations();
    } catch (error) {
      console.error('Failed to update location:', error);
      alert('更新に失敗しました');
    }
  };

  const handleDeleteLocation = async (location: Location) => {
    if (!confirm(`「${location.name}」を削除しますか？`)) return;

    try {
      await api.delete(`/api/locations/${location.id}`);
      fetchLocations();
    } catch (error) {
      console.error('Failed to delete location:', error);
      alert('削除に失敗しました');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">場所管理</h1>

      <form onSubmit={handleAddLocation} className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6">
        <div className="flex space-x-4">
          <input
            type="text"
            value={newLocationName}
            onChange={(e) => setNewLocationName(e.target.value)}
            placeholder="新しい場所の名前"
            className="flex-1 px-3 py-2 border border-border dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <Button type="submit">
            <Plus className="h-4 w-4 mr-2" />
            追加
          </Button>
        </div>
      </form>

      {loading ? (
        <LoadingSpinner />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  場所名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  順序
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  状態
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {locations.map((location) => (
                <tr key={location.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                  {editingLocation?.id === location.id ? (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Input
                          type="text"
                          value={editLocationName}
                          onChange={(e) => setEditLocationName(e.target.value)}
                          className="w-full"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Input
                          type="number"
                          value={editLocationOrder}
                          onChange={(e) => setEditLocationOrder(Number(e.target.value))}
                          className="w-full"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            location.isActive
                              ? 'bg-secondary/10 dark:bg-secondary/20 text-secondary'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {location.isActive ? '有効' : '無効'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={handleSaveEdit}
                          >
                            保存
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleCancelEdit}
                          >
                            キャンセル
                          </Button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                        {location.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                        {location.order}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            location.isActive
                              ? 'bg-secondary/10 dark:bg-secondary/20 text-secondary'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {location.isActive ? '有効' : '無効'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditLocation(location)}
                          >
                            <Edit2 className="h-4 w-4 mr-1" />
                            編集
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleActive(location)}
                          >
                            {location.isActive ? '無効化' : '有効化'}
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteLocation(location)}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            削除
                          </Button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
