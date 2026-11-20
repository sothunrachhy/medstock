import { Plus, Trash2, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import api, { errMsg } from '@/lib/api';
import { MedicineSelect, PatientSelect, useMedicines } from '@/components/pickers';
import Select from '@/components/ui/Select';
import { Field, Modal } from '@/components/ui';
import { CATEGORY_LABELS, PAYMENT_LABELS, useLang } from '@/app/LangContext';
import { useToast } from '@/app/ToastContext';
import { fmtDate, todayStr } from '@/lib/dates';
import { checkForm, serverFieldErrors, useFieldErrors } from '@/lib/validation';
import { MAX, PAYMENT_TYPES, usageSchema } from '@shared/schemas/index.js';

const newLine = () => ({ key: Math.random().toString(36).slice(2), medicine: '', quantity: 1 });

/** Record the medicines given to one patient on one day. */
export default function UsageForm({ open, onClose, patient, defaultDate, onSaved }) {
  const { tr } = useLang();
  const toast = useToast();
  const { items: medicines, reload } = useMedicines({ withStock: true });
  const [patientId, setPatientId] = useState('');
  const [patientObj, setPatientObj] = useState(null);
  const [date, setDate] = useState(todayStr());
  const [shift, setShift] = useState('');
  const [payment, setPayment] = useState('');
  const [doctor, setDoctor] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState([newLine()]);
  const [busy, setBusy] = useState(false);
  const { errors, setErrors } = useFieldErrors();

  useEffect(() => {
    if (!open) return;
    setErrors({});
    reload();
    setPatientId(patient?._id || '');
    setPatientObj(patient || null);
    setDate(defaultDate || todayStr());
    setShift(new Date().getHours() >= 7 && new Date().getHours() < 17 ? 'DAY' : 'NIGHT');
    setPayment('');
    setDoctor('');
    setNote('');
    setLines([newLine()]);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-select the payment type used for this patient last time (it can still be changed)
  useEffect(() => {
    if (!open || !patientId) return;
    let stale = false;
    api
      .get('/usage', { params: { patient: patientId, limit: 1 } })
      .then((r) => {
        const last = r.data.items[0]?.payment;
        if (!stale && last) setPayment((p) => p || last);
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, [open, patientId]);

  const medMap = useMemo(() => new Map(medicines.map((m) => [m._id, m])), [medicines]);
  const active = useMemo(() => medicines.filter((m) => m.isActive !== false), [medicines]);
  const needsDoctor = lines.some((l) => medMap.get(l.medicine)?.category === 'NARCOTIC');

  const update = (key, patch) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const submit = async (e) => {
    e.preventDefault();
    const items = lines.filter((l) => l.medicine).map((l) => ({ medicine: l.medicine, quantity: Number(l.quantity) }));
    if (!patientId) return toast.error(tr('សូមជ្រើសរើសអ្នកជំងឺ', 'Please select a patient'));
    if (!items.length) return toast.error(tr('សូមបន្ថែមឱសថយ៉ាងហោចណាស់មួយ', 'Add at least one medicine'));
    const body = { patient: patientId, date, shift, payment, doctor, note, items };
    const check = checkForm(usageSchema, body);
    setErrors(check.errors);
    if (!check.ok) return toast.error(check.message);
    setBusy(true);
    try {
      await api.post('/usage', body);
      toast(tr('បានកត់ត្រាការប្រើប្រាស់', 'Usage recorded'));
      onSaved?.();
      onClose();
    } catch (err) {
      setErrors(serverFieldErrors(err));
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={tr('កត់ត្រាការប្រើប្រាស់ឱសថ', 'Record medicine usage')}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {tr('បោះបង់', 'Cancel')}
          </button>
          <button className="btn-primary" form="usage-form" disabled={busy}>
            {tr('រក្សាទុក', 'Save')}
          </button>
        </>
      }
    >
      <form id="usage-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
          <Field label={tr('អ្នកជំងឺ', 'Patient')} required className="sm:col-span-3">
            {patient ? (
              <div className="input bg-slate-50">{patient.name}</div>
            ) : (
              <PatientSelect
                value={patientId}
                selectedLabel={patientObj?.name}
                onChange={(v, o) => {
                  setPatientId(v);
                  setPatientObj(o.patient);
                }}
              />
            )}
            {patientObj && (
              <span className="mt-1 block text-xs text-slate-500">
                {[patientObj.diagnosis, `${tr('ចូល', 'In')} ${fmtDate(patientObj.dateIn)}`].filter(Boolean).join(' · ')}
              </span>
            )}
          </Field>
          <Field label={tr('កាលបរិច្ឆេទ', 'Date')} required error={errors.date} className="sm:col-span-2">
            <input type="date" className="input" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} required />
          </Field>
          <Field label={tr('វេន', 'Shift')} className="sm:col-span-1">
            <Select
              value={shift}
              onChange={setShift}
              menuWidth={140}
              options={[
                { value: '', label: '—' },
                { value: 'DAY', label: tr('ថ្ងៃ', 'Day') },
                { value: 'NIGHT', label: tr('យប់', 'Night') },
              ]}
            />
          </Field>
        </div>

        <div className="rounded-lg border border-slate-200">
          <div className="grid grid-cols-12 gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500 uppercase">
            <div className="col-span-8 sm:col-span-7">{tr('ឱសថ', 'Medicine')}</div>
            <div className="hidden sm:col-span-2 sm:block">{tr('ស្តុកសល់', 'In stock')}</div>
            <div className="col-span-3 sm:col-span-2">{tr('ចំនួន', 'Qty')}</div>
          </div>
          <div className="space-y-2 p-3">
            {lines.map((l, idx) => {
              const m = medMap.get(l.medicine);
              // errors are reported per sent item (lines with a medicine)
              const itemIdx = lines.filter((x) => x.medicine).findIndex((x) => x.key === l.key);
              const qtyError = itemIdx >= 0 ? errors[`items.${itemIdx}.quantity`] : undefined;
              const over = (m && Number(l.quantity) > (m.usable ?? 0)) || !!qtyError;
              return (
                <div key={l.key} className="grid grid-cols-12 items-start gap-2">
                  <div className="col-span-8 sm:col-span-7">
                    <MedicineSelect medicines={active} value={l.medicine} onChange={(v) => update(l.key, { medicine: v })} showStock autoFocus={idx > 0 && !l.medicine} />
                    {m && <span className="mt-0.5 block text-xs text-slate-500">{tr(...CATEGORY_LABELS[m.category])}</span>}
                  </div>
                  <div className={`hidden pt-2 text-sm tabular-nums sm:col-span-2 sm:block ${over ? 'font-semibold text-rose-600' : 'text-slate-600'}`}>{m ? m.usable : '—'}</div>
                  <div className="col-span-3 sm:col-span-2">
                    <input type="number" min="1" step="1" className={`input ${over ? 'border-rose-400' : ''}`} value={l.quantity} onChange={(e) => update(l.key, { quantity: e.target.value })} title={qtyError} />
                    {qtyError && <span className="mt-0.5 block text-xs text-rose-600">{qtyError}</span>}
                  </div>
                  <div className="col-span-1 pt-1">
                    <button type="button" className="btn-icon hover:text-rose-600" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label="Remove">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
            <button type="button" className="btn-ghost text-brand-700" onClick={() => setLines((ls) => [...ls, newLine()])}>
              <Plus className="h-4 w-4" /> {tr('បន្ថែមឱសថ', 'Add medicine')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={tr('ការបង់ប្រាក់', 'Payment')} required error={errors.payment}>
            <Select
              value={payment}
              onChange={(v) => {
                setPayment(v);
                setErrors((e) => ({ ...e, payment: undefined }));
              }}
              icon={Wallet}
              placeholder={tr('ជ្រើសរើសការបង់ប្រាក់...', 'Select payment...')}
              menuWidth={320}
              options={PAYMENT_TYPES.map((p) => ({ value: p, label: tr(...PAYMENT_LABELS[p].label), hint: tr(...PAYMENT_LABELS[p].hint) }))}
            />
          </Field>
          <Field label={tr('ឈ្មោះគ្រូពេទ្យ', 'Doctor')} required={needsDoctor} error={errors.doctor} hint={needsDoctor ? tr('ចាំបាច់សម្រាប់ថ្នាំញៀន', 'Required for narcotics') : undefined}>
            <input className="input" value={doctor} onChange={(e) => setDoctor(e.target.value)} required={needsDoctor} maxLength={MAX.label} />
          </Field>
        </div>
        <Field label={tr('កំណត់សម្គាល់', 'Note')} error={errors.note}>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={MAX.text} />
        </Field>
      </form>
    </Modal>
  );
}
