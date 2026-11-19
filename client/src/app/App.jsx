import { lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { Loading } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { safeRedirect } from '@shared/safeRedirect';
import { useLang } from './LangContext';
import Login from '@/features/auth/Login';

// Each screen is its own chunk, downloaded the first time it is opened
// (e.g. the charts library only loads with the dashboard).
const Dashboard = lazy(() => import('@/features/dashboard/Dashboard'));
const Medicines = lazy(() => import('@/features/medicines/Medicines'));
const PatientDetail = lazy(() => import('@/features/patients/PatientDetail'));
const Patients = lazy(() => import('@/features/patients/Patients'));
const Reports = lazy(() => import('@/features/reports/Reports'));
const Settings = lazy(() => import('@/features/settings/Settings'));
const Stock = lazy(() => import('@/features/stock/Stock'));
const Usage = lazy(() => import('@/features/usage/Usage'));

function Guard({ module, children }) {
  const { can } = useAuth();
  const { tr } = useLang();
  if (module && !can(module)) {
    return <div className="card p-10 text-center text-slate-500">{tr('អ្នកមិនមានសិទ្ធិចូលមើលផ្នែកនេះទេ', 'You do not have permission to view this page.')}</div>;
  }
  return children;
}

function Home() {
  const { can } = useAuth();
  if (can('dashboard')) return <Dashboard />;
  const first = ['patients', 'usage', 'stock', 'reports'].find((m) => can(m));
  return first ? <Navigate to={`/${first}`} replace /> : <Navigate to="/settings/account" replace />;
}

// Logged out: send every page to /login and remember where the user wanted to go.
function RedirectToLogin() {
  const location = useLocation();
  const from = safeRedirect(location.pathname + location.search, null);
  return <Navigate to="/login" replace state={from && from !== '/' ? { from } : undefined} />;
}

// Logged in but on /login (e.g. right after signing in): go to the remembered page.
function LeaveLogin() {
  const location = useLocation();
  return <Navigate to={safeRedirect(location.state?.from)} replace />;
}

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<RedirectToLogin />} />
      </Routes>
    );
  }
  return (
    <Routes>
      <Route path="/login" element={<LeaveLogin />} />
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="patients" element={<Guard module="patients"><Patients /></Guard>} />
        <Route path="patients/:id" element={<Guard module="patients"><PatientDetail /></Guard>} />
        <Route path="usage" element={<Guard module="usage"><Usage /></Guard>} />
        <Route path="stock" element={<Guard module="stock"><Stock /></Guard>} />
        <Route path="stock/:category" element={<Guard module="stock"><Stock /></Guard>} />
        <Route path="medicines" element={<Guard module="medicines"><Medicines /></Guard>} />
        <Route path="reports" element={<Guard module="reports"><Reports /></Guard>} />
        <Route path="reports/:tab" element={<Guard module="reports"><Reports /></Guard>} />
        <Route path="settings" element={<Settings />} />
        <Route path="settings/:tab" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
