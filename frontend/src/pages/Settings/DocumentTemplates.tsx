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
      const response = await api.get('/api/document-templates');
      // APIレスポンスの形式を確認
      if (response.data && (response.data.weeklyReport || response.data.monthlyReport || response.data.inspection)) {
        setSettings(response.data as TemplateSettings);
      } else {
        // デフォルト値を設定
        setSettings({
          weeklyReport: {
            recipient: '○○市役所　○○課長　様',
            title: '地域おこし協力隊活動報告',
          },
          monthlyReport: {
            recipient: '長沼町長　齋　藤　良　彦　様',
            sender: '一般社団法人まおいのはこ<br>代表理事　坂本　一志',
            title: '長沼町地域おこし協力隊サポート業務月次報告',
            text1: '表記業務の結果について別紙のとおり報告いたします。',
            text2: '報告内容\n・隊員別ヒアリングシート ◯名分\n・一般社団法人まおいのはこの支援内容\n・月次勤怠表',
            contact: '担当　代表理事　坂本　一志、電話　090-6218-4797、E-mail　info@maoinohako.org',
          },
          inspection: {
            recipient: '長沼町長　齋　藤　良　彦　様',
            text1: '次の通り復命します。',
            item1: '（参考: 視察日時を記入してください）',
            item2: '（参考: 視察先の場所を記入してください）',
            item3: '（参考: 視察の用務内容を記入してください）',
            item4: '（参考: 視察の目的を記入してください）',
            item5: '（参考: 視察の内容を記入してください）',
            item6: '（参考: 処理の経過や結果を記入してください）',
            item7: '（参考: 所感や今後の予定を記入してください）',
            item8: '（参考: その他の報告事項があれば記入してください）',
          },
        });
      }
    } catch (error) {
      console.error('Failed to fetch template settings:', error);
      // エラー時もデフォルト値を設定
      setSettings({
        weeklyReport: {
          recipient: '○○市役所　○○課長　様',
          title: '地域おこし協力隊活動報告',
        },
        monthlyReport: {
          recipient: '長沼町長　齋　藤　良　彦　様',
          sender: '一般社団法人まおいのはこ<br>代表理事　坂本　一志',
          title: '長沼町地域おこし協力隊サポート業務月次報告',
          text1: '表記業務の結果について別紙のとおり報告いたします。',
          text2: '報告内容\n・隊員別ヒアリングシート ◯名分\n・一般社団法人まおいのはこの支援内容\n・月次勤怠表',
          contact: '担当　代表理事　坂本　一志、電話　090-6218-4797、E-mail　info@maoinohako.org',
        },
        inspection: {
          recipient: '長沼町長　齋　藤　良　彦　様',
          text1: '次の通り復命します。',
          item1: '（参考: 視察日時を記入してください）',
          item2: '（参考: 視察先の場所を記入してください）',
          item3: '（参考: 視察の用務内容を記入してください）',
          item4: '（参考: 視察の目的を記入してください）',
          item5: '（参考: 視察の内容を記入してください）',
          item6: '（参考: 処理の経過や結果を記入してください）',
          item7: '（参考: 所感や今後の予定を記入してください）',
          item8: '（参考: その他の報告事項があれば記入してください）',
        },
      });
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
      await fetchSettings();
    } catch (error: any) {
      console.error('Failed to save template settings:', error);
      alert(error?.response?.data?.error || '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleInit = async () => {
    if (!confirm('テンプレート設定をデフォルト値で初期化しますか？')) return;

    setSaving(true);
    try {
      await api.post('/api/document-templates/init');
      alert('テンプレート設定を初期化しました');
      await fetchSettings();
    } catch (error: any) {
      console.error('Failed to initialize template settings:', error);
      alert(error?.response?.data?.error || '初期化に失敗しました');
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
          <div className="flex gap-2">
            <Button onClick={handleInit} variant="outline" disabled={saving}>
              初期化
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? '保存中...' : '保存'}
            </Button>
          </div>
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

