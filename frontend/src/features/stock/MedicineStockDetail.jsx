import { Ban, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import api, { errMsg } from '@/lib/api';
import { medLabel } from '@/components/pickers';
import Select from '@/components/ui/Select';
import { Badge, Empty, Field, Loading, Modal, Tabs } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { CATEGORY_LABELS, OUT_TYPE_LABELS, useLang } from '@/app/LangContext';
import { useToast } from '@/app/ToastContext';
import { daysUntil, fmtDate, toDayStr, todayStr } from '@/lib/dates';
import { checkForm, serverFieldErrors, useFieldErrors } from '@/lib/validation';
import { batchUpdateSchema, MAX, writeOffSchema } from '@shared/schemas/index.js';

export function ExpiryBadge({ date, warnDays = 90 }) {
  const { tr } = useLang();
  if (!date) return null;
  const d = daysUntil(date);
  if (d < 0) return <Badge color="red">{tr('ផុតកំណត់', 'Expired')}</Badge>;
  if (d <= warnDays) return <Badge color="amber">{tr(`នៅ ${d} ថ្ងៃ`, `${d} days left`)}</Badge>;
  return null;
}

/** Batches + movement history of one medicine, with edit / delete / write-off. */
export default function MedicineStockDetail({ medicine, onClose, onChanged, onAddStock }) {
  const { tr } = useLang();
  const { can } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('batches');
  const [batches, setBatches] = useState([]);
  const [moves, setMoves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [writeOff, setWriteOff] = useState(null);

  const load = useCallback(async () => {
    if (!medicine) return;
    setLoading(true);
    try {
      const [b, m] = await Promise.all([
        api.get('/stock/batches', { params: { medicine: medicine._id, limit: 500 } }),
        api.get('/stock/movements', { params: { medicine: medicine._id, limit: 200 } }),
      ]);
      setBatches(b.data.items);
      setMoves(m.data.items);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [medicine, toast]);
  useEffect(() => {
    setTab('batches');
    load();
  }, [load]);

  const changed = () => {
    load();
    onChanged?.();
  };

  const removeBatch = async (b) => {
    if (!window.confirm(tr('លុបឡូត៍នេះ?', 'Delete this batch?'))) return;
    try {
      await api.delete(`/stock/batches/${b._id}`);
      toast(tr('បានលុប', 'Deleted'));
      changed();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  if (!medicine) return null;
  return (
    <Modal open={!!medicine} onClose={onClose} size="xl" title={`${medLabel(medicine)} ${medicine.form ? `(${medicine.form})` : ''}`}>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          [tr('ប្រភេទ', 'Type'), tr(...CATEGORY_LABELS[medicine.category])],
          [tr('ចំនួនសល់', 'Balance'), medicine.balance],
          [tr('អាចប្រើបាន', 'Usable'), medicine.usable],
          [tr('ផុតកំណត់', 'Expired qty'), medicine.expiredQty],
          [tr('កម្រិតអប្បបរមា', 'Minimum'), medicine.minStock],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg bg-slate-50 px-3 py-2">
            <div className="text-xs text-slate-500">{k}</div>
            <div className="font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'batches', label: tr('ឡូត៍ស្តុក', 'Batches'), count: batches.length },
            { value: 'moves', label: tr('ចលនាស្តុក', 'Movements') },
          ]}
        />
        {can('stock', 'create') && (
          <button className="btn-secondary mb-4" onClick={() => onAddStock(medicine)}>
            <Plus className="h-4 w-4" /> {tr('បញ្ចូលស្តុក', 'Add stock')}
          </button>
        )}
      </div>

      {loading ? (
        <Loading />
      ) : tab === 'batches' ? (
        batches.length ? (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{tr('ថ្ងៃបញ្ចូល', 'Input date')}</th>
                  <th>{tr('លេខឡូត៍', 'Batch')}</th>
                  <th>{tr('ថ្ងៃផុតកំណត់', 'Expiry')}</th>
                  <th className="text-right">{tr('ចំនួនបញ្ចូល', 'Received')}</th>
                  <th className="text-right">{tr('នៅសល់', 'Remaining')}</th>
                  <th>{tr('ប្រភព', 'Source')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b._id} className={b.remaining === 0 ? 'text-slate-400' : ''}>
                    <td className="tabular-nums">{fmtDate(b.receivedDate)}</td>
                    <td>{b.batchNo}</td>
                    <td>
                      <span className="mr-2 tabular-nums">{fmtDate(b.expiryDate)}</span>
                      {b.remaining > 0 && <ExpiryBadge date={b.expiryDate} />}
                    </td>
                    <td className="text-right tabular-nums">{b.quantity}</td>
                    <td className="text-right font-semibold tabular-nums">{b.remaining}</td>
                    <td className="text-xs">
                      {b.source}
                      <div className="text-slate-400">{b.createdBy?.fullName}</div>
                    </td>
                    <td className="text-right whitespace-nowrap">
                      {can('stock', 'update') && b.remaining > 0 && (
                        <button className="btn-icon hover:text-amber-600" title={tr('កាត់ចេញ (ផុតកំណត់/ខូច)', 'Write off')} onClick={() => setWriteOff(b)}>
                          <Ban className="h-4 w-4" />
                        </button>
                      )}
                      {can('stock', 'update') && (
                        <button className="btn-icon" title={tr('កែប្រែ', 'Edit')} onClick={() => setEditing(b)}>
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {can('stock', 'delete') && b.remaining === b.quantity && (
                        <button className="btn-icon hover:text-rose-600" title={tr('លុប', 'Delete')} onClick={() => removeBatch(b)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty />
        )
      ) : moves.length ? (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>{tr('កាលបរិច្ឆេទ', 'Date')}</th>
                <th>{tr('ប្រភេទ', 'Type')}</th>
                <th className="text-right">{tr('ចំនួន', 'Qty')}</th>
                <th>{tr('ព័ត៌មាន', 'Detail')}</th>
                <th>{tr('ដោយ', 'By')}</th>
              </tr>
            </thead>
            <tbody>
              {moves.map((m) => (
                <tr key={m._id}>
                  <td className="tabular-nums">{fmtDate(m.date)}</td>
                  <td>
                    <Badge color={m.kind === 'IN' ? 'green' : m.kind === 'USAGE' ? 'blue' : 'amber'}>{tr(...OUT_TYPE_LABELS[m.kind])}</Badge>
                  </td>
                  <td className={`text-right font-semibold tabular-nums ${m.quantity > 0 ? 'text-emerald-700' : 'text-slate-700'}`}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </td>
                  <td>{m.detail}</td>
                  <td className="text-xs text-slate-500">{m.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty />
      )}

      <BatchEdit batch={editing} onClose={() => setEditing(null)} onSaved={changed} />
      <WriteOff batch={writeOff} onClose={() => setWriteOff(null)} onSaved={changed} />
    </Modal>
  );
}

function BatchEdit({ batch, onClose, onSaved }) {
  const { tr } = useLang();
  const toast = useToast();
  const [form, setForm] = useState({});
  const { errors, setErrors } = useFieldErrors();
  useEffect(() => {
    setErrors({});
    if (batch) setForm({ quantity: batch.quantity, receivedDate: toDayStr(batch.receivedDate), expiryDate: toDayStr(batch.expiryDate), batchNo: batch.batchNo, source: batch.source, note: batch.note });
  }, [batch, setErrors]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    const body = { ...form, quantity: Number(form.quantity) };
    const check = checkForm(batchUpdateSchema, body);
    setErrors(check.errors);
    if (!check.ok) return toast.error(check.message);
    try {
      await api.put(`/stock/batches/${batch._id}`, body);
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
      open={!!batch}
      onClose={onClose}
      size="sm"
      title={tr('កែប្រែឡូត៍', 'Edit batch')}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {tr('បោះបង់', 'Cancel')}
          </button>
          <button className="btn-primary" form="batch-form">
            {tr('រក្សាទុក', 'Save')}
          </button>
        </>
      }
    >
      <form id="batch-form" onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label={tr('ចំនួនបញ្ចូល', 'Quantity')} className="col-span-2" error={errors.quantity} hint={batch && `${tr('បានប្រើ', 'Already used')}: ${batch.quantity - batch.remaining}`}>
          <input type="number" min="1" className="input" value={form.quantity ?? ''} onChange={set('quantity')} required />
        </Field>
        <Field label={tr('ថ្ងៃបញ្ចូល', 'Input date')} error={errors.receivedDate}>
          <input type="date" className="input" value={form.receivedDate || ''} onChange={set('receivedDate')} required />
        </Field>
        <Field label={tr('ថ្ងៃផុតកំណត់', 'Expiry')} error={errors.expiryDate}>
          <input type="date" className="input" value={form.expiryDate || ''} onChange={set('expiryDate')} required />
        </Field>
        <Field label={tr('លេខឡូត៍', 'Batch no.')} error={errors.batchNo}>
          <input className="input" value={form.batchNo || ''} onChange={set('batchNo')} maxLength={MAX.code} />
        </Field>
        <Field label={tr('ប្រភព', 'Source')} error={errors.source}>
          <input className="input" value={form.source || ''} onChange={set('source')} maxLength={MAX.label} />
        </Field>
      </form>
    </Modal>
  );
}

function WriteOff({ batch, onClose, onSaved }) {
  const { tr } = useLang();
  const toast = useToast();
  const [form, setForm] = useState({});
  const { errors, setErrors } = useFieldErrors();
  useEffect(() => {
    setErrors({});
    if (batch) setForm({ quantity: batch.remaining, type: daysUntil(batch.expiryDate) < 0 ? 'EXPIRED' : 'DAMAGED', date: todayStr(), note: '' });
  }, [batch, setErrors]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    const body = { ...form, batch: batch._id, quantity: Number(form.quantity) };
    const check = checkForm(writeOffSchema, body);
    setErrors(check.errors);
    if (!check.ok) return toast.error(check.message);
    try {
      await api.post('/stock/writeoff', body);
      toast(tr('បានកាត់ចេញពីស្តុក', 'Written off'));
      onSaved();
      onClose();
    } catch (err) {
      setErrors(serverFieldErrors(err));
      toast.error(errMsg(err));
    }
  };
  return (
    <Modal
      open={!!batch}
      onClose={onClose}
      size="sm"
      title={tr('កាត់ចេញពីស្តុក', 'Write off stock')}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {tr('បោះបង់', 'Cancel')}
          </button>
          <button className="btn-danger" form="wo-form">
            {tr('កាត់ចេញ', 'Write off')}
          </button>
        </>
      }
    >
      <form id="wo-form" onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label={tr('មូលហេតុ', 'Reason')} className="col-span-2">
          <Select
            value={form.type || ''}
            onChange={(v) => setForm((f) => ({ ...f, type: v }))}
            options={['EXPIRED', 'DAMAGED', 'ADJUSTMENT'].map((t) => ({ value: t, label: tr(...OUT_TYPE_LABELS[t]) }))}
          />
        </Field>
        <Field label={tr('ចំនួន', 'Quantity')} error={errors.quantity} hint={batch && `${tr('អតិបរមា', 'Max')}: ${batch.remaining}`}>
          <input type="number" min="1" max={batch?.remaining} className="input" value={form.quantity ?? ''} onChange={set('quantity')} required />
        </Field>
        <Field label={tr('កាលបរិច្ឆេទ', 'Date')} error={errors.date}>
          <input type="date" className="input" value={form.date || ''} onChange={set('date')} required />
        </Field>
        <Field label={tr('កំណត់សម្គាល់', 'Note')} className="col-span-2" error={errors.note}>
          <input className="input" value={form.note || ''} onChange={set('note')} maxLength={MAX.text} />
        </Field>
      </form>
    </Modal>
  );
}
