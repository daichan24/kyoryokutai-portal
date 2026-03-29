import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
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
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../utils/cn';
import { X } from 'lucide-react';

interface SidebarProps {
  onClose?: () => void;
}

type NavIcon = React.ComponentType<{ className?: string }>;

function matchesDocPath(pathname: string) {
  return (
    pathname.startsWith('/reports/weekly') ||
    pathname.startsWith('/reports/monthly') ||
    pathname.startsWith('/inspections')
  );
}

function matchesSupportPath(pathname: string) {
  return (
    pathname.startsWith('/activity-expenses') ||
    pathname.startsWith('/consultations') ||
    pathname.startsWith('/support-records') ||
    pathname.startsWith('/interview')
  );
}

function matchesAdminPath(pathname: string) {
  return pathname.startsWith('/settings') || pathname.startsWith('/nudges');
}

function matchesStatusPath(pathname: string) {
  return (
    pathname.startsWith('/sns-posts') ||
    pathname.startsWith('/events/participation-summary') ||
    pathname.startsWith('/task-requests') ||
    pathname.startsWith('/contacts')
  );
}

function CollapsibleBlock({
  title,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-expanded={open}
      >
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          {title}
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-gray-500" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
        )}
      </button>
      {open && <div className="mt-1 space-y-1 pl-0">{children}</div>}
    </div>
  );
}

function NavRow({
  to,
  icon: Icon,
  label,
  end,
  onNavigate,
}: {
  to: string;
  icon: NavIcon;
  label: string;
  end?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors',
          isActive
            ? 'bg-primary text-white'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
        )
      }
    >
      <Icon className="h-5 w-5" />
      <span className="font-medium">{label}</span>
    </NavLink>
  );
}

