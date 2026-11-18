import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { Loading } from './components/ui';
import { useAuth } from './context/AuthContext';
import { useLang } from './context/LangContext';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Medicines from './pages/Medicines';
import PatientDetail from './pages/PatientDetail';
import Patients from './pages/Patients';
import Reports from './pages/reports/Reports';
import Settings from './pages/settings/Settings';
import Stock from './pages/Stock';
import Usage from './pages/Usage';

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

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }
  return (
    <Routes>
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
