import DOMPurify from 'dompurify';

// Only prose formatting is allowed; no images, SVG, embedded documents or CSS resources.
const size = '(?:0|[0-9]+(?:\\.[0-9]+)?(?:px|em|rem|%|pt))';
const styles: Record<string, RegExp> = {
  'text-align': /^(left|center|right|justify|start|end)$/i,
  'font-size': new RegExp(`^(?:${size}|xx-small|x-small|small|medium|large|x-large|xx-large)$`, 'i'),
  'font-weight': /^(normal|bold|bolder|lighter|[1-9]00)$/i,
  'font-style': /^(normal|italic|oblique)$/i,
  'text-decoration': /^(none|underline|line-through|overline)( (underline|line-through|overline))*$/i,
  'margin-left': new RegExp(`^${size}$`, 'i'),
  'padding-left': new RegExp(`^${size}$`, 'i'),
  margin: new RegExp(`^${size}( ${size}){0,3}$`, 'i'),
  'line-height': /^(normal|[0-9]+(?:\.[0-9]+)?(?:px|em|rem|%|pt)?)$/i,
};
DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
  if (data.attrName === 'style') {
    const style = (node as HTMLElement).style;
    data.attrValue = Object.entries(styles).flatMap(([name, pattern]) => {
      const value = style?.getPropertyValue(name).trim();
      return value && pattern.test(value) ? [`${name}: ${value}`] : [];
    }).join('; ');
    if (!data.attrValue) data.keepAttr = false;
  }
});

export const sanitizeRichText = (html?: string | null): string => DOMPurify.sanitize(html || '', {
  ALLOWED_TAGS: ['p', 'div', 'span', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'sub', 'sup', 'font', 'a', 'hr', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td'],
  ALLOWED_ATTR: ['style', 'align', 'size', 'href', 'title', 'colspan', 'rowspan', 'start', 'type'],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[#/?]|[^a-z][^:]*$|[a-z][a-z0-9+.-]*(?:[/?#]|$))/i,
});

export const richTextToPlainText = (html: string): string => {
  const div = document.createElement('div');
  div.innerHTML = sanitizeRichText(html);
  return div.textContent || '';
};

export const plainTextToRichText = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML.replace(/\r?\n/g, '<br>');
};
