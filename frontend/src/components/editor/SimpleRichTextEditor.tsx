import React, { useRef, useState, useEffect } from 'react';
import { 
  Type, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Heading1, 
  Heading2, 
  Heading3,
  List,
  ListOrdered,
  Indent,
  Outdent
} from 'lucide-react';

interface SimpleRichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const SimpleRichTextEditor: React.FC<SimpleRichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'テキストを入力...',
  className = '',
}) => {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const executeCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
    editorRef.current?.focus();
  };

  const handleHeading = (level: 1 | 2 | 3) => {
    executeCommand('formatBlock', `h${level}`);
  };

  const handleFontSize = (size: 'small' | 'normal' | 'large') => {
    if (size === 'small') {
      executeCommand('fontSize', '1');
    } else if (size === 'normal') {
      executeCommand('fontSize', '3');
    } else {
      executeCommand('fontSize', '5');
    }
  };

  const handleAlignment = (align: 'left' | 'center' | 'right') => {
    executeCommand('justifyLeft');
    executeCommand('justifyCenter');
    executeCommand('justifyRight');
    
    if (align === 'left') {
      executeCommand('justifyLeft');
    } else if (align === 'center') {
      executeCommand('justifyCenter');
    } else {
      executeCommand('justifyRight');
    }
  };

  return (
    <div className={`border border-gray-300 rounded-lg ${className}`}>
      {/* ツールバー */}
      <div className="flex items-center gap-1 p-2 border-b border-gray-200 bg-gray-50 rounded-t-lg sticky top-0 z-10">
        {/* 見出し */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
          <button
            type="button"
            onClick={() => handleHeading(1)}
            className="p-2 hover:bg-gray-200 rounded"
            title="見出し1"
          >
            <Heading1 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleHeading(2)}
            className="p-2 hover:bg-gray-200 rounded"
            title="見出し2"
          >
            <Heading2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleHeading(3)}
            className="p-2 hover:bg-gray-200 rounded"
            title="見出し3"
          >
            <Heading3 className="h-4 w-4" />
          </button>
        </div>

        {/* 文字サイズ */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
          <button
            type="button"
            onClick={() => handleFontSize('small')}
            className="px-2 py-1 text-xs hover:bg-gray-200 rounded"
            title="小"
          >
            小
          </button>
          <button
            type="button"
            onClick={() => handleFontSize('normal')}
            className="px-2 py-1 text-sm hover:bg-gray-200 rounded"
            title="標準"
          >
            標準
          </button>
          <button
            type="button"
            onClick={() => handleFontSize('large')}
            className="px-2 py-1 text-base hover:bg-gray-200 rounded"
            title="大"
          >
            大
          </button>
        </div>

        {/* 配置 */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
          <button
            type="button"
            onClick={() => handleAlignment('left')}
            className="p-2 hover:bg-gray-200 rounded"
            title="左揃え"
          >
            <AlignLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleAlignment('center')}
            className="p-2 hover:bg-gray-200 rounded"
            title="中央揃え"
          >
            <AlignCenter className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => handleAlignment('right')}
            className="p-2 hover:bg-gray-200 rounded"
            title="右揃え"
          >
            <AlignRight className="h-4 w-4" />
          </button>
        </div>

        {/* 箇条書き */}
        <div className="flex items-center gap-1 border-r border-gray-300 pr-2">
          <button
            type="button"
            onClick={() => executeCommand('insertUnorderedList')}
            className="p-2 hover:bg-gray-200 rounded"
            title="箇条書き（・）"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('insertOrderedList')}
            className="p-2 hover:bg-gray-200 rounded"
            title="番号付きリスト"
          >
            <ListOrdered className="h-4 w-4" />
          </button>
        </div>

        {/* インデント */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => executeCommand('indent')}
            className="p-2 hover:bg-gray-200 rounded"
            title="インデント増"
          >
            <Indent className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => executeCommand('outdent')}
            className="p-2 hover:bg-gray-200 rounded"
            title="インデント減"
          >
            <Outdent className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* エディタエリア */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="min-h-[300px] p-4 focus:outline-none prose max-w-none"
        style={{
          wordBreak: 'break-word',
        }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />
      
      <style>{`
        [contenteditable][data-placeholder]:empty:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          pointer-events: none;
        }
        [contenteditable] h1 {
          font-size: 1.875rem;
          font-weight: bold;
          margin: 1rem 0;
        }
        [contenteditable] h2 {
          font-size: 1.5rem;
          font-weight: bold;
          margin: 0.875rem 0;
        }
        [contenteditable] h3 {
          font-size: 1.25rem;
          font-weight: bold;
          margin: 0.75rem 0;
        }
        [contenteditable] ul, [contenteditable] ol {
          margin: 0.5rem 0;
          padding-left: 2rem;
        }
        [contenteditable] li {
          margin: 0.25rem 0;
        }
        [contenteditable] strong, [contenteditable] b {
          font-weight: bold;
        }
        [contenteditable] em, [contenteditable] i {
          font-style: italic;
        }
      `}</style>
    </div>
  );
};

