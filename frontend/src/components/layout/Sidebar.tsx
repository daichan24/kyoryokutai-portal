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

  const navItems = [
    { to: '/dashboard', icon: Home, label: 'ダッシュボード' },
    { to: '/schedule', icon: Calendar, label: 'スケジュール' },
    { to: '/reports/weekly', icon: FileText, label: '週次報告' },
    { to: '/goals', icon: Target, label: '起業準備進捗' },
    { to: '/projects', icon: FolderKanban, label: 'プロジェクト' },
    { to: '/events', icon: CalendarDays, label: 'イベント' },
    { to: '/sns-posts', icon: Share2, label: 'SNS投稿' },
    { to: '/contacts', icon: Contact, label: '町民データベース' },
    { to: '/task-requests', icon: UserCheck, label: 'タスク依頼' },
    { to: '/inspections', icon: Eye, label: '視察記録' },
    { to: '/reports/monthly', icon: FileBarChart, label: '月次報告' },
  ];

  const adminItems =
    user?.role === 'MASTER'
      ? [
          { to: '/settings/users', icon: Users, label: 'ユーザー管理' },
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

        {adminItems.length > 0 && (
          <>
            <div className="pt-4 pb-2">
              <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                管理
              </p>
            </div>
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
