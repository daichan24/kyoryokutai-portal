import React from 'react';
import { useAuthStore } from '../../stores/authStore';
import { LogOut, User } from 'lucide-react';
import { Button } from '../common/Button';

export const Header: React.FC = () => {
  const { user, logout } = useAuthStore();

  return (
    <header className="bg-white border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-primary">
              長沼町地域おこし協力隊ポータル
            </h1>
            <span className="ml-4 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              BUILD: {new Date().toISOString().split('T')[0]}-{Math.floor(Date.now() / 1000) % 10000}
            </span>
          </div>

          <div className="flex items-center space-x-4">
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
                <Button variant="ghost" size="sm" onClick={logout}>
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
