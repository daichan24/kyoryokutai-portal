import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Calendar,
  FileText,
  Settings,
  Users,
  MapPin,
  Target,
  FolderKanban,
  CalendarDays,
  CalendarCheck,
  Share2,
  UserCheck,
  Eye,
  Contact,
  FileBarChart,
  MessageSquareText,
  Check,
  ListChecks,
  HardDrive,
  NotebookPen,
  MessageCircle,
  Banknote,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CalendarClock,
  FolderOpen,
  Mail,
  Package,
  KeyRound,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../utils/cn';
import { X } from 'lucide-react';

interface SidebarProps {
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
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
    pathname.startsWith('/leave-management') ||
    pathname.startsWith('/consultations') ||
    pathname.startsWith('/reception-box') ||
    pathname.startsWith('/support-records') ||
    pathname.startsWith('/interview')
  );
}

function matchesAdminPath(pathname: string) {
  return (
    (pathname.startsWith('/settings') &&
      !pathname.startsWith('/settings/ai-connections') &&
      !pathname.startsWith('/settings/google-calendar') &&
      !pathname.startsWith('/settings/drive-links')) ||
    pathname.startsWith('/nudges')
  );
}

function matchesExternalConnectionPath(pathname: string) {
  return (
    pathname.startsWith('/settings/ai-connections') ||
    pathname.startsWith('/settings/google-calendar') ||
    pathname.startsWith('/settings/drive-links')
  );
}

function matchesStatusPath(pathname: string) {
  return (
    pathname.startsWith('/sns-posts') ||
    pathname.startsWith('/events/participation-summary') ||
    pathname.startsWith('/inventory') ||
    pathname.startsWith('/contacts')
  );
}

function CollapsibleBlock({
  title,
  open,
  onOpenChange,
  children,
  iconOnly,
}: {
  title: string;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  children: React.ReactNode;
  iconOnly?: boolean;
}) {
  if (iconOnly) {
    // 折りたたみ時は、今いるページが属するセクションだけ自動で開くが、
    // 矢印ボタンで他のセクションも個別に開閉できるようにする
    return (
      <div className="pt-2">
        <button
          type="button"
          onClick={() => onOpenChange(!open)}
          className="flex w-full items-center justify-center rounded-lg py-1.5 text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          title={title}
          aria-label={title}
          aria-expanded={open}
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        {open && <div className="space-y-1">{children}</div>}
      </div>
    );
  }

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
  iconOnly,
}: {
  to: string;
  icon: NavIcon;
  label: string;
  end?: boolean;
  onNavigate?: () => void;
  iconOnly?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      title={iconOnly ? label : undefined}
      className={({ isActive }) =>
        cn(
          'flex items-center rounded-lg transition-colors text-sm md:text-base',
          iconOnly ? 'justify-center px-2 py-2.5 md:py-3' : 'space-x-2 md:space-x-3 px-3 md:px-4 py-2.5 md:py-3',
          isActive
            ? 'bg-primary text-white'
            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
        )
      }
    >
      <Icon className="h-[1.125rem] w-[1.125rem] md:h-5 md:w-5 shrink-0" />
      {!iconOnly && <span className="font-medium leading-snug">{label}</span>}
    </NavLink>
  );
}

function matchesGoalsPath(pathname: string) {
  return (
    pathname.startsWith('/goals') ||
    pathname.startsWith('/projects') ||
    pathname.startsWith('/tasks') ||
    pathname.startsWith('/events')
  );
}

