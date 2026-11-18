import { Lock, User } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errMsg } from '../api/client';
import Logo, { Wordmark } from '../components/Logo';
import { ORG } from '../config/org';
import { useAuth } from '../context/AuthContext';
import { useLang } from '../context/LangContext';

export default function Login() {
  const { login } = useAuth();
  const { tr, lang, setLang } = useLang();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(form.username, form.password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-gradient-to-br from-brand-600 via-brand-800 to-brand-950 p-4">
      <div className="w-full max-w-sm">
        <form onSubmit={submit} className="card space-y-4 p-6 shadow-2xl">
          <div className="border-b border-slate-100 pb-5 text-center">
            <Logo className="mx-auto mb-3 h-16 w-16 rounded-2xl shadow-lg shadow-brand-900/20 ring-1 ring-slate-200" />
            <h1>
              <Wordmark className="text-3xl" />
            </h1>
            <p className="mt-1 text-sm text-slate-600">{ORG.hospital}</p>
            <p className="text-sm text-slate-500">{ORG.department}</p>
          </div>
          <h2 className="text-lg font-semibold">{tr('ចូលប្រព័ន្ធ', 'Sign in')}</h2>
          {error && <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
          <label className="block">
            <span className="label">{tr('ឈ្មោះអ្នកប្រើ', 'Username')}</span>
            <div className="relative">
              <User className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input pl-9" autoFocus autoComplete="username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            </div>
          </label>
          <label className="block">
            <span className="label">{tr('ពាក្យសម្ងាត់', 'Password')}</span>
            <div className="relative">
              <Lock className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                className="input pl-9"
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
            </div>
          </label>
          <button className="btn-primary w-full py-2.5" disabled={busy}>
            {busy ? tr('កំពុងចូល...', 'Signing in...') : tr('ចូល', 'Sign in')}
          </button>
          <div className="text-center text-sm">
            <button type="button" className="text-slate-500 hover:text-slate-800" onClick={() => setLang(lang === 'km' ? 'en' : 'km')}>
              {lang === 'km' ? 'English' : 'ខ្មែរ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
