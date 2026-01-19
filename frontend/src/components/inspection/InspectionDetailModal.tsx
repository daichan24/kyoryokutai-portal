import React, { useState, useEffect } from 'react';
import { X, FileDown, Edit2, Eye } from 'lucide-react';
import { api } from '../../utils/api';
import { format } from 'date-fns';
import { SimpleRichTextEditor } from '../editor/SimpleRichTextEditor';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { useAuthStore } from '../../stores/authStore';
import { InspectionPreview } from './InspectionPreview';

interface Inspection {
  id: string;
  date: string;
  destination: string;
  purpose: string;
  inspectionPurpose: string;
  inspectionContent: string;
  reflection: string;
  futureAction: string;
  participants: string[];
  user: { id: string; name: string; department?: string | null; missionType?: 'FREE' | 'MISSION' | null };
  project?: { id: string; projectName: string };
}

interface InspectionDetailModalProps {
  inspectionId: string;
  onClose: () => void;
  onUpdated?: () => void;
  viewMode?: 'edit' | 'preview'; // 表示モード（デフォルトはedit）
}

export const InspectionDetailModal: React.FC<InspectionDetailModalProps> = ({
  inspectionId,
  onClose,
  onUpdated,
  viewMode: initialViewMode = 'edit',
}) => {
  const { user } = useAuthStore();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [isEditing, setIsEditing] = useState(initialViewMode === 'edit');
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>(initialViewMode);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 編集用の状態
  const [inspectionPurpose, setInspectionPurpose] = useState('');
  const [inspectionContent, setInspectionContent] = useState('');
  const [reflection, setReflection] = useState('');
  const [futureAction, setFutureAction] = useState('');

  // 作成者のみ編集可能
  const canEdit = inspection && user && inspection.user.id === user.id;

  useEffect(() => {
    fetchInspection();
  }, [inspectionId]);

  const fetchInspection = async () => {
    try {
      const response = await api.get<Inspection>(`/api/inspections/${inspectionId}`);
      setInspection(response.data);
      if (response.data) {
        setInspectionPurpose(response.data.inspectionPurpose);
        setInspectionContent(response.data.inspectionContent);
        setReflection(response.data.reflection);
        setFutureAction(response.data.futureAction);
      }
    } catch (error) {
      console.error('Failed to fetch inspection:', error);
      alert('視察記録の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!inspection) return;
    setSaving(true);
    try {
      await api.put(`/api/inspections/${inspectionId}`, {
        inspectionPurpose,
        inspectionContent,
        reflection,
        futureAction,
      });
      setIsEditing(false);
      await fetchInspection();
      onUpdated?.();
      alert('保存しました');
    } catch (error) {
      console.error('Failed to save inspection:', error);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await api.get(`/api/inspections/${inspectionId}/pdf`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `視察復命書_${format(new Date(inspection?.date || new Date()), 'yyyyMMdd')}_${inspection?.destination || ''}.pdf`);
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      link.remove();
    } catch (error) {
      console.error('PDF download failed:', error);
      alert('PDF出力に失敗しました');
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          <div className="text-center dark:text-gray-300">読み込み中...</div>
        </div>
      </div>
    );
  }

  if (!inspection) {
    return null;
  }

  // プレビュー用の視察データを作成（編集中のデータも反映）
  const previewInspection: Inspection | null = inspection ? {
    ...inspection,
    inspectionPurpose,
    inspectionContent,
    reflection,
    futureAction,
  } : null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-[210mm] max-h-[95vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <h2 className="text-2xl font-bold dark:text-gray-100">視察復命書</h2>
          <div className="flex items-center gap-2">
            {/* タブ切り替え */}
            <button
              onClick={() => {
                setViewMode('edit');
                setIsEditing(true);
              }}
              className={`px-3 py-1.5 text-sm font-medium transition-colors rounded ${
                viewMode === 'edit'
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              編集
            </button>
            <button
              onClick={() => {
                setViewMode('preview');
                setIsEditing(false);
              }}
              className={`px-3 py-1.5 text-sm font-medium transition-colors rounded ${
                viewMode === 'preview'
                  ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              プレビュー
            </button>
            {!isEditing && viewMode === 'edit' && (
              <>
                <Button variant="outline" onClick={handleDownloadPDF} size="sm">
                  <FileDown className="w-4 h-4 mr-2" />
                  PDF出力
                </Button>
                {canEdit && (
                  <Button variant="outline" onClick={() => setIsEditing(true)} size="sm">
                    <Edit2 className="w-4 h-4 mr-2" />
                    編集
                  </Button>
                )}
              </>
            )}
            <button onClick={onClose} className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {viewMode === 'preview' && previewInspection ? (
            <div className="p-4 bg-gray-100 dark:bg-gray-900 flex justify-center">
              <div className="shadow-lg">
                <InspectionPreview inspection={previewInspection} />
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6" style={{ maxWidth: '210mm' }}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">視察日</label>
              <div className="text-gray-900 dark:text-gray-100">{format(new Date(inspection.date), 'yyyy年M月d日')}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">視察先</label>
              <div className="text-gray-900 dark:text-gray-100">{inspection.destination}</div>
            </div>
            {inspection.project && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">関連プロジェクト</label>
                <div className="text-gray-900 dark:text-gray-100">{inspection.project.projectName}</div>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">参加者</label>
              <div className="text-gray-900 dark:text-gray-100">
                {inspection.user.name}
                {inspection.participants.length > 0 && `、${inspection.participants.join('、')}`}
              </div>
            </div>
          </div>

          {isEditing ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">視察目的</label>
                <SimpleRichTextEditor
                  value={inspectionPurpose}
                  onChange={setInspectionPurpose}
                  placeholder="視察目的を入力..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">視察内容</label>
                <SimpleRichTextEditor
                  value={inspectionContent}
                  onChange={setInspectionContent}
                  placeholder="視察内容を入力..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">所感</label>
                <SimpleRichTextEditor
                  value={reflection}
                  onChange={setReflection}
                  placeholder="所感を入力..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">今後のアクション</label>
                <SimpleRichTextEditor
                  value={futureAction}
                  onChange={setFutureAction}
                  placeholder="今後のアクションを入力..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700">
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  キャンセル
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? '保存中...' : '保存'}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">1. 視察目的</h3>
                <div 
                  className="prose max-w-none text-gray-700 dark:text-gray-300 dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: inspection.inspectionPurpose }}
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">2. 視察内容</h3>
                <div 
                  className="prose max-w-none text-gray-700 dark:text-gray-300 dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: inspection.inspectionContent }}
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">3. 所感</h3>
                <div 
                  className="prose max-w-none text-gray-700 dark:text-gray-300 dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: inspection.reflection }}
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">4. 今後のアクション</h3>
                <div 
                  className="prose max-w-none text-gray-700 dark:text-gray-300 dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: inspection.futureAction }}
                />
              </div>
            </>
          )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

