/**
 * PDFなどのファイルを保存する。File System Access API (showSaveFilePicker) が
 * 使えるブラウザ(Chrome/Edge等)では、保存先フォルダ・ファイル名を選べる
 * 「名前を付けて保存」ダイアログを出す。使えないブラウザ(Firefox/Safari等)や
 * ユーザーがキャンセルした場合は、従来通りダウンロードフォルダへの自動保存に
 * フォールバックする。
 */
export async function saveBlobAsFile(
  blob: Blob,
  suggestedName: string,
  options?: { description?: string; mimeType?: string; extension?: string }
) {
  const picker = (window as unknown as { showSaveFilePicker?: (opts: unknown) => Promise<FileSystemFileHandle> })
    .showSaveFilePicker;

  if (typeof picker === 'function') {
    try {
      const mimeType = options?.mimeType || 'application/pdf';
      const extension = options?.extension || '.pdf';
      const handle = await picker({
        suggestedName,
        types: [
          {
            description: options?.description || 'PDFファイル',
            accept: { [mimeType]: [extension] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (error) {
      // ユーザーがダイアログをキャンセルした場合は何もしない
      if (error instanceof Error && error.name === 'AbortError') return;
      // それ以外のエラー(未対応環境など)は従来のダウンロード方式にフォールバック
    }
  }

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', suggestedName);
  document.body.appendChild(link);
  link.click();
  window.URL.revokeObjectURL(url);
  link.remove();
}

/**
 * PDFダウンロードなど、時間のかかりうる通信のエラーを分かりやすい文言にする。
 * サーバー側でPDF生成にブラウザエンジンを起動するため、混雑時やコールド
 * スタート直後はタイムアウトすることがある。
 */
export function describeDownloadError(error: unknown): string {
  const apiError = error as {
    code?: string;
    message?: string;
    response?: { data?: { error?: string } };
  };
  const serverMessage = apiError?.response?.data?.error;
  if (serverMessage) return serverMessage;

  const isTimeout = apiError?.code === 'ECONNABORTED' || /timeout/i.test(apiError?.message || '');
  if (isTimeout) {
    return 'PDFの作成に時間がかかっており、タイムアウトしました。少し時間をおいて、もう一度お試しください。';
  }

  return (error instanceof Error ? error.message : null) || 'PDF出力に失敗しました';
}