export const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const { user } = useAuthStore();
  const location = useLocation();

  const docActive = matchesDocPath(location.pathname);
  const supportActive = matchesSupportPath(location.pathname);
  const adminActive = matchesAdminPath(location.pathname);
  const statusActive = matchesStatusPath(location.pathname);

  const [docOpen, setDocOpen] = useState(false);
  const [supportMenuOpen, setSupportMenuOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  useEffect(() => {
    if (docActive) setDocOpen(true);
  }, [docActive]);

  useEffect(() => {
    if (supportActive) setSupportMenuOpen(true);
  }, [supportActive]);

  useEffect(() => {
    if (adminActive) setAdminOpen(true);
  }, [adminActive]);

  useEffect(() => {
    if (statusActive) setStatusOpen(true);
  }, [statusActive]);

  const commonItems = [
    { to: '/dashboard', icon: Home, label: 'ダッシュボード' },
    { to: '/schedule', icon: Calendar, label: 'スケジュール' },
    ...(user?.wishesEnabled !== false ? [{ to: '/wishes', icon: ListChecks, label: 'やりたいこと100' }] : []),
  ];

  const goalsAndEventsItems = [
    { to: '/goals', icon: Target, label: 'ミッション' },
    { to: '/projects', icon: FolderKanban, label: 'プロジェクト' },
    { to: '/tasks', icon: Check, label: 'タスク' },
    { to: '/events', icon: CalendarDays, label: '個人イベント', end: true as const },
  ];

  const getReportDocumentItems = (): Array<{ to: string; icon: NavIcon; label: string }> => {
    const items: Array<{ to: string; icon: NavIcon; label: string }> = [
      { to: '/reports/weekly', icon: FileText, label: '週次報告' },
    ];
    if (user?.role === 'SUPPORT' || user?.role === 'MASTER') {
      items.push({ to: '/reports/monthly', icon: FileBarChart, label: '月次報告' });
    }
    items.push({ to: '/inspections', icon: Eye, label: '視察記録' });
    return items;
  };

  const getSupportWorkflowItems = (): Array<{ to: string; icon: NavIcon; label: string }> => {
    const items: Array<{ to: string; icon: NavIcon; label: string }> = [
      { to: '/activity-expenses', icon: Banknote, label: '活動経費' },
    ];
    if (user?.role === 'MEMBER') {
      items.push({ to: '/consultations', icon: MessageCircle, label: '相談' });
    }
    if (user?.role === 'MASTER' || user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT') {
      items.push({ to: '/consultations', icon: MessageCircle, label: '相談（対応）' });
    }
    if (user?.role === 'SUPPORT' || user?.role === 'MASTER') {
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

  const reportDocumentItems = getReportDocumentItems();
  const supportWorkflowItems = getSupportWorkflowItems();

  const getUserMenuLabel = () => {
    if (user?.role === 'MASTER') return 'ユーザー管理';
    return 'ユーザー情報';
  };

  const userMenuItems: Array<{ to: string; icon: NavIcon; label: string }> = [];

  userMenuItems.push({
    to: '/settings/profile',
    icon: Settings,
    label: 'プロフィール設定',
  });

  if (user?.role === 'SUPPORT' || user?.role === 'MASTER') {
    userMenuItems.push({
      to: '/settings/document-templates',
      icon: FileText,
      label: 'テンプレート設定',
    });
  }

  if (user?.role === 'MASTER' || user?.role === 'MEMBER' || user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT') {
    userMenuItems.push({
      to: '/settings/users',
      icon: Users,
      label: getUserMenuLabel(),
    });
  }

  userMenuItems.push({
    to: '/settings/locations',
    icon: MapPin,
    label: '場所管理',
  });

  if (user?.role === 'MASTER' || user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT' || user?.role === 'MEMBER') {
    userMenuItems.push({
      to: '/nudges',
      icon: MessageSquareText,
      label: '協力隊細則',
    });
  }

  userMenuItems.push({
    to: '/settings/drive-links',
    icon: HardDrive,
    label: 'ドライブ',
  });

  const statusItems: Array<{ to: string; icon: NavIcon; label: string; end?: boolean }> = [
    { to: '/sns-posts', icon: Share2, label: 'SNS投稿' },
    { to: '/events/participation-summary', icon: CalendarDays, label: 'イベント参加状況' },
    { to: '/task-requests', icon: Inbox, label: '依頼ボックス' },
    { to: '/contacts', icon: Contact, label: '町民データベース' },
  ];

  const closeMobile = () => onClose?.();

  return (
    <aside className="w-64 bg-card dark:bg-gray-800 border-r border-border dark:border-gray-700 h-full flex flex-col shadow-lg md:shadow-none">
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
        {commonItems.map((item) => (
          <NavRow key={item.to} {...item} onNavigate={closeMobile} />
        ))}

        <div className="pt-4 pb-2">
          <p className="px-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            目標・個人イベント
          </p>
        </div>
        {goalsAndEventsItems.map((item) => (
          <NavRow key={item.to} {...item} onNavigate={closeMobile} />
        ))}

        {reportDocumentItems.length > 0 && (
          <CollapsibleBlock title="報告書" open={docOpen} onOpenChange={setDocOpen}>
            {reportDocumentItems.map((item) => (
              <NavRow key={item.to} {...item} onNavigate={closeMobile} />
            ))}
          </CollapsibleBlock>
        )}

        {supportWorkflowItems.length > 0 && (
          <CollapsibleBlock title="サポート・連絡" open={supportMenuOpen} onOpenChange={setSupportMenuOpen}>
            {supportWorkflowItems.map((item) => (
              <NavRow key={`${item.to}-${item.label}`} {...item} onNavigate={closeMobile} />
            ))}
          </CollapsibleBlock>
        )}

        <CollapsibleBlock title="状況" open={statusOpen} onOpenChange={setStatusOpen}>
          {statusItems.map((item) => (
            <NavRow key={item.to} {...item} onNavigate={closeMobile} />
          ))}
        </CollapsibleBlock>

        {userMenuItems.length > 0 && (
          <CollapsibleBlock
            title={user?.role === 'MASTER' ? '管理' : '管理・情報'}
            open={adminOpen}
            onOpenChange={setAdminOpen}
          >
            {userMenuItems.map((item) => (
              <NavRow key={item.to} {...item} onNavigate={closeMobile} />
            ))}
          </CollapsibleBlock>
        )}
      </nav>
    </aside>
  );
};
