import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from './stores/authStore';
import { LoadingSpinner } from './components/common/LoadingSpinner';
import { RoleProtectedRoute } from './components/common/RoleProtectedRoute';

/** 初回バンドル縮小のためページを遅延読み込み（ログイン後の各画面で分割チャンクを取得） */
const Layout = lazy(() => import('./components/layout/Layout').then((m) => ({ default: m.Layout })));
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Schedule = lazy(() => import('./pages/Schedule').then((m) => ({ default: m.Schedule })));
const WeeklyReport = lazy(() => import('./pages/WeeklyReport').then((m) => ({ default: m.WeeklyReport })));
const UsersSettings = lazy(() => import('./pages/Settings/Users').then((m) => ({ default: m.UsersSettings })));
const LocationsSettings = lazy(() => import('./pages/Settings/Locations').then((m) => ({ default: m.LocationsSettings })));
const DriveLinksSettings = lazy(() => import('./pages/Settings/DriveLinks').then((m) => ({ default: m.DriveLinksSettings })));
const ProfileSettings = lazy(() => import('./pages/Settings/Profile').then((m) => ({ default: m.ProfileSettings })));
const DocumentTemplatesSettings = lazy(() =>
  import('./pages/Settings/DocumentTemplates').then((m) => ({ default: m.DocumentTemplatesSettings })),
);
const EmailJobsSettings = lazy(() => import('./pages/Settings/EmailJobs').then((m) => ({ default: m.EmailJobsSettings })));
const GoogleCalendarSettings = lazy(() =>
  import('./pages/Settings/GoogleCalendar').then((m) => ({ default: m.GoogleCalendarSettings })),
);
const Nudges = lazy(() => import('./pages/Nudges').then((m) => ({ default: m.Nudges })));
const Projects = lazy(() => import('./pages/Projects').then((m) => ({ default: m.Projects })));
const Events = lazy(() => import('./pages/Events').then((m) => ({ default: m.Events })));
const EventDetail = lazy(() => import('./pages/EventDetail').then((m) => ({ default: m.EventDetail })));
const EventParticipationSummary = lazy(() =>
  import('./pages/EventParticipationSummary').then((m) => ({ default: m.EventParticipationSummary })),
);
const SNSPosts = lazy(() => import('./pages/SNSPosts').then((m) => ({ default: m.SNSPosts })));
const Goals = lazy(() => import('./pages/Goals').then((m) => ({ default: m.Goals })));
const Tasks = lazy(() => import('./pages/Tasks').then((m) => ({ default: m.Tasks })));
const Inspections = lazy(() => import('./pages/Inspections').then((m) => ({ default: m.Inspections })));
const Contacts = lazy(() => import('./pages/Contacts').then((m) => ({ default: m.Contacts })));
const MonthlyReport = lazy(() => import('./pages/MonthlyReport').then((m) => ({ default: m.MonthlyReport })));
const SupportRecords = lazy(() => import('./pages/SupportRecords').then((m) => ({ default: m.SupportRecords })));
const InterviewMonthlySchedules = lazy(() =>
  import('./pages/InterviewMonthlySchedules').then((m) => ({ default: m.InterviewMonthlySchedules })),
);
const InterviewPolls = lazy(() => import('./pages/InterviewPolls').then((m) => ({ default: m.InterviewPolls })));
const ActivityExpenses = lazy(() => import('./pages/ActivityExpenses').then((m) => ({ default: m.ActivityExpenses })));
const Announcements = lazy(() => import('./pages/Announcements').then((m) => ({ default: m.Announcements })));
const Wishes = lazy(() => import('./pages/Wishes').then((m) => ({ default: m.Wishes })));
const InboxPage = lazy(() => import('./pages/InboxPage').then((m) => ({ default: m.InboxPage })));
const NotepadPage = lazy(() => import('./pages/NotepadPage').then((m) => ({ default: m.NotepadPage })));
const LeaveManagement = lazy(() => import('./pages/LeaveManagement').then((m) => ({ default: m.LeaveManagement })));
const Handover = lazy(() => import('./pages/Handover'));

const PrivateRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children ?? <Outlet />}</> : <Navigate to="/login" replace />;
};

const getDefaultAuthenticatedPath = () => {
  if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
    return '/schedule';
  }
  return '/dashboard';
};

const App: React.FC = () => {
  const { isLoading, fetchMe, logout, user } = useAuthStore();
  const queryClient = useQueryClient();

  useEffect(() => {
    fetchMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', !!user?.darkMode);
  }, [user?.darkMode]);

  useEffect(() => {
    const handleUnauthorized = async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      logout();
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [logout, queryClient]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background dark:bg-gray-900">
          <LoadingSpinner size="lg" />
        </div>
      }
    >
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<PrivateRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to={getDefaultAuthenticatedPath()} replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/reports/weekly" element={<WeeklyReport />} />
            <Route path="/settings/users" element={<UsersSettings />} />
            <Route path="/settings/locations" element={<LocationsSettings />} />
            <Route path="/settings/drive-links" element={<DriveLinksSettings />} />
            <Route path="/settings/profile" element={<ProfileSettings />} />
            <Route path="/settings/google-calendar" element={<GoogleCalendarSettings />} />
            <Route path="/goals" element={<Goals />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:id" element={<EventDetail />} />
            <Route path="/events/participation-summary" element={<EventParticipationSummary />} />
            <Route path="/sns-posts" element={<SNSPosts />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/inspections" element={<Inspections />} />
            <Route path="/interview/polls" element={<InterviewPolls />} />
            <Route path="/consultations" element={<InboxPage />} />
            <Route path="/activity-expenses" element={<ActivityExpenses />} />
            <Route path="/wishes" element={<Wishes />} />
            <Route path="/announcements" element={<Announcements />} />
            <Route path="/reception-box" element={<InboxPage />} />
            <Route path="/nudges" element={<Nudges />} />
            <Route path="/notepad" element={<NotepadPage />} />
            <Route path="/notepad/:id" element={<NotepadPage />} />
            <Route path="/leave-management" element={<LeaveManagement />} />
            <Route path="/handover" element={<Handover />} />

            <Route element={<RoleProtectedRoute allowedRoles={['SUPPORT', 'MASTER']} />}>
              <Route path="/settings/document-templates" element={<DocumentTemplatesSettings />} />
              <Route path="/settings/email-jobs" element={<EmailJobsSettings />} />
              <Route path="/support-records" element={<SupportRecords />} />
            </Route>

            <Route element={<RoleProtectedRoute allowedRoles={['MASTER', 'SUPPORT', 'GOVERNMENT']} />}>
              <Route path="/reports/monthly" element={<MonthlyReport />} />
              <Route path="/interview/monthly-schedules" element={<InterviewMonthlySchedules />} />
            </Route>
          </Route>
        </Route>
      </Routes>
      {/* ビルドバージョン表示（デバッグ用） */}
      <div style={{ position: 'fixed', bottom: '5px', right: '5px', fontSize: '10px', color: '#999', zIndex: 9999 }}>
        v{import.meta.env.VITE_BUILD_ID || 'dev'}
      </div>
    </Suspense>
  );
};

export default App;
