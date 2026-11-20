import { LockOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import api, { errMsg } from '@/lib/api';
import Select from '@/components/ui/Select';
import { Badge, Empty, Field, Loading, Modal } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { useLang } from '@/app/LangContext';
import { useToast } from '@/app/ToastContext';
import usePasswordPolicy from '@/features/auth/usePasswordPolicy';
import { fmtDateTime } from '@/lib/dates';
import { checkForm, serverFieldErrors, useFieldErrors } from '@/lib/validation';
import { MAX, userCreateSchema, userUpdateSchema } from '@shared/schemas/index.js';

export default function Users() {
  const { tr } = useLang();
  const { can, user: me } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([api.get('/users'), api.get('/users/role-options')]);
      setUsers(u.data.items);
      setRoles(r.data.items);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const unlock = async (u) => {
    try {
      await api.put(`/users/${u.id}`, { unlock: true });
      toast(tr('បានដោះសោគណនី', 'Account unlocked'));
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const remove = async (u) => {
    if (!window.confirm(tr(`លុបអ្នកប្រើ "${u.username}"?`, `Delete user "${u.username}"?`))) return;
    try {
      await api.delete(`/users/${u.id}`);
      toast(tr('បានលុប', 'Deleted'));
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <div className="text-sm text-slate-500">{tr('គណនីដែលអាចចូលប្រើប្រព័ន្ធ', 'Accounts that can sign in')}</div>
        {can('users', 'create') && (
          <button className="btn-primary" onClick={() => setEditing({})}>
            <Plus className="h-4 w-4" /> {tr('បន្ថែមអ្នកប្រើ', 'Add user')}
          </button>
        )}
      </div>
      {loading ? (
        <Loading />
      ) : !users.length ? (
        <Empty />
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>{tr('ឈ្មោះពេញ', 'Full name')}</th>
                <th>{tr('ឈ្មោះអ្នកប្រើ', 'Username')}</th>
                <th>{tr('តួនាទី', 'Role')}</th>
                <th>{tr('ស្ថានភាព', 'Status')}</th>
                <th>{tr('ចូលចុងក្រោយ', 'Last login')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-medium">
                    {u.fullName} {u.id === me.id && <Badge color="blue">{tr('អ្នក', 'You')}</Badge>}
                  </td>
                  <td>@{u.username}</td>
                  <td>{u.role?.name}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {u.isActive ? <Badge color="green">{tr('សកម្ម', 'Active')}</Badge> : <Badge color="red">{tr('បានបិទ', 'Disabled')}</Badge>}
                      {u.lockedUntil && (
                        <span title={`${tr('ដល់', 'Until')} ${fmtDateTime(u.lockedUntil)}`}>
                          <Badge color="amber">{tr('ជាប់សោ', 'Locked')}</Badge>
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-sm text-slate-500">{fmtDateTime(u.lastLoginAt) || '—'}</td>
                  <td className="text-right whitespace-nowrap">
                    {can('users', 'update') && u.lockedUntil && (
                      <button className="btn-icon hover:text-amber-600" onClick={() => unlock(u)} title={tr('ដោះសោ', 'Unlock')}>
                        <LockOpen className="h-4 w-4" />
                      </button>
                    )}
                    {can('users', 'update') && (
                      <button className="btn-icon" onClick={() => setEditing(u)} title={tr('កែប្រែ', 'Edit')}>
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {can('users', 'delete') && u.id !== me.id && (
                      <button className="btn-icon hover:text-rose-600" onClick={() => remove(u)} title={tr('លុប', 'Delete')}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <UserForm user={editing} roles={roles} onClose={() => setEditing(null)} onSaved={load} isSelf={editing?.id === me.id} />
    </div>
  );
}

function UserForm({ user, roles, onClose, onSaved, isSelf }) {
  const { tr } = useLang();
  const toast = useToast();
  const [form, setForm] = useState({});
  const { minPasswordLength } = usePasswordPolicy();
  const isNew = !user?.id;
  const { errors, setErrors } = useFieldErrors();

  useEffect(() => {
    setErrors({});
    if (user) setForm({ fullName: user.fullName || '', username: user.username || '', role: user.role?.id || roles.find((r) => !r.isSystem)?._id || '', isActive: user.isActive ?? true, password: '' });
  }, [user, roles, setErrors]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const body = { ...form };
    if (!body.password) delete body.password;
    const check = checkForm(isNew ? userCreateSchema : userUpdateSchema, body);
    setErrors(check.errors);
    if (!check.ok) return toast.error(check.message);
    try {
      if (isNew) await api.post('/users', body);
      else await api.put(`/users/${user.id}`, body);
      toast(tr('បានរក្សាទុក', 'Saved'));
      onSaved();
      onClose();
    } catch (err) {
      setErrors(serverFieldErrors(err));
      toast.error(errMsg(err));
    }
  };

  return (
    <Modal
      open={!!user}
      onClose={onClose}
      size="sm"
      title={isNew ? tr('បន្ថែមអ្នកប្រើ', 'Add user') : tr('កែប្រែអ្នកប្រើ', 'Edit user')}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {tr('បោះបង់', 'Cancel')}
          </button>
          <button className="btn-primary" form="user-form">
            {tr('រក្សាទុក', 'Save')}
          </button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="space-y-4">
        <Field label={tr('ឈ្មោះពេញ', 'Full name')} required error={errors.fullName}>
          <input className="input" value={form.fullName || ''} onChange={set('fullName')} required maxLength={MAX.name} autoFocus />
        </Field>
        <Field label={tr('ឈ្មោះអ្នកប្រើ (សម្រាប់ចូល)', 'Username (for login)')} required error={errors.username}>
          <input className="input" value={form.username || ''} onChange={set('username')} required minLength={3} maxLength={50} pattern="[A-Za-z0-9._\-]+" autoComplete="off" />
        </Field>
        <Field label={tr('តួនាទី', 'Role')} required error={errors.role}>
          <Select
            value={form.role || ''}
            onChange={(v) => setForm((f) => ({ ...f, role: v }))}
            disabled={isSelf}
            placeholder={tr('ជ្រើសរើសតួនាទី', 'Choose a role')}
            options={roles.map((r) => ({ value: r._id, label: r.name, hint: r.isSystem ? tr('សិទ្ធិពេញលេញ', 'Full access') : undefined }))}
          />
        </Field>
        <Field
          label={isNew ? tr('ពាក្យសម្ងាត់', 'Password') : tr('ពាក្យសម្ងាត់ថ្មី', 'New password')}
          required={isNew}
          error={errors.password}
          hint={
            isNew
              ? tr(`យ៉ាងតិច ${minPasswordLength} តួ`, `At least ${minPasswordLength} characters`)
              : tr('ទុកទទេ បើមិនប្តូរ (ការកំណត់ពាក្យសម្ងាត់ថ្មី នឹងដោះសោគណនីផងដែរ)', 'Leave empty to keep the current one (setting a new password also unlocks the account)')
          }
        >
          <input type="password" className="input" value={form.password || ''} onChange={set('password')} required={isNew} minLength={minPasswordLength} maxLength={MAX.password} autoComplete="new-password" />
        </Field>
        {!isNew && !isSelf && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!form.isActive} onChange={set('isActive')} /> {tr('អនុញ្ញាតឱ្យចូលប្រព័ន្ធ', 'Account active (can sign in)')}
          </label>
        )}
      </form>
    </Modal>
  );
}
