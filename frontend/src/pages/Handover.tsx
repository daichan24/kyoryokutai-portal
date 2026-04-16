import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Plus, Edit2, Trash2, Folder, FileText, Users } from 'lucide-react';
import axios from 'axios';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Contact {
  id: string;
  name: string;
  organization?: string;
}

interface User {
  id: string;
  name: string;
}

interface HandoverCategory {
  id: string;
  name: string;
  type: 'EVENT' | 'MEETING';
  description?: string;
  sortOrder: number;
  folders: HandoverFolder[];
}

interface HandoverFolder {
  id: string;
  categoryId: string;
  fiscalYear: number;
  title: string;
  description?: string;
  documents: HandoverDocument[];
}

interface HandoverDocument {
  id: string;
  folderId: string;
  title: string;
  content: string;
  relatedContactIds: string[];
  relatedMemberIds: string[];
  budget?: number;
  venue?: string;
  createdBy: { id: string; name: string };
  updatedBy?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export const Handover: React.FC = () => {
  const [categories, setCategories] = useState<HandoverCategory[]>([]);
  const [selectedTab, setSelectedTab] = useState<'EVENT' | 'MEETING'>('EVENT');
  const [viewMode, setViewMode] = useState<'view' | 'edit'>('view');
  const [loading, setLoading] = useState(true);
  
  // ダイアログ状態
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [folderDialog, setFolderDialog] = useState(false);
  const [documentDialog, setDocumentDialog] = useState(false);
  const [documentViewDialog, setDocumentViewDialog] = useState(false);
  
  // 展開状態
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  
  // フォーム状態
  const [categoryForm, setCategoryForm] = useState({ name: '', type: 'EVENT' as 'EVENT' | 'MEETING', description: '' });
  const [folderForm, setFolderForm] = useState({ categoryId: '', fiscalYear: new Date().getFullYear(), title: '', description: '' });
  const [documentForm, setDocumentForm] = useState({
    folderId: '',
    title: '',
    content: '',
    budget: '',
    venue: '',
    relatedContactIds: [] as string[],
    relatedMemberIds: [] as string[],
  });
  const [selectedDocument, setSelectedDocument] = useState<HandoverDocument | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 町民・メンバーデータ
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchCategories(), fetchContacts(), fetchUsers()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/handover/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCategories(response.data);
    } catch (error) {
      console.error('カテゴリ取得エラー:', error);
    }
  };

  const fetchContacts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/contacts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setContacts(response.data);
    } catch (error) {
      console.error('町民データ取得エラー:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUsers(response.data);
    } catch (error) {
      console.error('ユーザーデータ取得エラー:', error);
    }
  };

  const handleCreateCategory = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/handover/categories`, categoryForm, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCategoryDialog(false);
      setCategoryForm({ name: '', type: 'EVENT', description: '' });
      fetchCategories();
    } catch (error) {
      console.error('カテゴリ作成エラー:', error);
    }
  };

  const handleCreateFolder = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`${API_URL}/api/handover/folders`, folderForm, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFolderDialog(false);
      setFolderForm({ categoryId: '', fiscalYear: new Date().getFullYear(), title: '', description: '' });
      fetchCategories();
    } catch (error) {
      console.error('フォルダ作成エラー:', error);
    }
  };

  const resetDocumentForm = () => {
    setDocumentForm({
      folderId: '',
      title: '',
      content: '',
      budget: '',
      venue: '',
      relatedContactIds: [],
      relatedMemberIds: [],
    });
    setEditingId(null);
  };

  const handleCreateDocument = async () => {
    try {
      const token = localStorage.getItem('token');
      const data = {
        ...documentForm,
        budget: documentForm.budget ? parseInt(documentForm.budget) : null,
      };
      
      if (editingId) {
        await axios.put(`${API_URL}/api/handover/documents/${editingId}`, data, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } else {
        await axios.post(`${API_URL}/api/handover/documents`, data, {
          headers: { Authorization: `Bearer ${token}` },
        });
      }
      
      setDocumentDialog(false);
      resetDocumentForm();
      fetchCategories();
    } catch (error) {
      console.error('文書作成/更新エラー:', error);
    }
  };

  const handleViewDocument = async (docId: string) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/handover/documents/${docId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedDocument(response.data);
      setDocumentViewDialog(true);
    } catch (error) {
      console.error('文書取得エラー:', error);
    }
  };

  const handleEditDocument = (doc: HandoverDocument) => {
    setEditingId(doc.id);
    setDocumentForm({
      folderId: doc.folderId,
      title: doc.title,
      content: doc.content,
      budget: doc.budget?.toString() || '',
      venue: doc.venue || '',
      relatedContactIds: doc.relatedContactIds || [],
      relatedMemberIds: doc.relatedMemberIds || [],
    });
    setDocumentDialog(true);
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!confirm('この文書を削除しますか？')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/api/handover/documents/${docId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchCategories();
    } catch (error) {
      console.error('文書削除エラー:', error);
    }
  };

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const displayCategories = categories.filter(c => c.type === selectedTab);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">引き継ぎ</h1>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'view' ? 'primary' : 'outline'}
            onClick={() => setViewMode('view')}
          >
            閲覧モード
          </Button>
          <Button
            variant={viewMode === 'edit' ? 'primary' : 'outline'}
            onClick={() => setViewMode('edit')}
          >
            編集モード
          </Button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        <button
          className={`px-4 py-2 font-medium ${
            selectedTab === 'EVENT'
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
          onClick={() => setSelectedTab('EVENT')}
        >
          イベント
        </button>
        <button
          className={`px-4 py-2 font-medium ${
            selectedTab === 'MEETING'
              ? 'text-primary border-b-2 border-primary'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
          onClick={() => setSelectedTab('MEETING')}
        >
          協力隊MTG
        </button>
      </div>

      {viewMode === 'edit' && (
        <div className="mb-4">
          <Button
            onClick={() => {
              setCategoryForm({ ...categoryForm, type: selectedTab });
              setCategoryDialog(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            カテゴリ追加
          </Button>
        </div>
      )}

      <div className="space-y-4">
        {displayCategories.map((category) => (
          <div key={category.id} className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <button
              onClick={() => toggleCategory(category.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                {expandedCategories.has(category.id) ? (
                  <ChevronDown className="w-5 h-5" />
                ) : (
                  <ChevronRight className="w-5 h-5" />
                )}
                <h2 className="text-xl font-semibold">{category.name}</h2>
                {category.description && (
                  <span className="text-sm text-gray-500">{category.description}</span>
                )}
              </div>
            </button>

            {expandedCategories.has(category.id) && (
              <div className="p-4 border-t border-gray-200 dark:border-gray-700">
                {viewMode === 'edit' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setFolderForm({ ...folderForm, categoryId: category.id });
                      setFolderDialog(true);
                    }}
                    className="mb-4"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    年度フォルダ追加
                  </Button>
                )}

                <div className="space-y-4">
                  {category.folders.map((folder) => (
                    <div key={folder.id} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Folder className="w-5 h-5 text-primary" />
                        <h3 className="text-lg font-semibold">
                          {folder.fiscalYear}年度 - {folder.title}
                        </h3>
                      </div>

                      {viewMode === 'edit' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            resetDocumentForm();
                            setDocumentForm({ ...documentForm, folderId: folder.id });
                            setDocumentDialog(true);
                          }}
                          className="mb-3"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          文書追加
                        </Button>
                      )}

                      <div className="space-y-2">
                        {folder.documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                            onClick={() => handleViewDocument(doc.id)}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <FileText className="w-4 h-4 text-gray-500" />
                              <span className="font-medium">{doc.title}</span>
                              {doc.budget && (
                                <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded">
                                  ¥{doc.budget.toLocaleString()}
                                </span>
                              )}
                              {doc.venue && (
                                <span className="px-2 py-1 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded">
                                  {doc.venue}
                                </span>
                              )}
                              {doc.relatedContactIds && doc.relatedContactIds.length > 0 && (
                                <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200 rounded flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  町民{doc.relatedContactIds.length}名
                                </span>
                              )}
                              {doc.relatedMemberIds && doc.relatedMemberIds.length > 0 && (
                                <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 rounded flex items-center gap-1">
                                  <Users className="w-3 h-3" />
                                  協力隊{doc.relatedMemberIds.length}名
                                </span>
                              )}
                            </div>
                            {viewMode === 'edit' && (
                              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => handleEditDocument(doc)}
                                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteDocument(doc.id)}
                                  className="p-1 hover:bg-red-100 dark:hover:bg-red-900 rounded text-red-600"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* カテゴリ作成ダイアログ */}
      {categoryDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">カテゴリ追加</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">カテゴリ名</label>
                <input
                  type="text"
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">説明</label>
                <textarea
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" onClick={() => setCategoryDialog(false)}>
                キャンセル
              </Button>
              <Button onClick={handleCreateCategory}>作成</Button>
            </div>
          </div>
        </div>
      )}

      {/* フォルダ作成ダイアログ */}
      {folderDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">年度フォルダ追加</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">年度</label>
                <input
                  type="number"
                  value={folderForm.fiscalYear}
                  onChange={(e) => setFolderForm({ ...folderForm, fiscalYear: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">フォルダ名</label>
                <input
                  type="text"
                  value={folderForm.title}
                  onChange={(e) => setFolderForm({ ...folderForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">説明</label>
                <textarea
                  value={folderForm.description}
                  onChange={(e) => setFolderForm({ ...folderForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" onClick={() => setFolderDialog(false)}>
                キャンセル
              </Button>
              <Button onClick={handleCreateFolder}>作成</Button>
            </div>
          </div>
        </div>
      )}

      {/* 文書作成/編集ダイアログ */}
      {documentDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full m-4">
            <h2 className="text-xl font-bold mb-4">{editingId ? '文書編集' : '文書作成'}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">タイトル</label>
                <input
                  type="text"
                  value={documentForm.title}
                  onChange={(e) => setDocumentForm({ ...documentForm, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">内容</label>
                <textarea
                  value={documentForm.content}
                  onChange={(e) => setDocumentForm({ ...documentForm, content: e.target.value })}
                  rows={10}
                  placeholder="準備段階のメモ、議事録、振り返りなどを記入してください"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">予算（円）</label>
                  <input
                    type="number"
                    value={documentForm.budget}
                    onChange={(e) => setDocumentForm({ ...documentForm, budget: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">場所</label>
                  <input
                    type="text"
                    value={documentForm.venue}
                    onChange={(e) => setDocumentForm({ ...documentForm, venue: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700"
                  />
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" onClick={() => {
                setDocumentDialog(false);
                resetDocumentForm();
              }}>
                キャンセル
              </Button>
              <Button onClick={handleCreateDocument}>
                {editingId ? '更新' : '作成'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 文書閲覧ダイアログ */}
      {documentViewDialog && selectedDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full m-4">
            <h2 className="text-xl font-bold mb-4">{selectedDocument.title}</h2>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {selectedDocument.budget && (
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded">
                    予算: ¥{selectedDocument.budget.toLocaleString()}
                  </span>
                )}
                {selectedDocument.venue && (
                  <span className="px-3 py-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded">
                    場所: {selectedDocument.venue}
                  </span>
                )}
              </div>

              {selectedDocument.relatedContactIds && selectedDocument.relatedContactIds.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">関わった町民:</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedDocument.relatedContactIds.map(contactId => {
                      const contact = contacts.find(c => c.id === contactId);
                      return contact ? (
                        <span key={contactId} className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded">
                          {contact.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {selectedDocument.relatedMemberIds && selectedDocument.relatedMemberIds.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">関わった協力隊:</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedDocument.relatedMemberIds.map(userId => {
                      const user = users.find(u => u.id === userId);
                      return user ? (
                        <span key={userId} className="px-2 py-1 text-sm bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 rounded">
                          {user.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              <div className="prose dark:prose-invert max-w-none">
                <pre className="whitespace-pre-wrap font-sans">{selectedDocument.content}</pre>
              </div>

              <div className="text-sm text-gray-500 border-t border-gray-200 dark:border-gray-700 pt-4">
                作成者: {selectedDocument.createdBy.name} | 
                作成日: {new Date(selectedDocument.createdAt).toLocaleDateString('ja-JP')}
                {selectedDocument.updatedBy && (
                  <> | 更新者: {selectedDocument.updatedBy.name}</>
                )}
              </div>
            </div>
            <div className="flex justify-end mt-6">
              <Button onClick={() => setDocumentViewDialog(false)}>閉じる</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Handover;
