import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { api } from '../../utils/api';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { LoadingSpinner } from '../../components/common/LoadingSpinner';
import { useAuthStore } from '../../stores/authStore';
import { SimpleRichTextEditor } from '../../components/editor/SimpleRichTextEditor';

interface TemplateSettings {
  weeklyReport: {
    recipient: string;
    title: string;
  };
  monthlyReport: {
    recipient: string;
    sender: string;
    title: string;
    text1: string;
    text2: string;
    contact: string;
  };
  inspection: {
    recipient: string;
    text1: string;
    item1: string;
    item2: string;
    item3: string;
    item4: string;
    item5: string;
    item6: string;
    item7: string;
    item8: string;
  };
}

export const DocumentTemplatesSettings: React.FC = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<TemplateSettings | null>(null);

  const canEdit = user?.role === 'SUPPORT' || user?.role === 'MASTER';

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await api.get<TemplateSettings>('/api/document-templates');
      setSettings(response.data);
    } catch (error) {
      console.error('Failed to fetch template settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      await api.put('/api/document-templates', settings);
      alert('テンプレート設定を保存しました');
    } catch (error: any) {
      console.error('Failed to save template settings:', error);
      alert(error?.response?.data?.error || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (!settings) {
    return <div className="text-center py-12 text-gray-500">設定を読み込めませんでした</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">テンプレート設定</h1>
        {canEdit && (
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? '保存中...' : '保存'}
          </Button>
        )}
      </div>

      {!canEdit && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-300">
            テンプレート設定の編集は、SUPPORTまたはMASTERロールのみ可能です。
          </p>
        </div>
      )}

      {/* 週次報告テンプレート */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 dark:text-gray-100">週次報告テンプレート</h2>
        <div className="space-y-4">
          <Input
            label="宛先"
            value={settings.weeklyReport.recipient}
            onChange={(e) =>
              setSettings({
                ...settings,
                weeklyReport: { ...settings.weeklyReport, recipient: e.target.value },
              })
            }
            disabled={!canEdit}
          />
          <Input
            label="タイトル"
            value={settings.weeklyReport.title}
            onChange={(e) =>
              setSettings({
                ...settings,
                weeklyReport: { ...settings.weeklyReport, title: e.target.value },
              })
            }
            disabled={!canEdit}
          />
        </div>
      </div>

      {/* 月次報告テンプレート */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 dark:text-gray-100">月次報告テンプレート</h2>
        <div className="space-y-4">
          <Input
            label="宛先"
            value={settings.monthlyReport.recipient}
            onChange={(e) =>
              setSettings({
                ...settings,
                monthlyReport: { ...settings.monthlyReport, recipient: e.target.value },
              })
            }
            disabled={!canEdit}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              差出人（HTML可）
            </label>
            <SimpleRichTextEditor
              value={settings.monthlyReport.sender}
              onChange={(value) =>
                setSettings({
                  ...settings,
                  monthlyReport: { ...settings.monthlyReport, sender: value },
                })
              }
              disabled={!canEdit}
            />
          </div>
          <Input
            label="タイトル（{month}は対象月に置換されます）"
            value={settings.monthlyReport.title}
            onChange={(e) =>
              setSettings({
                ...settings,
                monthlyReport: { ...settings.monthlyReport, title: e.target.value },
              })
            }
            disabled={!canEdit}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              テキスト1
            </label>
            <textarea
              value={settings.monthlyReport.text1}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  monthlyReport: { ...settings.monthlyReport, text1: e.target.value },
                })
              }
              disabled={!canEdit}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              テキスト2（改行可、{count}は隊員数に置換されます）
            </label>
            <textarea
              value={settings.monthlyReport.text2}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  monthlyReport: { ...settings.monthlyReport, text2: e.target.value },
                })
              }
              disabled={!canEdit}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              担当者情報
            </label>
            <textarea
              value={settings.monthlyReport.contact}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  monthlyReport: { ...settings.monthlyReport, contact: e.target.value },
                })
              }
              disabled={!canEdit}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
      </div>

      {/* 復命書テンプレート */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4 dark:text-gray-100">復命書テンプレート</h2>
        <div className="space-y-4">
          <Input
            label="宛先"
            value={settings.inspection.recipient}
            onChange={(e) =>
              setSettings({
                ...settings,
                inspection: { ...settings.inspection, recipient: e.target.value },
              })
            }
            disabled={!canEdit}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              テキスト1
            </label>
            <textarea
              value={settings.inspection.text1}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  inspection: { ...settings.inspection, text1: e.target.value },
                })
              }
              disabled={!canEdit}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                1. 日時（参考テキスト）
              </label>
              <textarea
                value={settings.inspection.item1}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    inspection: { ...settings.inspection, item1: e.target.value },
                  })
                }
                disabled={!canEdit}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                2. 場所（参考テキスト）
              </label>
              <textarea
                value={settings.inspection.item2}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    inspection: { ...settings.inspection, item2: e.target.value },
                  })
                }
                disabled={!canEdit}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                3. 用務（参考テキスト）
              </label>
              <textarea
                value={settings.inspection.item3}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    inspection: { ...settings.inspection, item3: e.target.value },
                  })
                }
                disabled={!canEdit}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                4. 目的（参考テキスト）
              </label>
              <textarea
                value={settings.inspection.item4}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    inspection: { ...settings.inspection, item4: e.target.value },
                  })
                }
                disabled={!canEdit}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                5. 内容（参考テキスト）
              </label>
              <textarea
                value={settings.inspection.item5}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    inspection: { ...settings.inspection, item5: e.target.value },
                  })
                }
                disabled={!canEdit}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                6. 処理てん末（参考テキスト）
              </label>
              <textarea
                value={settings.inspection.item6}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    inspection: { ...settings.inspection, item6: e.target.value },
                  })
                }
                disabled={!canEdit}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                7. 所感・今後（参考テキスト）
              </label>
              <textarea
                value={settings.inspection.item7}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    inspection: { ...settings.inspection, item7: e.target.value },
                  })
                }
                disabled={!canEdit}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                8. その他報告（参考テキスト）
              </label>
              <textarea
                value={settings.inspection.item8}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    inspection: { ...settings.inspection, item8: e.target.value },
                  })
                }
                disabled={!canEdit}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>
        </div>
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? '保存中...' : '保存'}
          </Button>
        </div>
      )}
    </div>
  );
};

