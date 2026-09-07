/**
 * PDF出力の保存先フォルダをブラウザに記憶しておく仕組み。
 * File System Access API (showDirectoryPicker) でユーザーが選んだフォルダの
 * ハンドルをIndexedDBに保存し、次回以降は「名前を付けて保存」ダイアログを
 * 出さずに直接そのフォルダへ書き込む。対応ブラウザ(Chrome/Edge等)限定で、
 * 未対応ブラウザやフォルダ未設定の場合は呼び出し側で従来の保存方法にフォールバックする。
 *
 * 設定はブラウザのIndexedDBに保存されるため、端末・ブラウザごとの設定になる
 * （サーバー側のユーザー設定とは同期されない）。
 */

export type PdfSaveLocationType = 'weeklyReport' | 'monthlyReport' | 'inspection' | 'nudges';

export const PDF_SAVE_LOCATION_LABELS: Record<PdfSaveLocationType, string> = {
  weeklyReport: '週次報告書',
  monthlyReport: '月次報告書',
  inspection: '複命書',
  nudges: '協力隊細則',
};

export const DEFAULT_PDF_FILE_NAME_TEMPLATE = '{name}_{date}_{type}';

/** ファイル名テンプレートで使えるトークン一覧（設定画面の説明表示にも使う） */
export const PDF_FILE_NAME_TOKENS: Array<{ token: string; description: string }> = [
  { token: '{name}', description: '対象者の氏名' },
  { token: '{date}', description: '対象の日付（例: 20260831）' },
  { token: '{type}', description: '帳票の種類（例: 週次報告書）' },
];

export interface PdfFileNameTokens {
  name?: string;
  date?: string;
  type?: string;
}

function sanitizeFileNameSegment(value: string): string {
  // OS上で使えない文字をアンダースコアに置き換える
  return value.replace(/[\\/:*?"<>|]/g, '_').trim();
}

/**
 * ファイル名テンプレート（例: "{name}_{date}_{type}"）にトークンの値を埋め込み、
 * ".pdf"付きのファイル名を組み立てる。テンプレート未設定時は既定のテンプレートを使う。
 */
export function renderPdfFileName(
  template: string | undefined | null,
  tokens: PdfFileNameTokens,
): string {
  const source = template && template.trim() ? template : DEFAULT_PDF_FILE_NAME_TEMPLATE;
  const replaced = source.replace(/\{(name|date|type)\}/g, (_match, key: keyof PdfFileNameTokens) => {
    const value = tokens[key];
    return value ? sanitizeFileNameSegment(value) : '';
  });
  const cleaned = replaced
    .replace(/[_\-\s]{2,}/g, '_')
    .replace(/^[_\-\s]+|[_\-\s]+$/g, '');
  return `${cleaned || tokens.type || 'PDF'}.pdf`;
}

interface WritableFileStreamLike {
  write: (data: Blob) => Promise<void>;
  close: () => Promise<void>;
}

interface FileHandleLike {
  createWritable: () => Promise<WritableFileStreamLike>;
}

interface DirectoryHandleLike {
  name: string;
  queryPermission: (opts: { mode: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
  requestPermission: (opts: { mode: 'read' | 'readwrite' }) => Promise<'granted' | 'denied' | 'prompt'>;
  getFileHandle: (name: string, opts?: { create?: boolean }) => Promise<FileHandleLike>;
}

function getDirectoryPicker(): ((opts?: unknown) => Promise<DirectoryHandleLike>) | undefined {
  return (window as unknown as { showDirectoryPicker?: (opts?: unknown) => Promise<DirectoryHandleLike> })
    .showDirectoryPicker;
}

export function isDirectoryPickerSupported(): boolean {
  return typeof getDirectoryPicker() === 'function';
}

const DB_NAME = 'pdf-save-locations';
const STORE_NAME = 'handles';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(key: string): Promise<DirectoryHandleLike | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: DirectoryHandleLike): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbDelete(key: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getSavedDirectoryName(type: PdfSaveLocationType): Promise<string | undefined> {
  if (!isDirectoryPickerSupported()) return undefined;
  const handle = await idbGet(type);
  return handle?.name;
}

/** フォルダ選択ダイアログを出し、選んだフォルダをそのPDF種別の保存先として記憶する */
export async function pickSaveDirectory(type: PdfSaveLocationType): Promise<string | null> {
  const picker = getDirectoryPicker();
  if (!picker) return null;
  try {
    const handle = await picker({ mode: 'readwrite' });
    await idbSet(type, handle);
    return handle.name;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') return null;
    throw error;
  }
}

export async function clearSaveDirectory(type: PdfSaveLocationType): Promise<void> {
  await idbDelete(type);
}

async function ensureReadWritePermission(handle: DirectoryHandleLike): Promise<boolean> {
  const opts = { mode: 'readwrite' as const };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  if ((await handle.requestPermission(opts)) === 'granted') return true;
  return false;
}

/**
 * 設定済みの保存先フォルダに直接書き込む。フォルダ未設定・権限拒否・書き込み
 * 失敗の場合はfalseを返す（呼び出し側は従来のダイアログ/ダウンロードにフォールバックする）。
 */
export async function trySaveToConfiguredDirectory(
  type: PdfSaveLocationType,
  blob: Blob,
  fileName: string,
): Promise<boolean> {
  if (!isDirectoryPickerSupported()) return false;
  const handle = await idbGet(type);
  if (!handle) return false;
  try {
    if (!(await ensureReadWritePermission(handle))) return false;
    const fileHandle = await handle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch (error) {
    console.error('Failed to save to configured directory:', error);
    return false;
  }
}
