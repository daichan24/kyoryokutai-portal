import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  Calendar,
  FileText,
  Settings,
  Users,
  MapPin,
  Target,
  FolderKanban,
  CalendarDays,
  Share2,
  UserCheck,
  Eye,
  Contact,
  FileBarChart,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../utils/cn';

export const Sidebar: React.FC = () => {
  const { user } = useAuthStore();

  // 全ロール共通のメニュー
  const commonItems = [
    { to: '/dashboard', icon: Home, label: 'ダッシュボード' },
    { to: '/schedule', icon: Calendar, label: 'スケジュール' },
    { to: '/reports/weekly', icon: FileText, label: '週次報告' },
    { to: '/events', icon: CalendarDays, label: 'イベント' },
  ];

  // MEMBER専用のメニュー（自分のデータのみ）
  const memberOnlyItems = [
    { to: '/goals', icon: Target, label: '起業準備進捗' },
    { to: '/projects', icon: FolderKanban, label: 'プロジェクト' },
    { to: '/sns-posts', icon: Share2, label: 'SNS投稿' },
    { to: '/contacts', icon: Contact, label: '町民データベース' },
    { to: '/task-requests', icon: UserCheck, label: 'タスク依頼' },
    { to: '/inspections', icon: Eye, label: '視察記録' },
  ];

  // SUPPORT/GOVERNMENT/MASTER用のメニュー（全データ閲覧可能）
  const supportGovernmentItems = [
    { to: '/goals', icon: Target, label: '起業準備進捗' },
    { to: '/projects', icon: FolderKanban, label: 'プロジェクト' },
    { to: '/sns-posts', icon: Share2, label: 'SNS投稿' },
    { to: '/contacts', icon: Contact, label: '町民データベース' },
    { to: '/task-requests', icon: UserCheck, label: 'タスク依頼' },
    { to: '/inspections', icon: Eye, label: '視察記録' },
  ];

  // SUPPORT/MASTER専用のメニュー
  const supportMasterItems = [
    { to: '/reports/monthly', icon: FileBarChart, label: '月次報告' },
  ];

  // ロール別にメニューを組み立て
  const getNavItems = () => {
    const items = [...commonItems];
    
    if (user?.role === 'MEMBER') {
      items.push(...memberOnlyItems);
    } else if (user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT' || user?.role === 'MASTER') {
      items.push(...supportGovernmentItems);
      if (user?.role === 'SUPPORT' || user?.role === 'MASTER') {
        items.push(...supportMasterItems);
      }
    }
    
    return items;
  };

  const navItems = getNavItems();

  // ユーザー管理/情報メニューアイテム（ロール別にラベル変更）
  const getUserMenuLabel = () => {
    if (user?.role === 'MASTER') {
      return 'ユーザー管理';
    }
    return 'ユーザー情報';
  };

  const userMenuItems: Array<{ to: string; icon: typeof Users; label: string }> = [];
  
  // MEMBER/SUPPORT/GOVERNMENT もユーザー情報を見れるようにする
  if (user?.role === 'MASTER' || user?.role === 'MEMBER' || user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT') {
    userMenuItems.push({
      to: '/settings/users',
      icon: Users,
      label: getUserMenuLabel(),
    });
  }

  const adminItems =
    user?.role === 'MASTER'
      ? [
          { to: '/settings/locations', icon: MapPin, label: '場所管理' },
        ]
      : [];

  return (
    <aside className="w-64 bg-white border-r border-border h-full">
      <nav className="p-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}

        {(userMenuItems.length > 0 || adminItems.length > 0) && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {user?.role === 'MASTER' ? '管理' : '情報'}
              </p>
            </div>
            {userMenuItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            ))}
            {adminItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  )
                }
              >
                <item.icon className="h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </NavLink>
            ))}
          </>
        )}
      </nav>
    </aside>
  );
};
