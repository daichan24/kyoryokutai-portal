import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { api } from '../../utils/api';
import { Location } from '../../types';
import { Button } from '../../components/common/Button';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const LocationsSettings: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLocationName, setNewLocationName] = useState('');

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
    if (!newLocationName.trim()) return;

    try {
      await api.post('/api/locations', {
        name: newLocationName,
        order: locations.length + 1,
      });
      setNewLocationName('');
      fetchLocations();
    } catch (error) {
      console.error('Failed to add location:', error);
      alert('場所の追加に失敗しました');
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

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">場所管理</h1>

      <form onSubmit={handleAddLocation} className="bg-white rounded-lg shadow border border-border p-6">
        <div className="flex space-x-4">
          <input
            type="text"
            value={newLocationName}
            onChange={(e) => setNewLocationName(e.target.value)}
            placeholder="新しい場所の名前"
            className="flex-1 px-3 py-2 border border-border rounded-md"
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
        <div className="bg-white rounded-lg shadow border border-border overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  場所名
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  順序
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  状態
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {locations.map((location) => (
                <tr key={location.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {location.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {location.order}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        location.isActive
                          ? 'bg-secondary/10 text-secondary'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {location.isActive ? '有効' : '無効'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(location)}
                    >
                      {location.isActive ? '無効化' : '有効化'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
