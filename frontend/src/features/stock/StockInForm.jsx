import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { errMsg } from '@/lib/api';
import { stock } from '@/lib/backend';
import { MedicineSelect, useMedicines } from '@/components/pickers';
import { Modal } from '@/components/ui';
import Select from '@/components/ui/Select';
import { CATEGORY_COLORS, CATEGORY_LABELS, useLang } from '@/app/LangContext';
import { useToast } from '@/app/ToastContext';
import { todayStr } from '@/lib/dates';
import { checkForm, serverFieldErrors, useFieldErrors } from '@/lib/validation';
import { MAX, stockInSchema } from '@shared/schemas/index.js';

const newLine = (medicine = '') => ({ key: Math.random().toString(36).slice(2), medicine, quantity: '', expiryDate: '', batchNo: '' });

/** Insert new stock (ចំណូល) for any type of medicine — several lines at once. */
export default function StockInForm({ open, onClose, category, medicineId, onSaved }) {
  const { tr } = useLang();
  const toast = useToast();
  const { items: medicines } = useMedicines();
  const [filter, setFilter] = useState(category || '');
  const [receivedDate, setReceivedDate] = useState(todayStr());
  const [source, setSource] = useState('');
  const [note, setNote] = useState('');
  const [lines, setLines] = useState([newLine()]);
  const [busy, setBusy] = useState(false);
  const { errors, setErrors } = useFieldErrors();

  useEffect(() => {
    if (!open) return;
    setErrors({});
    setFilter(category || '');
    setReceivedDate(todayStr());
    setSource('');
    setNote('');
    setLines([newLine(medicineId || '')]);
  }, [open, category, medicineId, setErrors]);

  const options = useMemo(() => medicines.filter((m) => m.isActive !== false && (!filter || m.category === filter)), [medicines, filter]);
  const update = (key, patch) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const submit = async (e) => {
    e.preventDefault();
    const items = lines
      .filter((l) => l.medicine || l.quantity)
      .map((l) => ({ medicine: l.medicine, quantity: Number(l.quantity), expiryDate: l.expiryDate, batchNo: l.batchNo, receivedDate, source, note }));
    if (!items.length) return toast.error(tr('សូមបន្ថែមឱសថយ៉ាងហោចណាស់មួយ', 'Add at least one medicine'));
    const check = checkForm(stockInSchema, { items });
    setErrors(check.errors);
    if (!check.ok) return toast.error(check.message);
    setBusy(true);
    try {
      await stock.receive(items);
      toast(tr(`បានបញ្ចូលស្តុក ${items.length} មុខ`, `${items.length} item(s) added to stock`));
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
      size="xl"
      title={tr('បញ្ចូលស្តុកថ្មី', 'Insert new stock')}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose}>
            {tr('បោះបង់', 'Cancel')}
          </button>
          <button className="btn-primary" form="stockin-form" disabled={busy}>
            {tr('រក្សាទុក', 'Save')}
          </button>
        </>
      }
    >
      <form id="stockin-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <label>
            <span className="label">{tr('ថ្ងៃបញ្ចូល', 'Input date')} *</span>
            <input type="date" className="input" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} required />
          </label>
          <label>
            <span className="label">{tr('ប្រភេទឱសថ', 'Medicine type')}</span>
            <Select
              value={filter}
              onChange={setFilter}
              menuWidth={240}
              options={[
                { value: '', label: tr('គ្រប់ប្រភេទ', 'All types') },
                ...Object.entries(CATEGORY_LABELS).map(([c, l]) => ({ value: c, label: tr(...l), dot: CATEGORY_COLORS[c] })),
              ]}
            />
          </label>
          <label>
            <span className="label">{tr('ប្រភព', 'Source / supplier')}</span>
            <input className="input" value={source} onChange={(e) => setSource(e.target.value)} maxLength={MAX.label} placeholder={tr('ឱសថស្ថានមន្ទីរពេទ្យ', 'Hospital pharmacy')} />
          </label>
          <label>
            <span className="label">{tr('កំណត់សម្គាល់', 'Note')}</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} maxLength={MAX.text} />
          </label>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="table min-w-[720px]">
            <thead>
              <tr>
                <th className="w-8">#</th>
                <th>{tr('ឈ្មោះឱសថ', 'Medicine')} *</th>
                <th className="w-28">{tr('ចំនួនសរុប', 'Total')} *</th>
                <th className="w-44">{tr('ថ្ងៃផុតកំណត់', 'Expire date')} *</th>
                <th className="w-36">{tr('លេខឡូត៍', 'Batch no.')}</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => {
                // errors are reported per sent item (lines with a medicine or quantity)
                const itemIdx = lines.filter((x) => x.medicine || x.quantity).findIndex((x) => x.key === l.key);
                const err = (f) => (itemIdx >= 0 ? errors[`items.${itemIdx}.${f}`] : undefined);
                const lineError = err('medicine') || err('quantity') || err('expiryDate') || err('batchNo');
                return (
                <tr key={l.key} title={lineError}>
                  <td className="text-slate-400">{i + 1}</td>
                  <td>
                    <MedicineSelect medicines={options} value={l.medicine} onChange={(v) => update(l.key, { medicine: v })} autoFocus={i > 0 && !l.medicine} />
                  </td>
                  <td>
                    <input type="number" min="1" step="1" className={`input ${err('quantity') ? 'border-rose-400' : ''}`} value={l.quantity} onChange={(e) => update(l.key, { quantity: e.target.value })} required={!!l.medicine} />
                  </td>
                  <td>
                    <input type="date" className={`input ${err('expiryDate') ? 'border-rose-400' : ''}`} min={receivedDate} value={l.expiryDate} onChange={(e) => update(l.key, { expiryDate: e.target.value })} required={!!l.medicine} />
                  </td>
                  <td>
                    <input className="input" value={l.batchNo} onChange={(e) => update(l.key, { batchNo: e.target.value })} maxLength={MAX.code} />
                    {lineError && <span className="mt-0.5 block text-xs text-rose-600">{lineError}</span>}
                  </td>
                  <td>
                    <button type="button" className="btn-icon hover:text-rose-600" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} aria-label="Remove">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
          <div className="p-2">
            <button type="button" className="btn-ghost text-brand-700" onClick={() => setLines((ls) => [...ls, newLine()])}>
              <Plus className="h-4 w-4" /> {tr('បន្ថែមជួរ', 'Add line')}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
