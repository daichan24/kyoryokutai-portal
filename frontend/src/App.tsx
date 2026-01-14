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

// 既存のインポートの下に追加
import { Projects } from './pages/Projects';
import { Events } from './pages/Events';
import { SNSPosts } from './pages/SNSPosts';
import { Goals } from './pages/Goals';
import { TaskRequests } from './pages/TaskRequests';
import { Inspections } from './pages/Inspections';
import { Contacts } from './pages/Contacts';
import { MonthlyReport } from './pages/MonthlyReport';
import { RoleProtectedRoute } from './components/common/RoleProtectedRoute';

const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const App: React.FC = () => {
  const { isLoading, fetchMe } = useAuthStore();

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

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
    </Routes>
  );
};

export default App;
