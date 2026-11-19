import { useState } from 'react';
import api, { errMsg, tokenStore } from '@/lib/api';
import { Badge, Field } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { ACTION_LABELS, MODULE_LABELS, useLang } from '@/app/LangContext';
import { useToast } from '@/app/ToastContext';
import usePasswordPolicy from '@/features/auth/usePasswordPolicy';
import { checkForm, serverFieldErrors, useFieldErrors } from '@/lib/validation';
import { changePasswordSchema, MAX } from '@shared/schemas/index.js';

export default function Account() {
  const { tr } = useLang();
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const { errors, setErrors } = useFieldErrors();
  const { minPasswordLength } = usePasswordPolicy();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const check = checkForm(changePasswordSchema, form);
    setErrors(check.errors);
    if (!check.ok) return toast.error(check.message);
    if (form.newPassword !== form.confirm) {
      setErrors({ confirm: tr('ពាក្យសម្ងាត់ថ្មីមិនដូចគ្នា', 'New passwords do not match') });
      return toast.error(tr('ពាក្យសម្ងាត់ថ្មីមិនដូចគ្នា', 'New passwords do not match'));
    }
    setBusy(true);
    try {
      const { data } = await api.post('/auth/change-password', form);
      // other devices are signed out; keep this one signed in with the new token
      if (data?.token) tokenStore.set(data.token);
      toast(tr('បានប្តូរពាក្យសម្ងាត់', 'Password changed'));
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setErrors(serverFieldErrors(err));
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="card p-5">
        <h3 className="mb-4 font-semibold">{tr('ព័ត៌មានគណនី', 'Account')}</h3>
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-slate-500">{tr('ឈ្មោះពេញ', 'Full name')}</dt>
            <dd className="font-medium">{user.fullName}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{tr('ឈ្មោះអ្នកប្រើ', 'Username')}</dt>
            <dd className="font-medium">@{user.username}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{tr('តួនាទី', 'Role')}</dt>
            <dd className="font-medium">{user.role?.name}</dd>
          </div>
          <div>
            <dt className="mb-1 text-slate-500">{tr('សិទ្ធិ', 'Permissions')}</dt>
            <dd className="flex flex-wrap gap-1">
              {user.role?.isSystem ? (
                <Badge color="violet">{tr('សិទ្ធិពេញលេញ', 'Full access')}</Badge>
              ) : (
                user.role?.permissions?.map((p) => (
                  <Badge key={p.module}>
                    {tr(...MODULE_LABELS[p.module])}: {p.actions.map((a) => tr(...ACTION_LABELS[a])).join('/')}
                  </Badge>
                ))
              )}
            </dd>
          </div>
        </dl>
      </div>
      <form onSubmit={submit} className="card space-y-4 p-5">
        <h3 className="font-semibold">{tr('ប្តូរពាក្យសម្ងាត់', 'Change password')}</h3>
        <Field label={tr('ពាក្យសម្ងាត់បច្ចុប្បន្ន', 'Current password')} required error={errors.currentPassword}>
          <input type="password" className="input" value={form.currentPassword} onChange={set('currentPassword')} required maxLength={MAX.password} autoComplete="current-password" />
        </Field>
        <Field label={tr('ពាក្យសម្ងាត់ថ្មី', 'New password')} required error={errors.newPassword} hint={tr(`យ៉ាងតិច ${minPasswordLength} តួ`, `At least ${minPasswordLength} characters`)}>
          <input type="password" className="input" value={form.newPassword} onChange={set('newPassword')} required minLength={minPasswordLength} maxLength={MAX.password} autoComplete="new-password" />
        </Field>
        <Field label={tr('បញ្ជាក់ពាក្យសម្ងាត់ថ្មី', 'Confirm new password')} required error={errors.confirm}>
          <input type="password" className="input" value={form.confirm} onChange={set('confirm')} required minLength={minPasswordLength} autoComplete="new-password" />
        </Field>
        <button className="btn-primary" disabled={busy}>
          {tr('ប្តូរពាក្យសម្ងាត់', 'Change password')}
        </button>
      </form>
    </div>
  );
}
