import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader, Tabs } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { useLang } from '@/app/LangContext';
import Account from './Account';
import AuthSettings from './AuthSettings';
import LoginHistory from './LoginHistory';
import Roles from './Roles';
import Users from './Users';

export default function Settings() {
  const { tr } = useLang();
  const { can } = useAuth();
  const { tab } = useParams();
  const navigate = useNavigate();
  const tabs = [
    can('users') && { value: 'users', label: tr('អ្នកប្រើប្រាស់', 'Users'), el: <Users /> },
    can('roles') && { value: 'roles', label: tr('តួនាទី និងសិទ្ធិ', 'Roles & permissions'), el: <Roles /> },
    can('loginHistory') && { value: 'login-history', label: tr('ប្រវត្តិចូលប្រព័ន្ធ', 'Login history'), el: <LoginHistory /> },
    can('authSettings') && { value: 'auth', label: tr('សុវត្ថិភាពចូលប្រព័ន្ធ', 'Auth'), el: <AuthSettings /> },
    { value: 'account', label: tr('គណនីរបស់ខ្ញុំ', 'My account'), el: <Account /> },
  ].filter(Boolean);
  const current = tabs.find((t) => t.value === tab) || tabs[0];
  return (
    <div>
      <PageHeader title={tr('ការកំណត់', 'Settings')} />
      <Tabs tabs={tabs} value={current.value} onChange={(v) => navigate(`/settings/${v}`)} />
      {current.el}
    </div>
  );
}
