import React, { useEffect, useState } from 'react';
import { FolderOpen, X } from 'lucide-react';
import {
  PDF_SAVE_LOCATION_LABELS,
  clearSaveDirectory,
  getSavedDirectoryName,
  isDirectoryPickerSupported,
  pickSaveDirectory,
  type PdfSaveLocationType,
} from '../../utils/pdfSaveLocations';

const PDF_SAVE_LOCATION_TYPES = Object.keys(PDF_SAVE_LOCATION_LABELS) as PdfSaveLocationType[];

export const PdfSaveLocationSettings: React.FC = () => {
  const supported = isDirectoryPickerSupported();
  const [folderNames, setFolderNames] = useState<Partial<Record<PdfSaveLocationType, string>>>({});
  const [loading, setLoading] = useState(true);
  const [busyType, setBusyType] = useState<PdfSaveLocationType | null>(null);

  useEffect(() => {
    if (!supported) {
      setLoading(false);
      return;
    }
    (async () => {
      const entries = await Promise.all(
        PDF_SAVE_LOCATION_TYPES.map(async (type) => [type, await getSavedDirectoryName(type)] as const),
      );
      const next: Partial<Record<PdfSaveLocationType, string>> = {};
      for (const [type, name] of entries) {
        if (name) next[type] = name;
      }
      setFolderNames(next);
      setLoading(false);
    })();
  }, [supported]);

  const handlePick = async (type: PdfSaveLocationType) => {
    setBusyType(type);
    try {
      const name = await pickSaveDirectory(type);
      if (name) {
        setFolderNames((prev) => ({ ...prev, [type]: name }));
      }
    } catch (error) {
      console.error('Failed to pick save directory:', error);
      alert('フォルダの設定に失敗しました');
    } finally {
      setBusyType(null);
    }
  };

  const handleClear = async (type: PdfSaveLocationType) => {
    await clearSaveDirectory(type);
    setFolderNames((prev) => {
      const next = { ...prev };
      delete next[type];
      return next;
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-border dark:border-gray-700 p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">PDF保存先の設定</h2>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        帳票ごとに保存先フォルダをあらかじめ指定しておくと、PDF出力時に保存先を選ぶ画面を出さず、
        直接そのフォルダに保存します。未設定の場合は今まで通り、保存の都度フォルダを選べます。
        この設定は今使っているブラウザ・端末だけに記憶され、他の端末には引き継がれません。
      </p>

      {!supported ? (
        <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
          お使いのブラウザはこの機能に対応していません（Chrome・Edgeなどでご利用いただけます）。
          今まで通り、保存の都度フォルダを選ぶ動作になります。
        </p>
      ) : loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">読み込み中...</p>
      ) : (
        <div className="space-y-3">
          {PDF_SAVE_LOCATION_TYPES.map((type) => {
            const folderName = folderNames[type];
            return (
              <div
                key={type}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2"
              >
                <div>
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {PDF_SAVE_LOCATION_LABELS[type]}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                    <FolderOpen className="w-3.5 h-3.5" />
                    {folderName ? folderName : '未設定（保存時に毎回選択）'}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => handlePick(type)}
                    disabled={busyType === type}
                    className="h-8 rounded-md border border-gray-200 dark:border-gray-700 px-3 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    {folderName ? '変更' : 'フォルダを選択'}
                  </button>
                  {folderName && (
                    <button
                      type="button"
                      onClick={() => handleClear(type)}
                      className="h-8 flex items-center gap-1 rounded-md border border-gray-200 dark:border-gray-700 px-3 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <X className="w-3.5 h-3.5" />
                      解除
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            ※ ブラウザを再起動した後の初回保存時のみ、選んだフォルダへのアクセスを許可する簡単な確認が出ることがあります。
          </p>
        </div>
      )}
    </div>
  );
};
