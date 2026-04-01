import React, { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { Layout } from './components/layout/Layout';
import { PcOnlyPage } from './components/layout/PcOnlyPage';
import { LoadingSpinner } from './components/common/LoadingSpinner';
import { RoleProtectedRoute } from './components/common/RoleProtectedRoute';

/** 初回バンドル縮小のためページを遅延読み込み（ログイン後の各画面で分割チャンクを取得） */
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
const Consultations = lazy(() => import('./pages/Consultations').then((m) => ({ default: m.Consultations })));
const ActivityExpenses = lazy(() => import('./pages/ActivityExpenses').then((m) => ({ default: m.ActivityExpenses })));
const Announcements = lazy(() => import('./pages/Announcements').then((m) => ({ default: m.Announcements })));
const Wishes = lazy(() => import('./pages/Wishes').then((m) => ({ default: m.Wishes })));

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const App: React.FC = () => {
  const { isLoading, fetchMe, user } = useAuthStore();

  useEffect(() => {
    fetchMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', !!user?.darkMode);
  }, [user?.darkMode]);

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

        <Route
          path="/"
          element={
            <PrivateRoute>
              <Navigate to="/dashboard" replace />
            </PrivateRoute>
          }
        />

        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/schedule"
          element={
            <PrivateRoute>
              <Layout>
                <Schedule />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/reports/weekly"
          element={
            <PrivateRoute>
              <Layout>
                <PcOnlyPage title="週次報告">
                  <WeeklyReport />
                </PcOnlyPage>
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/settings/users"
          element={
            <PrivateRoute>
              <Layout>
                <UsersSettings />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/settings/locations"
          element={
            <PrivateRoute>
              <Layout>
                <LocationsSettings />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/settings/drive-links"
          element={
            <PrivateRoute>
              <Layout>
                <DriveLinksSettings />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/settings/profile"
          element={
            <PrivateRoute>
              <Layout>
                <ProfileSettings />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/settings/document-templates"
          element={
            <RoleProtectedRoute allowedRoles={['SUPPORT', 'MASTER']}>
              <Layout>
                <DocumentTemplatesSettings />
              </Layout>
            </RoleProtectedRoute>
          }
        />

        <Route
          path="/goals"
          element={
            <PrivateRoute>
              <Layout>
                <Goals />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/projects"
          element={
            <PrivateRoute>
              <Layout>
                <Projects />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/tasks"
          element={
            <PrivateRoute>
              <Layout>
                <Tasks />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/events"
          element={
            <PrivateRoute>
              <Layout>
                <Events />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/events/:id"
          element={
            <PrivateRoute>
              <Layout>
                <EventDetail />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/events/participation-summary"
          element={
            <PrivateRoute>
              <Layout>
                <EventParticipationSummary />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/sns-posts"
          element={
            <PrivateRoute>
              <Layout>
                <SNSPosts />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/contacts"
          element={
            <PrivateRoute>
              <Layout>
                <Contacts />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/inspections"
          element={
            <PrivateRoute>
              <Layout>
                <PcOnlyPage title="復命書（視察）">
                  <Inspections />
                </PcOnlyPage>
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/reports/monthly"
          element={
            <RoleProtectedRoute allowedRoles={['MASTER', 'SUPPORT']}>
              <Layout>
                <PcOnlyPage title="月次報告">
                  <MonthlyReport />
                </PcOnlyPage>
              </Layout>
            </RoleProtectedRoute>
          }
        />

        <Route
          path="/support-records"
          element={
            <RoleProtectedRoute allowedRoles={['SUPPORT', 'MASTER']}>
              <Layout>
                <PcOnlyPage title="支援記録">
                  <SupportRecords />
                </PcOnlyPage>
              </Layout>
            </RoleProtectedRoute>
          }
        />

        <Route
          path="/interview/monthly-schedules"
          element={
            <RoleProtectedRoute allowedRoles={['MASTER', 'SUPPORT', 'GOVERNMENT']}>
              <Layout>
                <PcOnlyPage title="面談・月次スケジュール">
                  <InterviewMonthlySchedules />
                </PcOnlyPage>
              </Layout>
            </RoleProtectedRoute>
          }
        />

        <Route
          path="/consultations"
          element={
            <PrivateRoute>
              <Layout>
                <Consultations />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/activity-expenses"
          element={
            <PrivateRoute>
              <Layout>
                <ActivityExpenses />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/wishes"
          element={
            <PrivateRoute>
              <Layout>
                <Wishes />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/announcements"
          element={
            <PrivateRoute>
              <Layout>
                <Announcements />
              </Layout>
            </PrivateRoute>
          }
        />

        <Route
          path="/nudges"
          element={
            <PrivateRoute>
              <Layout>
                <Nudges />
              </Layout>
            </PrivateRoute>
          }
        />
      </Routes>
    </Suspense>
  );
};

export default App;
