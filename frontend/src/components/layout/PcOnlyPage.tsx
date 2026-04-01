import React from 'react';
import { useIsMobileBreakpoint } from '../../hooks/useIsMobileBreakpoint';

interface PcOnlyPageProps {
  title: string;
  children: React.ReactNode;
}

/**
 * 報告書など PC 専用画面。768px 以下では操作不可の案内のみ表示する。
 */
export const PcOnlyPage: React.FC<PcOnlyPageProps> = ({ title, children }) => {
  const mobile = useIsMobileBreakpoint();

  if (mobile) {
    return (
      <div className="max-w-lg mx-auto rounded-xl border border-border dark:border-gray-700 bg-white dark:bg-gray-800 p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">{title}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
          この機能はパソコン（画面幅が広い環境）でのみ操作できます。スマホではメニューに項目は表示されますが、入力・保存・PDF 出力などは PC から行ってください。
        </p>
      </div>
    );
  }

  return <>{children}</>;
};
