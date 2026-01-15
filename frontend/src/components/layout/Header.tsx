import React from 'react';
import { useAuthStore } from '../../stores/authStore';
import { LogOut, Menu, MoreVertical } from 'lucide-react';
import { Button } from '../common/Button';

interface HeaderProps {
  onMenuClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user, logout } = useAuthStore();
  const version = import.meta.env.VITE_BUILD_ID || 'dev-local';

  return (
    <header className="bg-white border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            {/* モバイル: ハンバーガーメニュー、デスクトップ: 非表示 */}
            <button
              onClick={onMenuClick}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
              aria-label="メニューを開く"
            >
              <Menu className="h-6 w-6 text-gray-700" />
            </button>
            
            <h1 className="text-lg md:text-xl font-bold text-primary truncate">
              長沼町地域おこし協力隊ポータル
            </h1>
            <span className="hidden sm:inline-block text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              VER: {version}
            </span>
          </div>

          <div className="flex items-center space-x-2 md:space-x-4">
            {user && (
              <>
                <div className="flex items-center space-x-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: user.avatarColor }}
                  >
                    {user.name.charAt(0)}
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-sm font-medium text-gray-900">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.role}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={logout} className="hidden sm:flex">
                  <LogOut className="h-4 w-4" />
                </Button>
                {/* モバイル: 三点リーダー（ログアウトを含むドロップダウン） */}
                <div className="sm:hidden relative">
                  <button
                    onClick={logout}
                    className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                    aria-label="ログアウト"
                  >
                    <MoreVertical className="h-5 w-5 text-gray-700" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
