import { Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import api, { errMsg } from '@/lib/api';
import { Badge, Field, Loading, Modal } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { ACTION_LABELS, MODULE_LABELS, useLang } from '@/app/LangContext';
import { useToast } from '@/app/ToastContext';
import { checkForm, serverFieldErrors, useFieldErrors } from '@/lib/validation';
import { MAX, roleSchema } from '@shared/schemas/index.js';

const MODULES = Object.keys(MODULE_LABELS);
const ACTIONS = Object.keys(ACTION_LABELS);

export default function Roles() {
  const { tr } = useLang();
  const { can } = useAuth();
  const toast = useToast();
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = () => {
    setLoading(true);
    api
      .get('/roles')
      .then((r) => setRoles(r.data.items))
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (r) => {
    if (!window.confirm(tr(`លុបតួនាទី "${r.name}"?`, `Delete role "${r.name}"?`))) return;
    try {
      await api.delete(`/roles/${r._id}`);
      toast(tr('បានលុប', 'Deleted'));
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  if (loading) return <Loading />;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{tr('កំណត់ថាតួនាទីនីមួយៗអាច មើល បង្កើត កែប្រែ ឬលុប ផ្នែកណាខ្លះ', 'Choose which sections each role can read, create, update or delete')}</p>
        {can('roles', 'create') && (
          <button className="btn-primary" onClick={() => setEditing({ name: '', description: '', permissions: [] })}>
            <Plus className="h-4 w-4" /> {tr('បន្ថែមតួនាទី', 'Add role')}
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((r) => (
          <div key={r._id} className="card p-4">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 font-semibold">
                  {r.name} {r.isSystem && <Lock className="h-3.5 w-3.5 text-slate-400" />}
                </div>
                <div className="text-sm text-slate-500">{r.description}</div>
              </div>
              <div className="flex shrink-0">
                {!r.isSystem && can('roles', 'update') && (
                  <button className="btn-icon" onClick={() => setEditing(r)} title={tr('កែប្រែ', 'Edit')}>
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                {!r.isSystem && can('roles', 'delete') && (
                  <button className="btn-icon hover:text-rose-600" onClick={() => remove(r)} title={tr('លុប', 'Delete')}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="mb-3 text-xs text-slate-500">
              {r.userCount} {tr('អ្នកប្រើ', 'user(s)')}
            </div>
            <div className="flex flex-wrap gap-1">
              {r.isSystem ? (
                <Badge color="violet">{tr('សិទ្ធិពេញលេញ', 'Full access')}</Badge>
              ) : (
                r.permissions.map((p) => (
                  <Badge key={p.module} color="slate">
                    {tr(...MODULE_LABELS[p.module])}: {p.actions.map((a) => tr(...ACTION_LABELS[a])).join('/')}
                  </Badge>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
      <RoleForm role={editing} onClose={() => setEditing(null)} onSaved={load} />
    </div>
  );
}

function RoleForm({ role, onClose, onSaved }) {
  const { tr } = useLang();
  const toast = useToast();
  const [name, setName] = useState('');
  const { errors, setErrors } = useFieldErrors();
  const [description, setDescription] = useState('');
  const [perm, setPerm] = useState({}); // module -> Set(actions)

  useEffect(() => {
    if (!role) return;
    setName(role.name);
    setDescription(role.description || '');
    setPerm(Object.fromEntries((role.permissions || []).map((p) => [p.module, new Set(p.actions)])));
  }, [role]);

  const has = (m, a) => perm[m]?.has(a);
  const toggle = (m, a) =>
    setPerm((p) => {
      const s = new Set(p[m] || []);
      if (s.has(a)) {
        s.delete(a);
        if (a === 'read') s.clear(); // no other action makes sense without read
      } else {
        s.add(a);
        s.add('read');
      }
      return { ...p, [m]: s };
    });
  const toggleRow = (m) => setPerm((p) => ({ ...p, [m]: ACTIONS.every((a) => p[m]?.has(a)) ? new Set() : new Set(ACTIONS) }));

  const submit = async (e) => {
    e.preventDefault();
    const permissions = Object.entries(perm)
      .map(([module, s]) => ({ module, actions: [...s] }))
      .filter((p) => p.actions.length);
    const check = checkForm(roleSchema, { name, description, permissions });
    setErrors(check.errors);
    if (!check.ok) return toast.error(check.message);
    try {
      if (role._id) await api.put(`/roles/${role._id}`, { name, description, permissions });
      else await api.post('/roles', { name, description, permissions });
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
      open={!!role}
      onClose={onClose}
      size="lg"
      title={role?._id ? tr('កែប្រែតួនាទី', 'Edit role') : tr('បន្ថែមតួនាទី', 'Add role')}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {tr('បោះបង់', 'Cancel')}
          </button>
          <button className="btn-primary" form="role-form">
            {tr('រក្សាទុក', 'Save')}
          </button>
        </>
      }
    >
      <form id="role-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={tr('ឈ្មោះតួនាទី', 'Role name')} required error={errors.name}>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={MAX.short} autoFocus />
          </Field>
          <Field label={tr('ការពិពណ៌នា', 'Description')} error={errors.description}>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={MAX.text} />
          </Field>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="table">
            <thead>
              <tr>
                <th>{tr('ផ្នែក', 'Section')}</th>
                {ACTIONS.map((a) => (
                  <th key={a} className="text-center">
                    {tr(...ACTION_LABELS[a])}
                  </th>
                ))}
                <th className="text-center">{tr('ទាំងអស់', 'All')}</th>
              </tr>
            </thead>
            <tbody>
              {MODULES.map((m) => (
                <tr key={m}>
                  <td className="font-medium">{tr(...MODULE_LABELS[m])}</td>
                  {ACTIONS.map((a) => (
                    <td key={a} className="text-center">
                      <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={!!has(m, a)} onChange={() => toggle(m, a)} aria-label={`${m} ${a}`} />
                    </td>
                  ))}
                  <td className="text-center">
                    <input type="checkbox" className="h-4 w-4" checked={ACTIONS.every((a) => has(m, a))} onChange={() => toggleRow(m)} aria-label={`${m} all`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </form>
    </Modal>
  );
}
