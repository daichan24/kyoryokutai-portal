import React, { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { Layout } from './components/layout/Layout';
import { LoadingSpinner } from './components/common/LoadingSpinner';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Schedule } from './pages/Schedule';
import { WeeklyReport } from './pages/WeeklyReport';
import { UsersSettings } from './pages/Settings/Users';
import { LocationsSettings } from './pages/Settings/Locations';
import { ProfileSettings } from './pages/Settings/Profile';
import { DocumentTemplatesSettings } from './pages/Settings/DocumentTemplates';
import { Nudges } from './pages/Nudges';

// 既存のインポートの下に追加
import { Projects } from './pages/Projects';
import { Events } from './pages/Events';
import { EventDetail } from './pages/EventDetail';
import { EventParticipationSummary } from './pages/EventParticipationSummary';
import { SNSPosts } from './pages/SNSPosts';
import { Goals } from './pages/Goals';
import { Tasks } from './pages/Tasks';
import { TaskRequests } from './pages/TaskRequests';
import { Inspections } from './pages/Inspections';
import { Contacts } from './pages/Contacts';
import { MonthlyReport } from './pages/MonthlyReport';
import { SupportRecords } from './pages/SupportRecords';
import { RoleProtectedRoute } from './components/common/RoleProtectedRoute';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const App: React.FC = () => {
  const { isLoading, fetchMe, user } = useAuthStore();

  useEffect(() => {
    fetchMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 初回マウント時のみ実行

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
              <WeeklyReport />
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
          <RoleProtectedRoute allowedRoles={['MASTER']}>
            <Layout>
              <LocationsSettings />
            </Layout>
          </RoleProtectedRoute>
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

      {/* Phase 2 */}
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

      {/* Phase 4 */}
      <Route
        path="/task-requests"
        element={
          <PrivateRoute>
            <Layout>
              <TaskRequests />
            </Layout>
          </PrivateRoute>
        }
      />

      <Route
        path="/inspections"
        element={
          <PrivateRoute>
            <Layout>
              <Inspections />
            </Layout>
          </PrivateRoute>
        }
      />

      <Route
        path="/reports/monthly"
        element={
          <RoleProtectedRoute allowedRoles={['MASTER', 'SUPPORT']}>
            <Layout>
              <MonthlyReport />
            </Layout>
          </RoleProtectedRoute>
        }
      />

      <Route
        path="/support-records"
        element={
          <RoleProtectedRoute allowedRoles={['SUPPORT', 'MASTER']}>
            <Layout>
              <SupportRecords />
            </Layout>
          </RoleProtectedRoute>
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
  );
};

export default App;
