/** Content-Disposition からファイル名を取り出す（UTF-8 filename* 優先） */
export function fileNameFromContentDisposition(
  header: string | undefined,
  fallback: string,
): string {
  if (!header || typeof header !== 'string') return fallback;
  const star = /filename\*=UTF-8''([^;\s]+)/i.exec(header);
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].replace(/^"+|"+$/g, ''));
    } catch {
      return star[1];
    }
  }
  const q = /filename="([^"]+)"/i.exec(header);
  if (q?.[1]) return q[1];
  const plain = /filename=([^;\s]+)/i.exec(header);
  if (plain?.[1]) return plain[1].replace(/^"+|"+$/g, '');
  return fallback;
}
