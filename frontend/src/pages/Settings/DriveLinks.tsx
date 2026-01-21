import React, { useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, ExternalLink } from 'lucide-react';
import { api } from '../../utils/api';
import { DriveLink } from '../../types';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';

export const DriveLinksSettings: React.FC = () => {
  const [driveLinks, setDriveLinks] = useState<DriveLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [editingLink, setEditingLink] = useState<DriveLink | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editOrder, setEditOrder] = useState(0);

  useEffect(() => {
    fetchDriveLinks();
  }, []);

  const fetchDriveLinks = async () => {
    try {
      const response = await api.get<DriveLink[]>('/api/drive-links');
      setDriveLinks(response.data || []);
    } catch (error) {
      console.error('Failed to fetch drive links:', error);
      setDriveLinks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) {
      alert('項目名とURLを入力してください');
      return;
    }

    try {
      await api.post('/api/drive-links', {
        title: newTitle,
        url: newUrl,
        description: newDescription || undefined,
        order: driveLinks.length,
      });
      setNewTitle('');
      setNewUrl('');
      setNewDescription('');
      fetchDriveLinks();
    } catch (error: any) {
      console.error('Failed to add drive link:', error);
      alert(error?.response?.data?.error || 'ドライブリンクの追加に失敗しました');
    }
  };

  const handleEditLink = (link: DriveLink) => {
    setEditingLink(link);
    setEditTitle(link.title);
    setEditUrl(link.url);
    setEditDescription(link.description || '');
    setEditOrder(link.order);
  };

  const handleCancelEdit = () => {
    setEditingLink(null);
    setEditTitle('');
    setEditUrl('');
    setEditDescription('');
    setEditOrder(0);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLink || !editTitle.trim() || !editUrl.trim()) return;

    try {
      await api.put(`/api/drive-links/${editingLink.id}`, {
        title: editTitle,
        url: editUrl,
        description: editDescription || undefined,
        order: editOrder,
      });
      handleCancelEdit();
      fetchDriveLinks();
    } catch (error) {
      console.error('Failed to update drive link:', error);
      alert('更新に失敗しました');
    }
  };

  const handleDeleteLink = async (link: DriveLink) => {
    if (!confirm(`「${link.title}」を削除しますか？`)) return;

    try {
      await api.delete(`/api/drive-links/${link.id}`);
      fetchDriveLinks();
    } catch (error) {
      console.error('Failed to delete drive link:', error);
      alert('削除に失敗しました');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">ドライブ</h1>

      <form onSubmit={handleAddLink} className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">新規追加</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              項目名 <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="例：プロジェクト資料、画像フォルダ"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              GoogleドライブURL <span className="text-red-500">*</span>
            </label>
            <Input
              type="url"
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              説明（任意）
            </label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="このリンクの説明を入力してください"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
          </div>
          <Button type="submit">
            <Plus className="h-4 w-4 mr-2" />
            追加
          </Button>
        </div>
      </form>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700">
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">ドライブリンク一覧</h2>
          {driveLinks.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              ドライブリンクがありません
            </div>
          ) : (
            <div className="space-y-4">
              {driveLinks.map((link) => (
                <div
                  key={link.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  {editingLink?.id === link.id ? (
                    <form onSubmit={handleSaveEdit} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          項目名 <span className="text-red-500">*</span>
                        </label>
                        <Input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          GoogleドライブURL <span className="text-red-500">*</span>
                        </label>
                        <Input
                          type="url"
                          value={editUrl}
                          onChange={(e) => setEditUrl(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          説明（任意）
                        </label>
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          rows={3}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          表示順
                        </label>
                        <Input
                          type="number"
                          value={editOrder}
                          onChange={(e) => setEditOrder(parseInt(e.target.value) || 0)}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button type="submit" size="sm">
                          保存
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleCancelEdit}
                        >
                          キャンセル
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                            {link.title}
                          </h3>
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                          >
                            <ExternalLink className="h-4 w-4" />
                            開く
                          </a>
                        </div>
                        {link.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                            {link.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          表示順: {link.order}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditLink(link)}
                        >
                          <Edit2 className="h-4 w-4 mr-1" />
                          編集
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDeleteLink(link)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          削除
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

