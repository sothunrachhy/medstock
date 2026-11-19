import { Clock, KeyRound, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import api, { errMsg } from '@/lib/api';
import { Field, Loading } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { useLang } from '@/app/LangContext';
import { useToast } from '@/app/ToastContext';

function Section({ icon: Icon, title, desc, children }) {
  return (
    <div className="card p-5">
      <div className="mb-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-slate-500">{desc}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

/** Settings → Auth: session timeout, password length and account lockout. */
export default function AuthSettings() {
  const { tr } = useLang();
  const { can } = useAuth();
  const toast = useToast();
  const editable = can('authSettings', 'update');
  const [saved, setSaved] = useState(null);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get('/auth/settings')
      .then((r) => {
        setSaved(r.data);
        setForm(r.data);
      })
      .catch((e) => toast.error(errMsg(e)));
  }, [toast]);

  if (!form) return <Loading />;

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const dirty = Object.keys(saved).some((k) => String(saved[k]) !== String(form[k]));
  const lockOff = Number(form.maxFailedAttempts) === 0;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, Number(v)]));
      const { data } = await api.put('/auth/settings', body);
      setSaved(data);
      setForm(data);
      toast(tr('បានរក្សាទុកការកំណត់', 'Settings saved'));
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-3xl space-y-4">
      <fieldset disabled={!editable} className="space-y-4">
        <Section
          icon={Clock}
          title={tr('រយៈពេលនៃការចូលប្រព័ន្ធ', 'Session timeout')}
          desc={tr('ក្រោយរយៈពេលនេះ អ្នកប្រើត្រូវចូលប្រព័ន្ធម្តងទៀត។ ការបន្ថយតម្លៃនេះ នឹងបញ្ចប់ session ដែលចាស់ជាងនេះភ្លាមៗ។', 'Users must sign in again after this long. Lowering it also ends sessions older than the new limit right away.')}
        >
          <Field label={tr('ម៉ោង', 'Hours')} hint={tr('១ ដល់ ៧២០ ម៉ោង (៣០ ថ្ងៃ)', '1 to 720 hours (30 days)')}>
            <input type="number" min="1" max="720" className="input" value={form.sessionTimeoutHours} onChange={set('sessionTimeoutHours')} required />
          </Field>
        </Section>

        <Section icon={KeyRound} title={tr('ពាក្យសម្ងាត់', 'Passwords')} desc={tr('អនុវត្តពេលបង្កើតអ្នកប្រើ ឬប្តូរពាក្យសម្ងាត់', 'Applies when creating users and changing passwords')}>
          <Field label={tr('ប្រវែងអប្បបរមា (តួអក្សរ)', 'Minimum length (characters)')} hint={tr('៤ ដល់ ៦៤', '4 to 64')}>
            <input type="number" min="4" max="64" className="input" value={form.minPasswordLength} onChange={set('minPasswordLength')} required />
          </Field>
        </Section>

        <Section
          icon={ShieldAlert}
          title={tr('ចាក់សោគណនី', 'Account lockout')}
          desc={tr('ចាក់សោគណនីបណ្តោះអាសន្ន ពេលបញ្ចូលពាក្យសម្ងាត់ខុសច្រើនដងជាប់គ្នា។ អ្នកគ្រប់គ្រងអាចដោះសោនៅផ្ទាំង អ្នកប្រើប្រាស់។', 'Temporarily lock an account after repeated wrong passwords. An administrator can unlock it from the Users tab.')}
        >
          <Field label={tr('ចំនួនដងខុសអតិបរមា', 'Failed attempts before lock')} hint={tr('០ = មិនចាក់សោ', '0 = never lock')}>
            <input type="number" min="0" max="50" className="input" value={form.maxFailedAttempts} onChange={set('maxFailedAttempts')} required />
          </Field>
          <Field label={tr('រយៈពេលចាក់សោ (នាទី)', 'Lock duration (minutes)')} hint={tr('១ ដល់ ១៤៤០', '1 to 1440')}>
            <input type="number" min="1" max="1440" className="input" value={form.lockoutMinutes} onChange={set('lockoutMinutes')} required disabled={lockOff} />
          </Field>
        </Section>
      </fieldset>

      {editable && (
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" disabled={!dirty || busy} onClick={() => setForm(saved)}>
            {tr('បោះបង់', 'Reset')}
          </button>
          <button className="btn-primary" disabled={!dirty || busy}>
            {tr('រក្សាទុក', 'Save')}
          </button>
        </div>
      )}
    </form>
  );
}
