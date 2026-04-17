import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import api from '../lib/api';

interface CooperationRule {
  id: string;
  fiscalYear: number;
  title: string;
  content: string;
  version: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const CooperationRules: React.FC = () => {
  const [rules, setRules] = useState<CooperationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState<CooperationRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    fiscalYear: new Date().getFullYear(),
    title: '',
    content: '',
    isActive: true,
  });

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const response = await api.get('/cooperation-rules');
      setRules(response.data);
    } catch (error) {
      console.error('Failed to fetch rules:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      await api.post('/cooperation-rules', formData);
      await fetchRules();
      setIsCreating(false);
      setFormData({
        fiscalYear: new Date().getFullYear(),
        title: '',
        content: '',
        isActive: true,
      });
    } catch (error) {
      console.error('Failed to create rule:', error);
      alert('細則の作成に失敗しました');
    }
  };

  const handleUpdate = async () => {
    if (!editingRule) return;
    
    try {
      await api.put(`/cooperation-rules/${editingRule.fiscalYear}`, {
        title: formData.title,
        content: formData.content,
        isActive: formData.isActive,
      });
      await fetchRules();
      setEditingRule(null);
    } catch (error) {
      console.error('Failed to update rule:', error);
      alert('細則の更新に失敗しました');
    }
  };

  const handleDelete = async (fiscalYear: number) => {
    if (!confirm('この細則を削除してもよろしいですか？')) return;
    
    try {
      await api.delete(`/cooperation-rules/${fiscalYear}`);
      await fetchRules();
    } catch (error) {
      console.error('Failed to delete rule:', error);
      alert('細則の削除に失敗しました');
    }
  };

  const startEdit = (rule: CooperationRule) => {
    setEditingRule(rule);
    setFormData({
      fiscalYear: rule.fiscalYear,
      title: rule.title,
      content: rule.content,
      isActive: rule.isActive,
    });
  };

  const cancelEdit = () => {
    setEditingRule(null);
    setIsCreating(false);
    setFormData({
      fiscalYear: new Date().getFullYear(),
      title: '',
      content: '',
      isActive: true,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">協力隊細則管理</h1>
        {!isCreating && !editingRule && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-5 h-5" />
            新規作成
          </button>
        )}
      </div>

      {(isCreating || editingRule) && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">
            {isCreating ? '新規細則作成' : '細則編集'}
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                年度
              </label>
              <input
                type="number"
                value={formData.fiscalYear}
                onChange={(e) => setFormData({ ...formData, fiscalYear: parseInt(e.target.value) })}
                disabled={!!editingRule}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                タイトル
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="例: 2025年度 協力隊細則"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                内容
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={15}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                placeholder="細則の内容を入力してください（Markdown形式対応）"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                有効
              </label>
            </div>

            <div className="flex gap-2">
              <button
                onClick={isCreating ? handleCreate : handleUpdate}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Save className="w-4 h-4" />
                保存
              </button>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                <X className="w-4 h-4" />
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {rules.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center text-gray-500">
            細則が登録されていません
          </div>
        ) : (
          rules.map((rule) => (
            <div key={rule.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-xl font-semibold text-gray-900">
                      {rule.fiscalYear}年度
                    </h3>
                    {rule.isActive ? (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                        有効
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded">
                        無効
                      </span>
                    )}
                  </div>
                  <p className="text-lg text-gray-700 mt-1">{rule.title}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    バージョン: {rule.version} | 
                    最終更新: {new Date(rule.updatedAt).toLocaleDateString('ja-JP')}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(rule)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(rule.fiscalYear)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">
                  {rule.content}
                </pre>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CooperationRules;
