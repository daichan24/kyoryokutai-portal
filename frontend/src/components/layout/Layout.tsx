import React, { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="h-screen flex flex-col bg-background dark:bg-gray-900">
      <Header onMenuClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
      <div className="flex-1 flex overflow-hidden relative">
        {/* モバイル時のオーバーレイ */}
        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
        
        {/* サイドバー（デスクトップ: 常時表示、モバイル: オーバーレイ） */}
        <div
          className={`
            fixed md:static
            top-0 left-0
            h-full z-50
            transform transition-transform duration-300 ease-in-out
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
        >
          <Sidebar onClose={() => setIsMobileMenuOpen(false)} />
        </div>
        
        {/* メインコンテンツエリア（モバイル: 全画面、デスクトップ: サイドバー横） */}
        <main className="flex-1 overflow-y-auto bg-background dark:bg-gray-900 p-4 md:p-6 w-full">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};
