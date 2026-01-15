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
  MessageSquareText,
  Inbox,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../utils/cn';

export const Sidebar: React.FC = () => {
  const { user } = useAuthStore();

  // 全ロール共通のメニュー
  const commonItems = [
    { to: '/dashboard', icon: Home, label: 'ダッシュボード' },
    { to: '/schedule', icon: Calendar, label: 'スケジュール' },
    { to: '/events', icon: CalendarDays, label: 'イベント' },
  ];

  // 方向性カテゴリ（Mission）
  const directionItems = [
    { to: '/goals', icon: Target, label: '方向性' },
  ];

  // 進行中の取り組みカテゴリ（Project, Task）
  const activeWorkItems = [
    { to: '/projects', icon: FolderKanban, label: 'プロジェクト' },
    { to: '/tasks', icon: Check, label: 'タスク' },
  ];

  // MEMBER専用のメニュー（自分のデータのみ）
  const memberOnlyItems = [
    { to: '/sns-posts', icon: Share2, label: 'SNS投稿' },
    // 町民データベースは「状況」カテゴリに移動したため削除
  ];

  // SUPPORT/GOVERNMENT/MASTER用のメニュー（全データ閲覧可能）
  const supportGovernmentItems = [
    { to: '/sns-posts', icon: Share2, label: 'SNS投稿' },
    { to: '/task-requests', icon: UserCheck, label: '依頼' },
  ];

  // 報告カテゴリのメニュー
  const getReportItems = () => {
    const items = [
      { to: '/reports/weekly', icon: FileText, label: '週次報告' },
      { to: '/inspections', icon: Eye, label: '視察記録' },
    ];
    // SUPPORT/MASTERのみ月次報告を追加
    if (user?.role === 'SUPPORT' || user?.role === 'MASTER') {
      items.splice(1, 0, { to: '/reports/monthly', icon: FileBarChart, label: '月次報告' });
    }
    return items;
  };

  const reportItems = getReportItems();

  // 状況カテゴリのメニュー（イベント参加状況、タスクボックス、町民データベース）
  const getStatusItems = () => {
    const items: Array<{ to: string; icon: typeof CalendarDays | typeof Inbox | typeof Contact; label: string }> = [];
    
    // 全ロールでイベント参加状況を表示
    items.push({
      to: '/events/participation-summary',
      icon: CalendarDays,
      label: 'イベント参加状況',
    });
    
    // MEMBERのみタスクボックスを表示
    if (user?.role === 'MEMBER') {
      items.push({
        to: '/task-requests', // パスは後方互換性のため維持
        icon: Inbox,
        label: 'タスクボックス',
      });
    }
    
    // 全ロールで町民データベースを表示
    items.push({
      to: '/contacts',
      icon: Contact,
      label: '町民データベース',
    });
    
    return items;
  };

  const statusItems = getStatusItems();

  // ロール別にメニューを組み立て
  const getNavItems = () => {
    const items = [...commonItems];
    
    if (user?.role === 'MEMBER') {
      items.push(...memberOnlyItems);
    } else if (user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT' || user?.role === 'MASTER') {
      items.push(...supportGovernmentItems);
      // 月次報告は「報告」カテゴリに移動したため、ここでは追加しない
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

  const userMenuItems: Array<{ to: string; icon: typeof Users | typeof Settings | typeof MapPin | typeof MessageSquareText; label: string }> = [];
  
  // プロフィール設定（全ユーザー）
  userMenuItems.push({
    to: '/settings/profile',
    icon: Settings,
    label: 'プロフィール設定',
  });
  
  // MEMBER/SUPPORT/GOVERNMENT もユーザー情報を見れるようにする
  if (user?.role === 'MASTER' || user?.role === 'MEMBER' || user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT') {
    userMenuItems.push({
      to: '/settings/users',
      icon: Users,
      label: getUserMenuLabel(),
    });
  }

  // MASTERのみ場所管理
  if (user?.role === 'MASTER') {
    userMenuItems.push({
      to: '/settings/locations',
      icon: MapPin,
      label: '場所管理',
    });
  }

  // 協力隊催促（MASTER/SUPPORT/GOVERNMENTのみ編集可、MEMBERは閲覧のみ）
  if (user?.role === 'MASTER' || user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT' || user?.role === 'MEMBER') {
    userMenuItems.push({
      to: '/nudges',
      icon: MessageSquareText,
      label: '協力隊催促',
    });
  }

  return (
    <aside className="w-64 bg-white border-r border-border h-full flex flex-col">
      <nav className="p-4 space-y-2 overflow-y-auto flex-1">
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

        {/* 方向性カテゴリ */}
        {directionItems.length > 0 && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                方向性
              </p>
            </div>
            {directionItems.map((item) => (
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

        {/* 進行中の取り組みカテゴリ */}
        {activeWorkItems.length > 0 && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                進行中の取り組み
              </p>
            </div>
            {activeWorkItems.map((item) => (
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

        {reportItems.length > 0 && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                報告
              </p>
            </div>
            {reportItems.map((item) => (
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

        {statusItems.length > 0 && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                状況
              </p>
            </div>
            {statusItems.map((item) => (
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

        {(userMenuItems.length > 0) && (
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
          </>
        )}
      </nav>
    </aside>
  );
};
