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
  Check,
  ListChecks,
  HardDrive,
  NotebookPen,
  MessageCircle,
  Banknote,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../utils/cn';
import { X } from 'lucide-react';

interface SidebarProps {
  onClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const { user } = useAuthStore();

  // 全ロール共通のメニュー
  const commonItems = [
    { to: '/dashboard', icon: Home, label: 'ダッシュボード' },
    { to: '/schedule', icon: Calendar, label: 'スケジュール' },
    ...(user?.wishesEnabled !== false ? [{ to: '/wishes', icon: ListChecks, label: 'やりたいこと100' }] : []),
  ];

  // ミッション・プロジェクト・タスク・個人イベントを1カテゴリに集約
  const goalsAndEventsItems = [
    { to: '/goals', icon: Target, label: 'ミッション' },
    { to: '/projects', icon: FolderKanban, label: 'プロジェクト' },
    { to: '/tasks', icon: Check, label: 'タスク' },
    { to: '/events', icon: CalendarDays, label: '個人イベント', end: true as const },
  ];

  // 報告カテゴリのメニュー
  const getReportItems = () => {
    const items = [
      { to: '/reports/weekly', icon: FileText, label: '週次報告' },
      { to: '/inspections', icon: Eye, label: '視察記録' },
      { to: '/activity-expenses', icon: Banknote, label: '活動経費' },
    ];
    if (user?.role === 'MEMBER') {
      items.push({ to: '/consultations', icon: MessageCircle, label: '相談' });
    }
    if (user?.role === 'MASTER' || user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT') {
      items.push({ to: '/consultations', icon: MessageCircle, label: '相談（対応）' });
    }
    if (user?.role === 'SUPPORT' || user?.role === 'MASTER') {
      items.splice(1, 0, { to: '/reports/monthly', icon: FileBarChart, label: '月次報告' });
      items.push({ to: '/support-records', icon: UserCheck, label: '支援内容' });
    }
    if (user?.role === 'MASTER' || user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT') {
      items.push({
        to: '/interview/monthly-schedules',
        icon: NotebookPen,
        label: '面談',
      });
    }
    return items;
  };

  const reportItems = getReportItems();

  // 状況カテゴリのメニュー（イベント参加状況、タスクボックス、町民データベース）
  const getStatusItems = () => {
    const items: Array<{ to: string; icon: typeof CalendarDays | typeof Inbox | typeof Contact | typeof Share2; label: string; end?: boolean }> = [];

    items.push({
      to: '/sns-posts',
      icon: Share2,
      label: 'SNS投稿',
    });

    // 全ロールでイベント参加状況を表示
    items.push({
      to: '/events/participation-summary',
      icon: CalendarDays,
      label: 'イベント参加状況',
    });
    
    // 全ロールで依頼ボックスを表示
    items.push({
      to: '/task-requests', // パスは後方互換性のため維持
      icon: Inbox,
      label: '依頼ボックス',
    });
    
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
  const getNavItems = () => [...commonItems];

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
  
  // テンプレート設定（SUPPORT/MASTERのみ）
  if (user?.role === 'SUPPORT' || user?.role === 'MASTER') {
    userMenuItems.push({
      to: '/settings/document-templates',
      icon: FileText,
      label: 'テンプレート設定',
    });
  }
  
  // MEMBER/SUPPORT/GOVERNMENT もユーザー情報を見れるようにする
  if (user?.role === 'MASTER' || user?.role === 'MEMBER' || user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT') {
    userMenuItems.push({
      to: '/settings/users',
      icon: Users,
      label: getUserMenuLabel(),
    });
  }

  // MASTERのみ場所管理
  userMenuItems.push({
    to: '/settings/locations',
    icon: MapPin,
    label: '場所管理',
  });

  // 協力隊催促（MASTER/SUPPORT/GOVERNMENTのみ編集可、MEMBERは閲覧のみ）
  if (user?.role === 'MASTER' || user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT' || user?.role === 'MEMBER') {
    userMenuItems.push({
      to: '/nudges',
      icon: MessageSquareText,
      label: '協力隊細則',
    });
  }

  // ドライブ（全ユーザー）
  userMenuItems.push({
    to: '/settings/drive-links',
    icon: HardDrive,
    label: 'ドライブ',
  });

  return (
    <aside className="w-64 bg-card dark:bg-gray-800 border-r border-border dark:border-gray-700 h-full flex flex-col shadow-lg md:shadow-none">
      {/* モバイル: 閉じるボタン、デスクトップ: 非表示 */}
      <div className="flex justify-between items-center p-4 border-b border-border dark:border-gray-700 md:hidden">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">メニュー</h2>
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="メニューを閉じる"
        >
          <X className="h-5 w-5 text-gray-700 dark:text-gray-300" />
        </button>
      </div>
      
      <nav className="p-4 space-y-2 overflow-y-auto flex-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={(item as any).end}
            className={({ isActive }) =>
              cn(
                'flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}

        {/* 目標・個人イベント */}
        <div className="pt-4 pb-2">
          <p className="px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            目標・個人イベント
          </p>
        </div>
        {goalsAndEventsItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={(item as { end?: boolean }).end}
            className={({ isActive }) =>
              cn(
                'flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors',
                isActive
                  ? 'bg-primary text-white'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
              )
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}

        {reportItems.length > 0 && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
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
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
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
              <p className="px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
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
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
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
              <p className="px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
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
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
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
