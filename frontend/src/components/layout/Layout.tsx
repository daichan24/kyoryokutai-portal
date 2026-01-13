import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <div className="h-screen flex flex-col">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto bg-background p-6">
          <div className="max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
      <footer className="bg-white border-t border-border px-4 py-2">
        <div className="max-w-7xl mx-auto text-xs text-gray-500 text-center">
          ENV: {env} | {new Date().toLocaleString('ja-JP')}
        </div>
      </footer>
    </div>
  );
};