export const Sidebar: React.FC<SidebarProps> = ({ onClose, collapsed = false, onToggleCollapse }) => {
  const { user } = useAuthStore();
  const location = useLocation();

  const docActive = matchesDocPath(location.pathname);
  const supportActive = matchesSupportPath(location.pathname);
  const adminActive = matchesAdminPath(location.pathname);
  const statusActive = matchesStatusPath(location.pathname);
  const goalsActive = matchesGoalsPath(location.pathname);
  const externalConnectionActive = matchesExternalConnectionPath(location.pathname);

  const [docOpen, setDocOpen] = useState(false);
  const [supportMenuOpen, setSupportMenuOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [goalsOpen, setGoalsOpen] = useState(false);
  const [externalConnectionOpen, setExternalConnectionOpen] = useState(false);

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

  useEffect(() => {
    if (goalsActive) setGoalsOpen(true);
  }, [goalsActive]);

  useEffect(() => {
    if (externalConnectionActive) setExternalConnectionOpen(true);
  }, [externalConnectionActive]);

  const commonItems = [
    { to: '/schedule', icon: Calendar, label: 'スケジュール' },
    ...(user?.wishesEnabled !== false ? [{ to: '/wishes', icon: ListChecks, label: 'やりたいこと100' }] : []),
  ];

  const goalsAndEventsItems = [
    { to: '/goals', icon: Target, label: 'ミッション' },
    { to: '/projects', icon: FolderKanban, label: 'プロジェクト' },
    { to: '/tasks', icon: Check, label: 'タスク' },
    { to: '/events', icon: CalendarDays, label: 'オーガナイザー', end: true as const },
  ];

  const getReportDocumentItems = (): Array<{ to: string; icon: NavIcon; label: string }> => {
    const items: Array<{ to: string; icon: NavIcon; label: string }> = [
      { to: '/reports/weekly', icon: FileText, label: '週次報告' },
    ];
    if (user?.role === 'SUPPORT' || user?.role === 'MASTER' || user?.role === 'GOVERNMENT') {
      items.push({ to: '/reports/monthly', icon: FileBarChart, label: '月次報告' });
    }
    items.push({ to: '/inspections', icon: Eye, label: '復命書' });
    return items;
  };

  const getSupportWorkflowItems = (): Array<{ to: string; icon: NavIcon; label: string }> => {
    const items: Array<{ to: string; icon: NavIcon; label: string }> = [
      { to: '/activity-expenses', icon: Banknote, label: '活動経費' },
      { to: '/leave-management', icon: CalendarClock, label: '有給・代休' },
    ];
    if (user?.role === 'MEMBER') {
      items.push({ to: '/reception-box', icon: MessageCircle, label: '受付ボックス・相談' });
    }
    if (user?.role === 'MASTER' || user?.role === 'SUPPORT' || user?.role === 'GOVERNMENT') {
      items.push({ to: '/reception-box', icon: MessageCircle, label: '受付ボックス・相談' });
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
    items.push({
      to: '/interview/polls',
      icon: CalendarCheck,
      label: '面談日程調整',
    });
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
    userMenuItems.push({
      to: '/settings/email-jobs',
      icon: Mail,
      label: 'メール通知キュー',
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
    to: '/handover',
    icon: FolderOpen,
    label: '引き継ぎ',
  });

  const externalConnectionItems: Array<{ to: string; icon: NavIcon; label: string }> = [
    { to: '/settings/ai-connections', icon: KeyRound, label: 'AI接続' },
    { to: '/settings/google-calendar', icon: CalendarCheck, label: 'Googleカレンダー' },
    { to: '/settings/drive-links', icon: HardDrive, label: 'ドライブ' },
  ];

  const statusItems: Array<{ to: string; icon: NavIcon; label: string; end?: boolean }> = [
    { to: '/sns-posts', icon: Share2, label: 'SNS投稿' },
    { to: '/events/participation-summary', icon: CalendarDays, label: 'イベント参加状況' },
    { to: '/inventory', icon: Package, label: '在庫管理' },
    ...(user?.contactsSidebarEnabled === true ? [{ to: '/contacts', icon: Contact, label: '町民データベース' }] : []),
  ];

  const closeMobile = () => onClose?.();

  return (
    <aside
      className={cn(
        'bg-card dark:bg-gray-800 border-r border-border dark:border-gray-700 h-full flex flex-col shadow-lg md:shadow-none transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
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

      {onToggleCollapse && (
        <div className={cn('hidden md:flex p-2 border-b border-border dark:border-gray-700', collapsed ? 'justify-center' : 'justify-end')}>
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
            title={collapsed ? 'サイドバーを開く' : 'サイドバーを閉じる'}
            aria-label={collapsed ? 'サイドバーを開く' : 'サイドバーを閉じる'}
          >
            {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
          </button>
        </div>
      )}

      <nav className={cn('space-y-2 overflow-y-auto flex-1', collapsed ? 'p-2' : 'p-4')}>
        {commonItems.map((item) => (
          <NavRow key={item.to} {...item} onNavigate={closeMobile} iconOnly={collapsed} />
        ))}

        <CollapsibleBlock title="目標・オーガナイザー" open={goalsOpen} onOpenChange={setGoalsOpen} iconOnly={collapsed}>
          {goalsAndEventsItems.map((item) => (
            <NavRow key={item.to} {...item} onNavigate={closeMobile} iconOnly={collapsed} />
          ))}
        </CollapsibleBlock>

        {reportDocumentItems.length > 0 && (
          <CollapsibleBlock title="報告書" open={docOpen} onOpenChange={setDocOpen} iconOnly={collapsed}>
            {reportDocumentItems.map((item) => (
              <NavRow key={item.to} {...item} onNavigate={closeMobile} iconOnly={collapsed} />
            ))}
          </CollapsibleBlock>
        )}

        {supportWorkflowItems.length > 0 && (
          <CollapsibleBlock title="サポート・連絡" open={supportMenuOpen} onOpenChange={setSupportMenuOpen} iconOnly={collapsed}>
            {supportWorkflowItems.map((item) => (
              <NavRow key={`${item.to}-${item.label}`} {...item} onNavigate={closeMobile} iconOnly={collapsed} />
            ))}
          </CollapsibleBlock>
        )}

        <CollapsibleBlock title="状況" open={statusOpen} onOpenChange={setStatusOpen} iconOnly={collapsed}>
          {statusItems.map((item) => (
            <NavRow key={item.to} {...item} onNavigate={closeMobile} iconOnly={collapsed} />
          ))}
        </CollapsibleBlock>

        {userMenuItems.length > 0 && (
          <CollapsibleBlock
            title={user?.role === 'MASTER' ? '管理' : '管理・情報'}
            open={adminOpen}
            onOpenChange={setAdminOpen}
            iconOnly={collapsed}
          >
            {userMenuItems.map((item) => (
              <NavRow key={item.to} {...item} onNavigate={closeMobile} iconOnly={collapsed} />
            ))}
          </CollapsibleBlock>
        )}

        <CollapsibleBlock
          title="外部接続"
          open={externalConnectionOpen}
          onOpenChange={setExternalConnectionOpen}
          iconOnly={collapsed}
        >
          {externalConnectionItems.map((item) => (
            <NavRow key={item.to} {...item} onNavigate={closeMobile} iconOnly={collapsed} />
          ))}
        </CollapsibleBlock>
      </nav>
    </aside>
  );
};
