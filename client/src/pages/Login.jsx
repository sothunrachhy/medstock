import { CircleHelp, Eye, EyeOff, Info, Lock, Phone, User } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { errMsg } from '../api/client';
import { LANGS } from '../components/Flags';
import Logo, { Wordmark } from '../components/Logo';
import { ORG } from '../config/org';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

// Soft white waves behind the login card.
function WaveBackground() {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 210 C 280 90 520 130 760 270 S 1190 430 1440 300 V0 H0 Z" fill="#fff" fillOpacity="0.55" />
      <path d="M0 330 C 240 230 470 250 700 360 S 1150 520 1440 420" fill="none" stroke="#fff" strokeWidth="3" strokeOpacity="0.9" />
      <path d="M0 120 C 330 40 600 60 860 170 S 1250 300 1440 180" fill="none" stroke="#fff" strokeWidth="2" strokeOpacity="0.8" />
      <path d="M0 650 C 280 560 540 600 790 720 S 1200 860 1440 760 V900 H0 Z" fill="#fff" fillOpacity="0.6" />
      <path d="M0 560 C 300 470 560 520 820 640 S 1230 800 1440 700" fill="none" stroke="#fff" strokeWidth="3" strokeOpacity="0.85" />
      <path d="M380 900 C 560 760 780 700 1040 760 S 1330 880 1440 860" fill="none" stroke="#fff" strokeWidth="2" strokeOpacity="0.7" />
    </svg>
  );
}

// Outlined input with the label sitting on the border and an icon on the left.
function OutlinedField({ label, icon: Icon, children, trailing }) {
  return (
    <label className="relative block">
      <span className="absolute -top-2.5 left-3 z-10 bg-white px-1 text-xs text-slate-500">
        {label}
        <span className="text-rose-500">*</span>
      </span>
      <div className="flex items-center rounded-lg border border-slate-300 bg-slate-50/60 transition focus-within:border-brand-600 focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-100">
        <Icon className="ml-3.5 h-5 w-5 shrink-0 text-slate-600" strokeWidth={2.2} />
        {children}
        {trailing}
      </div>
    </label>
  );
}

export default function Login() {
  const { login } = useAuth();
  const { tr, lang, setLang } = useLang();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState(''); // '' | 'forgot' | 'help' | 'contact' | 'about'

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(form.username, form.password);
      // back to the page the user asked for before being sent to /login
      const from = location.state?.from;
      navigate(from && from.startsWith('/') && !from.startsWith('/login') ? from : '/', { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const nextLang = LANGS.find((l) => l.code !== lang) || LANGS[0];
  const CurrentFlag = (LANGS.find((l) => l.code === lang) || LANGS[0]).Flag;
  const toggle = (p) => setPanel((cur) => (cur === p ? '' : p));

  const panels = {
    forgot: tr(
      'សូមទាក់ទងអ្នកគ្រប់គ្រងប្រព័ន្ធ ដើម្បីកំណត់ពាក្យសម្ងាត់ថ្មី។',
      'Please ask the system administrator to reset your password.',
    ),
    help: tr(
      'ប្រើឈ្មោះអ្នកប្រើ និងពាក្យសម្ងាត់ដែលអ្នកគ្រប់គ្រងបានផ្ដល់ឱ្យ។ បើបញ្ចូលពាក្យសម្ងាត់ខុសច្រើនដង គណនីនឹងត្រូវចាក់សោមួយរយៈ។',
      'Sign in with the username and password given by your administrator. Too many wrong passwords will lock the account for a while.',
    ),
    contact: (
      <>
        <div className="font-medium text-slate-700">{ORG.hospital}</div>
        <div>{ORG.department}</div>
        {ORG.phone && <div className="mt-1">☎ {ORG.phone}</div>}
      </>
    ),
    about: tr(
      'MedStock — ប្រព័ន្ធគ្រប់គ្រងស្តុក និងរបាយការណ៍ឱសថ។',
      'MedStock — medicine stock, usage and reporting system.',
    ),
  };

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200 p-4">
      <WaveBackground />

      <div className="relative w-full max-w-[480px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)]">
        <form onSubmit={submit} className="px-6 pt-6 pb-5 sm:px-6">
          {/* logo + language */}
          <div className="relative mb-7 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <Logo className="h-10 w-10 rounded-xl shadow-sm ring-1 ring-slate-200" />
              <Wordmark className="text-2xl" />
            </div>
            <button
              type="button"
              onClick={() => setLang(nextLang.code)}
              className="absolute right-0 rounded-[3px] transition hover:opacity-80"
              title={nextLang.label}
              aria-label={tr('ប្ដូរភាសា', 'Change language')}
            >
              <CurrentFlag className="h-[18px] w-6 rounded-[2px] shadow-sm ring-1 ring-slate-200" />
            </button>
          </div>

          {error && <div className="mb-5 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}

          <div className="space-y-6">
            <OutlinedField label={tr('ឈ្មោះអ្នកប្រើ', 'Username')} icon={User}>
              <input
                className="w-full bg-transparent px-3.5 py-3 text-base text-slate-900 outline-none"
                autoFocus
                autoComplete="username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                required
              />
            </OutlinedField>

            <OutlinedField
              label={tr('ពាក្យសម្ងាត់', 'Password')}
              icon={Lock}
              trailing={
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="mr-2 rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
                  aria-label={showPassword ? tr('លាក់ពាក្យសម្ងាត់', 'Hide password') : tr('បង្ហាញពាក្យសម្ងាត់', 'Show password')}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              }
            >
              <input
                type={showPassword ? 'text' : 'password'}
                className="w-full bg-transparent px-3.5 py-3 text-base text-slate-900 outline-none"
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </OutlinedField>
          </div>

          <div className="mt-4 mb-6 text-right">
            <button type="button" onClick={() => toggle('forgot')} className="text-sm text-slate-700 underline underline-offset-4 hover:text-brand-700">
              {tr('ភ្លេចពាក្យសម្ងាត់?', 'Forgot password?')}
            </button>
          </div>

          <button
            className="w-full rounded-lg bg-brand-600 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy}
          >
            {busy ? tr('កំពុងចូល...', 'Signing in...') : tr('ចូលប្រព័ន្ធ', 'Sign in')}
          </button>

          {panel && <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{panels[panel]}</div>}
        </form>

        {/* help / contact / about */}
        <div className="grid grid-cols-3 divide-x divide-slate-200 border-t border-slate-200 bg-slate-50/50 text-sm text-slate-600">
          {[
            ['help', CircleHelp, tr('ត្រូវការជំនួយ?', 'Need help?')],
            ['contact', Phone, tr('ទំនាក់ទំនង', 'Contact')],
            ['about', Info, tr('អំពីកម្មវិធី', 'About')],
          ].map(([key, Icon, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={`flex items-center justify-center gap-2 py-3 transition hover:bg-slate-100 hover:text-slate-900 ${panel === key ? 'text-brand-700' : ''}`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
