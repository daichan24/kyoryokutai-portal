// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SimpleRichTextEditor } from './SimpleRichTextEditor';
import { plainTextToRichText } from '../../utils/richText';
let container: HTMLDivElement;
let root: Root;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = (value: string) => act(() => root.render(<SimpleRichTextEditor value={value} onChange={() => {}} />));
describe('rich text insertion boundary', () => {
  it.each([
    '<p onclick=alert(1)>本文</p><img src=x onerror=alert(1)>',
    '<a href="jav&#x61;script:alert(1)">本文</a>',
    '<svg><a xlink:href="javascript:alert(1)">本文</a></svg><iframe srcdoc="<script>alert(1)</script>"></iframe><object data="https://example.com"></object>',
    '<p style="background-image:url(https://example.com/private);position:fixed">本文</p>',
  ])('removes active HTML: %s', (html) => {
    render(html);
    const editor = container.querySelector('[contenteditable]')!;
    expect(editor.querySelector('svg,iframe,object,img,script')).toBeNull();
    for (const el of editor.querySelectorAll('*')) {
      expect(el.getAttributeNames().some(a => a.startsWith('on'))).toBe(false);
      expect(el.getAttribute('href') || '').not.toMatch(/javascript:/i);
      expect(el.getAttribute('style') || '').not.toMatch(/url\(|position/i);
    }
  });
  it('preserves headings lists font size alignment indentation links and Japanese', () => {
    render('<h2>日本語の見出し</h2><ul><li><b>太字</b><i>斜体</i></li></ul><ol><li>番号</li></ol><div style="text-align: center; margin-left: 40px"><font size="5">大きな文字</font><a href="https://example.com/path">参照</a></div>');
    expect(container.querySelector('h2')?.textContent).toBe('日本語の見出し');
    expect(container.querySelectorAll('li')).toHaveLength(2);
    expect(container.querySelector('font')?.getAttribute('size')).toBe('5');
    expect(container.querySelector('[style*="text-align"]')?.getAttribute('style')).toContain('margin-left: 40px');
    expect(container.querySelector('a')?.href).toBe('https://example.com/path');
  });
  it('plain-text paste preserves literal markup and newlines without activating tags', () => {
    const html = plainTextToRichText('<img src=x onerror=alert(1)>\n日本語');
    render(html);
    const editor = container.querySelector('[contenteditable]')!;
    expect(editor.querySelector('img')).toBeNull();
    expect(editor.querySelector('br')).not.toBeNull();
    expect(editor.textContent).toBe('<img src=x onerror=alert(1)>日本語');
  });
  it('keeps text node and caret when normal typing is echoed', () => {
    const Echo = () => { const [value, setValue] = React.useState('本文'); return <SimpleRichTextEditor value={value} onChange={setValue} />; };
    act(() => root.render(<Echo />)); const editor = container.querySelector('[contenteditable]')!; const node = editor.firstChild!;
    node.textContent = '本文追加'; const range = document.createRange(); range.setStart(node, 4); range.collapse(true);
    window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range);
    act(() => editor.dispatchEvent(new Event('input', { bubbles: true })));
    expect(editor.firstChild).toBe(node); expect(window.getSelection()?.anchorOffset).toBe(4);
  });
});
