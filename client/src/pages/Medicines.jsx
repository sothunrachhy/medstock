import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import api, { errMsg } from '../api/client';
import { Badge, Empty, Field, Loading, Modal, PageHeader, Pagination, Tabs, usePaged } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import Select, { AutoComplete } from '../components/Select';
import { CATEGORY_COLORS, CATEGORY_LABELS, useLang } from '../context/LangContext';
import { useToast } from '../context/ToastContext';

const CATS = ['INJECTION', 'PILL', 'NARCOTIC'];
const FORMS = ['Amp', 'FL', 'គ្រាប់', 'Gel', 'Solution', 'Aerosol', 'Cream', 'Syrup'];

export default function Medicines() {
  const { tr } = useLang();
  const { can } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('INJECTION');
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = () => {
    setLoading(true);
    api
      .get('/medicines', { params: { active: 'all' } })
      .then((r) => setItems(r.data.items))
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((m) => m.category === category && (showInactive || m.isActive) && (!q || `${m.name} ${m.strength}`.toLowerCase().includes(q)));
  }, [items, category, search, showInactive]);
  const { pageRows, pager } = usePaged(rows, 10, [category, search, showInactive]);

  const remove = async (m) => {
    if (!window.confirm(tr(`លុប "${m.name}"? បើធ្លាប់មានស្តុក វានឹងត្រូវបិទ (មិនលុប)។`, `Delete "${m.name}"? If it has stock history it will be deactivated instead.`))) return;
    try {
      const { data } = await api.delete(`/medicines/${m._id}`);
      toast(data.deactivated ? tr('បានបិទ', 'Deactivated') : tr('បានលុប', 'Deleted'));
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div>
      <PageHeader
        title={tr('បញ្ជីឱសថ', 'Medicine list')}
        subtitle={tr('គ្រប់គ្រងឈ្មោះ ប្រភេទ កម្រិត និងកម្រិតស្តុកអប្បបរមា', 'Manage names, forms, strengths and minimum stock levels')}
        actions={
          can('medicines', 'create') && (
            <button className="btn-primary" onClick={() => setEditing({ category })}>
              <Plus className="h-4 w-4" /> {tr('បន្ថែមឱសថ', 'Add medicine')}
            </button>
          )
        }
      />
      <Tabs value={category} onChange={setCategory} tabs={CATS.map((c) => ({ value: c, label: tr(...CATEGORY_LABELS[c]), count: items.filter((m) => m.category === c && m.isActive).length }))} />
      <div className="card">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder={tr('ស្វែងរក...', 'Search...')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            {tr('បង្ហាញឱសថដែលបានបិទ', 'Show inactive')}
          </label>
        </div>
        {loading ? (
          <Loading />
        ) : !rows.length ? (
          <Empty />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-16">{tr('ល.រ', 'No.')}</th>
                  <th>{tr('ឈ្មោះឱសថ', 'Name')}</th>
                  <th>{tr('ប្រភេទ', 'Form')}</th>
                  <th>{tr('កម្រិត', 'Strength')}</th>
                  <th className="text-right">{tr('ស្តុកអប្បបរមា', 'Min stock')}</th>
                  <th>{tr('ស្ថានភាព', 'Status')}</th>
                  <th className="w-24"></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((m) => (
                  <tr key={m._id}>
                    <td className="text-slate-400 tabular-nums">{m.order}</td>
                    <td className="font-medium">{m.name}</td>
                    <td>{m.form}</td>
                    <td>{m.strength}</td>
                    <td className="text-right tabular-nums">{m.minStock}</td>
                    <td>{m.isActive ? <Badge color="green">{tr('សកម្ម', 'Active')}</Badge> : <Badge>{tr('បានបិទ', 'Inactive')}</Badge>}</td>
                    <td className="text-right whitespace-nowrap">
                      {can('medicines', 'update') && (
                        <button className="btn-icon" onClick={() => setEditing(m)} title={tr('កែប្រែ', 'Edit')}>
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {can('medicines', 'delete') && m.isActive && (
                        <button className="btn-icon hover:text-rose-600" onClick={() => remove(m)} title={tr('លុប', 'Delete')}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination {...pager} />
          </div>
        )}
      </div>
      <MedicineForm medicine={editing} onClose={() => setEditing(null)} onSaved={load} />
    </div>
  );
}

function MedicineForm({ medicine, onClose, onSaved }) {
  const { tr } = useLang();
  const toast = useToast();
  const [form, setForm] = useState({});
  const isNew = !medicine?._id;

  useEffect(() => {
    if (medicine) setForm({ name: '', form: medicine.category === 'PILL' ? 'គ្រាប់' : 'Amp', strength: '', minStock: 10, order: '', note: '', isActive: true, ...medicine });
  }, [medicine]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const body = { ...form, minStock: Number(form.minStock) || 0, order: form.order === '' ? undefined : Number(form.order) };
    try {
      if (isNew) await api.post('/medicines', body);
      else await api.put(`/medicines/${medicine._id}`, body);
      toast(tr('បានរក្សាទុក', 'Saved'));
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <Modal
      open={!!medicine}
      onClose={onClose}
      title={isNew ? tr('បន្ថែមឱសថ', 'Add medicine') : tr('កែប្រែឱសថ', 'Edit medicine')}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {tr('បោះបង់', 'Cancel')}
          </button>
          <button className="btn-primary" form="med-form">
            {tr('រក្សាទុក', 'Save')}
          </button>
        </>
      }
    >
      <form id="med-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-6">
        <Field label={tr('ឈ្មោះឱសថ', 'Name')} required className="sm:col-span-4">
          <input className="input" value={form.name || ''} onChange={set('name')} required autoFocus />
        </Field>
        <Field label={tr('ប្រភេទឱសថ', 'Category')} required className="sm:col-span-2">
          <Select
            value={form.category || ''}
            onChange={(v) => setForm((f) => ({ ...f, category: v }))}
            menuWidth={240}
            options={CATS.map((c) => ({ value: c, label: tr(...CATEGORY_LABELS[c]), dot: CATEGORY_COLORS[c] }))}
          />
        </Field>
        <Field label={tr('ទម្រង់', 'Form')} className="sm:col-span-2">
          <AutoComplete value={form.form || ''} onChange={(v) => setForm((f) => ({ ...f, form: v }))} suggestions={FORMS} />
        </Field>
        <Field label={tr('កម្រិត', 'Strength')} className="sm:col-span-2">
          <input className="input" value={form.strength || ''} onChange={set('strength')} placeholder="500mg" />
        </Field>
        <Field label={tr('ស្តុកអប្បបរមា', 'Min stock')} className="sm:col-span-1">
          <input type="number" min="0" className="input" value={form.minStock ?? ''} onChange={set('minStock')} />
        </Field>
        <Field label={tr('ល.រ', 'Order')} className="sm:col-span-1">
          <input type="number" min="0" className="input" value={form.order ?? ''} onChange={set('order')} placeholder="auto" />
        </Field>
        <Field label={tr('កំណត់សម្គាល់', 'Note')} className="sm:col-span-6">
          <input className="input" value={form.note || ''} onChange={set('note')} />
        </Field>
        {!isNew && (
          <label className="flex items-center gap-2 text-sm sm:col-span-6">
            <input type="checkbox" checked={!!form.isActive} onChange={set('isActive')} /> {tr('សកម្ម (បង្ហាញក្នុងបញ្ជី)', 'Active (shown in lists)')}
          </label>
        )}
      </form>
    </Modal>
  );
}
