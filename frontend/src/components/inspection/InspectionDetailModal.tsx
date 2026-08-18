import React, { useState, useEffect } from 'react';
import { X, Edit2, Upload, Trash2, FileDown } from 'lucide-react';
import { api } from '../../utils/api';
import { format } from 'date-fns';
import { SimpleRichTextEditor } from '../editor/SimpleRichTextEditor';
import { Button } from '../common/Button';
import { useAuthStore } from '../../stores/authStore';
import { InspectionPreview } from './InspectionPreview';
import { InspectionAttachmentImage } from './InspectionAttachmentImage';

interface InspectionAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
}

interface Inspection {
  id: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  destination: string;
  purpose: string;
  inspectionPurpose: string;
  inspectionContent: string;
  reflection: string;
  futureAction: string;
  participants: string[];
  user: { id: string; name: string; department?: string | null; missionType?: 'FREE' | 'MISSION' | null };
  project?: { id: string; projectName: string };
  schedule?: { id: string; title?: string | null; startDate?: string | null; locationText?: string | null } | null;
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvalComment?: string | null;
  approvedAt?: string | null;
  approver?: { id: string; name: string } | null;
  attachments?: InspectionAttachment[];
}

const ALLOWED_ATTACHMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
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
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [showPDFConfirm, setShowPDFConfirm] = useState(false);

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
      alert('復命書の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (asDraft?: boolean) => {
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
      alert(asDraft ? '下書きを保存しました（いつでも続きから編集できます）' : '保存しました');
    } catch (error) {
      console.error('Failed to save inspection:', error);
      alert('保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
      alert('対応していない画像形式です（JPEG・PNG・WebP・HEICのみ）');
      return;
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      alert('画像サイズは8MB以下にしてください');
      return;
    }

    setUploadingAttachment(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      await api.post(`/api/inspections/${inspectionId}/attachments`, {
        fileName: file.name,
        mimeType: file.type,
        dataBase64: dataUrl,
      });
      await fetchInspection();
      onUpdated?.();
    } catch (error) {
      console.error('Failed to upload attachment:', error);
      alert('画像の添付に失敗しました');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm('この画像を削除しますか？')) return;
    try {
      await api.delete(`/api/inspections/${inspectionId}/attachments/${attachmentId}`);
      await fetchInspection();
      onUpdated?.();
    } catch (error) {
      console.error('Failed to delete attachment:', error);
      alert('画像の削除に失敗しました');
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const response = await api.get(`/api/inspections/${inspectionId}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `復命書_${inspection?.destination || inspectionId}.pdf`);
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      link.remove();
      setShowPDFConfirm(false);
    } catch (error) {
      console.error('Failed to download inspection PDF:', error);
      alert('PDF出力に失敗しました');
      setShowPDFConfirm(false);
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
  const approvalLabel =
    inspection.approvalStatus === 'APPROVED' ? '承認済み'
    : inspection.approvalStatus === 'REJECTED' ? '差し戻し'
    : '未承認';
  const approvalClass =
    inspection.approvalStatus === 'APPROVED'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
      : inspection.approvalStatus === 'REJECTED'
      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-[210mm] max-h-[95vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-10">
          <div>
            <h2 className="text-2xl font-bold dark:text-gray-100">復命書</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${approvalClass}`}>
                {approvalLabel}
              </span>
              {inspection.approver && inspection.approvedAt && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  対応: {inspection.approver.name}（{format(new Date(inspection.approvedAt), 'M/d HH:mm')}）
                </span>
              )}
            </div>
            {inspection.approvalComment && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">差し戻し理由: {inspection.approvalComment}</p>
            )}
          </div>
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
              <div className="text-gray-900 dark:text-gray-100">
                {format(new Date(inspection.date), 'yyyy年M月d日')}
                {inspection.startTime && (
                  <span className="ml-1 text-gray-600 dark:text-gray-400">
                    {inspection.startTime}{inspection.endTime ? `〜${inspection.endTime}` : ''}
                  </span>
                )}
              </div>
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
            {inspection.schedule && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">関連予定</label>
                <div className="text-blue-600 dark:text-blue-300">
                  {inspection.schedule.title || inspection.schedule.locationText || '予定'}
                  {inspection.schedule.startDate ? `（${format(new Date(inspection.schedule.startDate), 'M月d日')}）` : ''}
                </div>
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

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">添付画像</label>
              {canEdit && (
                <label className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded cursor-pointer ${uploadingAttachment ? 'opacity-50 pointer-events-none' : ''} bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30`}>
                  <Upload className="w-3.5 h-3.5" />
                  {uploadingAttachment ? 'アップロード中...' : '画像を追加'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic"
                    className="hidden"
                    onChange={handleUploadAttachment}
                    disabled={uploadingAttachment}
                  />
                </label>
              )}
            </div>
            {inspection.attachments && inspection.attachments.length > 0 ? (
              <div className="flex flex-wrap gap-3">
                {inspection.attachments.map((a) => (
                  <div key={a.id} className="relative group">
                    <InspectionAttachmentImage
                      inspectionId={inspection.id}
                      attachmentId={a.id}
                      alt={a.fileName}
                      className="w-24 h-24 rounded border border-gray-200 dark:border-gray-700 object-cover"
                    />
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleDeleteAttachment(a.id)}
                        className="absolute -top-2 -right-2 p-1 rounded-full bg-red-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        title="削除"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">添付画像はありません</p>
            )}
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
              <div className="flex flex-wrap justify-end gap-3 pt-4 border-t dark:border-gray-700">
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  キャンセル
                </Button>
                {canEdit && (
                  <Button variant="outline" onClick={() => handleSave(true)} disabled={saving}>
                    {saving ? '保存中...' : '下書き保存'}
                  </Button>
                )}
                <Button onClick={() => handleSave(false)} disabled={saving}>
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

        {viewMode === 'preview' && previewInspection && (
          <div className="flex justify-end p-4 sm:p-6 border-t dark:border-gray-700 flex-shrink-0 bg-white dark:bg-gray-800">
            <Button type="button" variant="outline" onClick={() => setShowPDFConfirm(true)}>
              <FileDown className="w-4 h-4 mr-2" />
              PDF出力
            </Button>
          </div>
        )}
      </div>

      {showPDFConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full m-4 p-6">
            <h3 className="text-xl font-bold dark:text-gray-100 mb-4">
              ローカルに保存しますか？
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              PDFファイルをローカルPCに保存します。
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowPDFConfirm(false)}>
                キャンセル
              </Button>
              <Button onClick={handleDownloadPDF}>
                OK
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
