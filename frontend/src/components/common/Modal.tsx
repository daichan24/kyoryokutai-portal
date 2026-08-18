import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** ダイアログ本体の最大幅クラス（未指定時は max-w-md） */
  maxWidthClassName?: string;
}

/**
 * アプリ全体で使う共通のポップアップ（背景・Escキー・閉じるボタン）。
 * 個々の画面はこの中身（フォーム等）だけを実装すればよい。
 */
export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, maxWidthClassName = 'max-w-md' }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className={`bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full ${maxWidthClassName}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="flex justify-between items-center px-6 pt-6">
            <h2 className="text-xl font-bold dark:text-gray-100">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="閉じる"
              className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
        {footer && <div className="flex gap-2 px-6 pb-6">{footer}</div>}
      </div>
    </div>
  );
};
