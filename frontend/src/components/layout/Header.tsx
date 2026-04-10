import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { Menu, Box } from 'lucide-react';
import { Button } from '../common/Button';
import { api } from '../../utils/api';
import { BUILD_VERSION } from '../../buildVersion';
import { NotepadDropdown } from '../notepad/NotepadDropdown';
import { useStaffWorkspace } from '../../stores/workspaceStore';
import { useQueryClient } from '@tanstack/react-query';

interface HeaderProps {
  onMenuClick?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { user } = useAuthStore();
  const version = BUILD_VERSION;
  const { isStaff, workspaceMode, setWorkspaceMode } = useStaffWorkspace();
  const queryClient = useQueryClient();

  const applyWorkspaceMode = (mode: 'personal' | 'browse') => {
    setWorkspaceMode(mode);
    queryClient.invalidateQueries();
  };

  // 受付ボックスの未読数
  const { data: unreadReception } = useQuery({
    queryKey: ['reception-box', 'unread-count'],
    queryFn: async () => {
      const r = await api.get<{ count: number }>('/api/reception-box/unread-count');
      return r.data;
    },
    enabled: !!user,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  // お知らせの未確認数（全員対象）
  const { data: unreadAnnounce } = useQuery({
    queryKey: ['announcements', 'unread-count'],
    queryFn: async () => {
      const r = await api.get<{ count: number }>('/api/announcements/unread-count');
      return r.data;
    },
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return (
    <header className="bg-card dark:bg-gray-800 border-b border-border dark:border-gray-700 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3">
            {/* モバイル: ハンバーガーメニュー、デスクトップ: 非表示 */}
            <button
              onClick={onMenuClick}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              aria-label="メニューを開く"
            >
              <Menu className="h-6 w-6 text-gray-700 dark:text-gray-300" />
            </button>
            
            <div className="min-w-0">
              <h1 className="text-lg md:text-xl font-bold text-primary truncate leading-tight">
                協力隊クリアベース
              </h1>
              <p className="hidden sm:block text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-md">
                地域おこし協力隊の活動・報告・提出を一元管理するツール
              </p>
            </div>
            <span className="hidden sm:inline-block text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              VER: {version}
            </span>
          </div>

          <div className="flex items-center space-x-2 md:space-x-4">
            {user && (
              <>
                {/* 受付ボックス（常に表示、未読数バッジ付き） */}
                <Link
                  to="/reception-box"
                  className="relative flex items-center gap-1 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="受付ボックス"
                >
                  <Box className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                  {(unreadReception?.count ?? 0) > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[1.1rem] h-[1.1rem] flex items-center justify-center px-0.5">
                      {unreadReception!.count > 99 ? '99+' : unreadReception!.count}
                    </span>
                  )}
                </Link>
                {/* メモ帳（notepadEnabled がtrue の場合のみ表示） */}
                {user.notepadEnabled !== false && <NotepadDropdown />}
                {(unreadAnnounce?.count ?? 0) > 0 && (
                  <Link
                    to="/announcements"
                    className="text-sm font-semibold text-primary hover:underline whitespace-nowrap"
                  >
                    未確認 {unreadAnnounce?.count} 件
                  </Link>
                )}
                {/* 個人/閲覧モード切替（スタッフのみ） */}
                {isStaff && (
                  <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 p-0.5 bg-gray-50 dark:bg-gray-900/60 shrink-0">
                    <button
                      type="button"
                      onClick={() => applyWorkspaceMode('personal')}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        workspaceMode === 'personal'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/80 dark:hover:bg-gray-700'
                      }`}
                    >
                      個人
                    </button>
                    <button
                      type="button"
                      onClick={() => applyWorkspaceMode('browse')}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        workspaceMode === 'browse'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/80 dark:hover:bg-gray-700'
                      }`}
                    >
                      閲覧
                    </button>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: user.avatarColor }}
                  >
                    {(user.avatarLetter || user.name).charAt(0)}
                  </div>
                  <div className="hidden sm:block">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{user.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{user.role}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
