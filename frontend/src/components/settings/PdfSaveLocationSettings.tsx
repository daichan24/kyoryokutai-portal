import React, { useEffect, useState } from 'react';
import { FolderOpen, X } from 'lucide-react';
import {
  DEFAULT_PDF_FILE_NAME_TEMPLATE,
  PDF_FILE_NAME_TOKENS,
  PDF_SAVE_LOCATION_LABELS,
  clearSaveDirectory,
  getSavedDirectoryName,
  isDirectoryPickerSupported,
  pickSaveDirectory,
  renderPdfFileName,
  type PdfSaveLocationType,
} from '../../utils/pdfSaveLocations';

const PDF_SAVE_LOCATION_TYPES = Object.keys(PDF_SAVE_LOCATION_LABELS) as PdfSaveLocationType[];

interface PdfSaveLocationSettingsProps {
  fileNameTemplates: Partial<Record<PdfSaveLocationType, string>>;
  onFileNameTemplateChange: (type: PdfSaveLocationType, value: string) => void;
}

export const PdfSaveLocationSettings: React.FC<PdfSaveLocationSettingsProps> = ({
  fileNameTemplates,
  onFileNameTemplateChange,
}) => {
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
        帳票ごとに保存先フォルダとファイル名の形式をあらかじめ指定できます。保存先フォルダを指定しておくと、
        PDF出力時に保存先を選ぶ画面を出さず、直接そのフォルダに保存します。保存先フォルダはこのブラウザ・端末
        だけに記憶され、他の端末には引き継がれません。ファイル名の形式はアカウントに保存され、どの端末でも
        同じ形式が使われます。
      </p>

      <div className="mb-4 rounded-md bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">ファイル名で使えるトークン</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {PDF_FILE_NAME_TOKENS.map(({ token, description }) => (
            <span key={token} className="text-xs text-gray-500 dark:text-gray-400">
              <code className="text-primary font-mono">{token}</code> = {description}
            </span>
          ))}
        </div>
      </div>

      {!supported && (
        <p className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2 mb-4">
          お使いのブラウザは保存先フォルダの指定に対応していません（Chrome・Edgeなどでご利用いただけます）。
          ファイル名の形式は今まで通り設定できます。
        </p>
      )}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">読み込み中...</p>
      ) : (
        <div className="space-y-3">
          {PDF_SAVE_LOCATION_TYPES.map((type) => {
            const folderName = folderNames[type];
            const template = fileNameTemplates[type] || '';
            const preview = renderPdfFileName(template, {
              name: '山田太郎',
              date: '20260831',
              type: PDF_SAVE_LOCATION_LABELS[type],
            });
            return (
              <div key={type} className="rounded-md border border-gray-200 dark:border-gray-700 px-3 py-3 space-y-2">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {PDF_SAVE_LOCATION_LABELS[type]}
                </div>

                {supported && (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <FolderOpen className="w-3.5 h-3.5" />
                      {folderName ? folderName : '未設定（保存時に毎回選択）'}
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
                )}

                <div>
                  <input
                    type="text"
                    value={template}
                    onChange={(e) => onFileNameTemplateChange(type, e.target.value)}
                    placeholder={DEFAULT_PDF_FILE_NAME_TEMPLATE}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    保存されるファイル名: <span className="font-mono">{preview}</span>
                  </p>
                </div>
              </div>
            );
          })}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            ※ 保存先フォルダはこのページ上部の「表示設定を保存」を押さなくても即座に反映されます。ファイル名の形式は
            「表示設定を保存」で保存してください。
          </p>
          {supported && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              ※ ブラウザを再起動した後の初回保存時のみ、選んだフォルダへのアクセスを許可する簡単な確認が出ることがあります。
            </p>
          )}
        </div>
      )}
    </div>
  );
};
