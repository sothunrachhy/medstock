import {
  Check,
  ChevronDown,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Pill,
  Settings,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { ORG } from '@/config/org';
import { useAuth } from '@/features/auth/AuthContext';
import { useLang } from '@/app/LangContext';
import { LANGS } from '@/components/brand/Flags';
import Logo, { Wordmark } from '@/components/brand/Logo';

// Close a dropdown when clicking outside it or pressing Escape.
function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const first = [...parts[0]][0] || '';
  const last = parts.length > 1 ? [...parts[parts.length - 1]][0] || '' : '';
  return (first + last).toUpperCase();
}

function LanguageMenu() {
  const { lang, setLang, tr } = useLang();
  const { open, setOpen, ref } = useDropdown();
  const current = LANGS.find((l) => l.code === lang) || LANGS[0];
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg p-1.5 transition hover:bg-slate-100"
        aria-label={tr('ប្ដូរភាសា', 'Change language')}
        aria-expanded={open}
      >
        <current.Flag className="h-7 w-10 rounded-[3px] shadow-sm ring-1 ring-slate-200" />
        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {LANGS.map(({ code, label, Flag }) => (
            <button
              key={code}
              type="button"
              onClick={() => {
                setLang(code);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-slate-50 ${lang === code ? 'font-semibold text-brand-700' : 'text-slate-700'}`}
            >
              <Flag className="h-5 w-7 rounded-[2px] ring-1 ring-slate-200" />
              <span className="flex-1">{label}</span>
              {lang === code && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserMenu() {
  const { user, logout } = useAuth();
  const { tr } = useLang();
  const { open, setOpen, ref } = useDropdown();
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-full p-0.5 ring-2 ring-brand-600 transition hover:ring-brand-500 focus:outline-none focus-visible:ring-4"
        aria-label={tr('គណនី', 'Account')}
        aria-expanded={open}
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
          {initials(user?.fullName || user?.username)}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 font-semibold text-white">
              {initials(user?.fullName || user?.username)}
            </span>
            <div className="min-w-0">
              <div className="truncate font-semibold text-slate-900">{user?.fullName}</div>
              <div className="truncate text-sm text-slate-500">
                @{user?.username} · {user?.role?.name}
              </div>
            </div>
          </div>
          <div className="py-1">
            <Link
              to="/settings/account"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <UserCog className="h-4.5 w-4.5" /> {tr('គណនីរបស់ខ្ញុំ', 'My account')}
            </Link>
            <button
              type="button"
              onClick={logout}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 hover:bg-red-50"
            >
              <LogOut className="h-4.5 w-4.5" /> {tr('ចាកចេញ', 'Log out')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { can } = useAuth();
  const { tr } = useLang();
  const [open, setOpen] = useState(false);

  const nav = [
    { to: '/', icon: LayoutDashboard, label: tr('ផ្ទាំងគ្រប់គ្រង', 'Dashboard'), show: can('dashboard') },
    { to: '/patients', icon: Users, label: tr('អ្នកជំងឺ', 'Patients'), show: can('patients') },
    { to: '/usage', icon: ClipboardList, label: tr('ការប្រើប្រាស់ឱសថ', 'Medicine usage'), show: can('usage') },
    { to: '/stock', icon: Package, label: tr('ស្តុកឱសថ', 'Stock'), show: can('stock') },
    { to: '/medicines', icon: Pill, label: tr('បញ្ជីឱសថ', 'Medicine list'), show: can('medicines') },
    { to: '/reports', icon: FileText, label: tr('របាយការណ៍', 'Reports'), show: can('reports') },
    {
      to: '/settings',
      icon: Settings,
      label: tr('ការកំណត់', 'Settings'),
      show: true,
    },
  ].filter((n) => n.show);

  const sidebar = (
    <aside className="flex h-full w-80 flex-col bg-brand-950 text-brand-100">
      <div className="flex items-center gap-4 px-5 py-6">
        <Logo className="h-12 w-12 shrink-0 rounded-2xl shadow-lg shadow-black/30" />
        <Wordmark className="text-3xl" onDark />
      </div>
      <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 pb-4">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `relative flex items-center gap-4 rounded-xl px-4 py-4 text-lg font-medium transition ${isActive ? 'bg-brand-600 text-white shadow-lg shadow-black/20 before:absolute before:inset-y-3 before:left-0 before:w-1.5 before:rounded-r-full before:bg-accent-500' : 'hover:bg-brand-900 hover:text-white'}`
            }
          >
            <Icon className="h-7 w-7 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );

  return (
    <div className="flex h-full">
      <div className="no-print hidden lg:block">{sidebar}</div>
      {open && (
        <div className="no-print fixed inset-0 z-40 flex lg:hidden">
          <div className="relative">{sidebar}</div>
          <button type="button" className="flex-1 bg-brand-950/50" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="absolute top-4 right-4 h-6 w-6 text-white" />
          </button>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
          <button type="button" className="btn-icon lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden text-sm text-slate-500 lg:block">{ORG.hospital}</div>
          <div className="flex items-center gap-3">
            <LanguageMenu />
            <UserMenu />
          </div>
        </header>
        <main className="print-area flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
