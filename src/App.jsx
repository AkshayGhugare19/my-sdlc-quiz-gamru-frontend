import { useEffect } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore.js';
import { ToastProvider, Spinner } from './components/ui.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Missions from './pages/Missions.jsx';
import MissionBundles from './pages/MissionBundles.jsx';
import Ranks from './pages/Ranks.jsx';
import Users from './pages/Users.jsx';
import SystemUsers from './pages/SystemUsers.jsx';
import TeamStructure from './pages/TeamStructure.jsx';
import Tournaments from './pages/Tournaments.jsx';
import Leaderboards from './pages/Leaderboards.jsx';
import Media from './pages/Media.jsx';
import ResourceTable from './components/ResourceTable.jsx';
import RequireAbility from './components/RequireAbility.jsx';
import { RESOURCE_CONFIGS } from './config/resourceConfigs.jsx';

// Config-driven CRUD routes. Resources with dedicated pages (builders / insight
// views) are excluded from the generic CRUD routes.
const DEDICATED_PAGES = {
  missions: Missions,
  'mission-bundles': MissionBundles,
  ranks: Ranks,
  users: Users,
  'system-users': SystemUsers,
  'team-structure': TeamStructure,
  tournaments: Tournaments,
  leaderboards: Leaderboards,
};
// Dedicated pages whose RBAC resource differs from their route path.
const PAGE_RESOURCE = {
  'system-users': 'users',
  'team-structure': 'users',
};
const CRUD_ROUTES = Object.entries(RESOURCE_CONFIGS).filter(([path]) => !DEDICATED_PAGES[path]);

export default function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const bootstrapping = useAuthStore((s) => s.bootstrapping);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  // Verify a persisted token once on boot.
  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // React to a hard 401 from the axios interceptor.
  useEffect(() => {
    const onUnauth = () => {
      logout();
      navigate('/login');
    };
    window.addEventListener('ng:unauthorized', onUnauth);
    return () => window.removeEventListener('ng:unauthorized', onUnauth);
  }, [logout, navigate]);

  if (bootstrapping) {
    return (
      <div className="min-h-screen grid place-items-center text-neon">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <ToastProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route
            index
            element={
              <RequireAbility resource="analytics" action="view">
                <Dashboard />
              </RequireAbility>
            }
          />
          {Object.entries(DEDICATED_PAGES).map(([path, Page]) => (
            <Route
              key={path}
              path={path}
              element={
                <RequireAbility resource={PAGE_RESOURCE[path] || path}>
                  <Page />
                </RequireAbility>
              }
            />
          ))}
          <Route
            path="media"
            element={
              <RequireAbility resource="media">
                <Media />
              </RequireAbility>
            }
          />
          {CRUD_ROUTES.map(([path, config]) => (
            <Route
              key={path}
              path={path}
              element={
                <RequireAbility resource={path}>
                  <ResourceTable {...config} resource={path} />
                </RequireAbility>
              }
            />
          ))}
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ToastProvider>
  );
}
