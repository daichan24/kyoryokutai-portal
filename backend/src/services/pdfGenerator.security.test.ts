import { beforeEach, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ html: '', javascript: true, intercept: false, requests: undefined as ((request: { url: () => string; resourceType: () => string; abort: () => void; continue: () => void }) => void) | undefined }));
vi.mock('../lib/prisma', () => ({ default: { documentTemplate: { findFirst: async () => null }, inspection: { findUnique: async () => ({ date: new Date('2026-09-09'), destination: '検証会場', purpose: '検証', user: { name: '検証' }, participants: [], attachments: [
  { mimeType: 'image/png', dataBase64: 'AA==', fileName: '普通.png' },
  { mimeType: 'image/svg+xml', dataBase64: 'AA==', fileName: '危険.svg' },
  { mimeType: 'image/png', dataBase64: 'AA==\" onerror=alert(1)', fileName: '注入.png' },
] }) }, nudgeDocument: { findUnique: async () => ({ title: '<img src=x onerror=alert(1)>題名', content: '<p>普通の本文</p>&lt;img src=x onerror=alert(1)&gt;', updater: { name: '<svg onload=alert(1)>名前' } }) } } }));
vi.mock('puppeteer', () => ({ default: { executablePath: () => '/fixture/chrome', launch: async () => ({ newPage: async () => ({
  on: (event: string, handler: typeof fixture.requests) => { if (event === 'request') fixture.requests = handler; },
  setJavaScriptEnabled: async (enabled: boolean) => { fixture.javascript = enabled; },
  setRequestInterception: async (enabled: boolean) => { fixture.intercept = enabled; },
  setContent: async (html: string) => { fixture.html = html; }, evaluate: async () => {}, pdf: async () => Buffer.from('fixture-pdf'),
}), close: async () => {} }) } }));
import { generateInspectionPDF, generateNudgePDF, renderRichTextForPdf } from './pdfGenerator';
beforeEach(() => { fixture.html = ''; fixture.javascript = true; fixture.intercept = false; fixture.requests = undefined; });
it.each([
  '<p onclick=alert(1)>本文</p>',
  '<a href="jav&#x61;script:alert(1)">危険</a>',
  '<svg onload=alert(1)></svg><iframe src="https://example.com"></iframe><object data="file:///etc/passwd"></object>',
  '<p style="background-image:url(https://example.com);position:fixed">本文</p>',
])('PDF rich text removes active content: %s', html => {
  expect(renderRichTextForPdf(html)).not.toMatch(/onload|onclick|javascript|jav&#|<svg|<iframe|<object|url\(|position:/i);
});
it('PDF rich text retains normal rich formatting', () => {
  const html = renderRichTextForPdf('<h2>日本語</h2><ul><li><b>太字</b></li></ul><ol><li><i>斜体</i></li></ol><div style="text-align:center;margin-left:40px"><font size="5">大</font><a href="https://example.com">参照</a></div>');
  expect(html).toContain('<h2>日本語</h2>'); expect(html).toContain('<ul>'); expect(html).toContain('<ol>'); expect(html).toContain('text-align:center'); expect(html).toContain('margin-left:40px'); expect(html).toContain('<font size="5">'); expect(html).toContain('href="https://example.com"');
});
it('Nudge PDF escapes scalar fields and decoded text before HTML insertion', async () => {
  await generateNudgePDF(2026);
  expect(fixture.html).not.toContain('<img'); expect(fixture.html).not.toContain('<svg');
  expect(fixture.html).toContain('&lt;img src=x onerror=alert(1)&gt;'); expect(fixture.html).toContain('普通の本文');
});
it('PDF page disables JavaScript and blocks external resources while permitting embedded fonts', async () => {
  await generateNudgePDF(2026); expect(fixture.javascript).toBe(false); expect(fixture.intercept).toBe(true);
  for (const url of ['https://example.com/pixel', 'http://127.0.0.1/admin', 'file:///etc/passwd', 'data:text/html,<script>1</script>']) {
    let result = ''; fixture.requests!({ url: () => url, resourceType: () => 'image', abort: () => { result = 'blocked'; }, continue: () => { result = 'allowed'; } }); expect(result).toBe('blocked');
  }
  let font = ''; fixture.requests!({ url: () => 'data:font/woff2;base64,AA==', resourceType: () => 'font', abort: () => { font = 'blocked'; }, continue: () => { font = 'allowed'; } }); expect(font).toBe('allowed');
});

it('PDF keeps embedded raster attachments and blocks SVG or malformed image data', async () => {
  await generateNudgePDF(2026);
  for (const mime of ['jpeg', 'png', 'webp', 'heic']) {
    let result = '';
    fixture.requests!({ url: () => `data:image/${mime};base64,AA==`, resourceType: () => 'image', abort: () => { result = 'blocked'; }, continue: () => { result = 'allowed'; } });
    expect(result).toBe('allowed');
  }
  for (const url of ['data:image/svg+xml;base64,AA==', 'data:image/png;base64,<svg>', 'https://example.com/attachment.png']) {
    let result = '';
    fixture.requests!({ url: () => url, resourceType: () => 'image', abort: () => { result = 'blocked'; }, continue: () => { result = 'allowed'; } });
    expect(result).toBe('blocked');
  }
});

it('inspection PDF preserves raster attachments and removes unsafe stored MIME or payloads', async () => {
  await generateInspectionPDF('fixture');
  expect(fixture.html).toContain('src="data:image/png;base64,AA=="');
  expect(fixture.html.match(/<img /g)).toHaveLength(1);
  expect(fixture.html).not.toMatch(/image\/svg|onerror|危険.svg|注入.png/);
});
