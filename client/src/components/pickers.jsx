import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import api from '../api/client';
import { CATEGORY_COLORS, CATEGORY_LABELS, useLang } from '../context/LangContext';
import { periodRange, shiftPeriod, todayStr } from '../utils/dates';
import Combobox from './Combobox';

export const medLabel = (m) => [m?.name, m?.strength].filter(Boolean).join(' ');

/** Loads the medicine list once (optionally with stock balances). */
export function useMedicines({ categories, withStock = false } = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(() => {
    setLoading(true);
    return api
      .get('/medicines', { params: { categories, withStock: withStock ? 1 : undefined } })
      .then((r) => setItems(r.data.items))
      .finally(() => setLoading(false));
  }, [categories, withStock]);
  useEffect(() => {
    load();
  }, [load]);
  return { items, loading, reload: load };
}

export function MedicineSelect({ medicines, value, onChange, showStock = false, invalid, autoFocus }) {
  const { tr } = useLang();
  const options = medicines.map((m) => ({
    value: m._id,
    label: `${medLabel(m)}${m.form ? ` (${m.form})` : ''}`,
    hint: [tr(...CATEGORY_LABELS[m.category]), showStock && `${tr('សល់', 'Balance')}: ${m.usable ?? m.balance ?? 0}`].filter(Boolean).join(' · '),
    dot: CATEGORY_COLORS[m.category],
  }));
  return <Combobox options={options} value={value} onChange={onChange} invalid={invalid} autoFocus={autoFocus} placeholder={tr('ជ្រើសរើសឱសថ...', 'Select medicine...')} />;
}

export function PatientSelect({ value, onChange, selectedLabel, status }) {
  const { tr } = useLang();
  const search = useCallback(
    (q) =>
      api.get('/patients', { params: { search: q, status, limit: 30 } }).then((r) =>
        r.data.items.map((p) => ({
          value: p._id,
          label: p.name,
          hint: [p.code, p.sex === 'M' ? tr('ប្រុស', 'M') : tr('ស្រី', 'F'), p.age && `${p.age}${tr('ឆ្នាំ', 'y')}`, p.diagnosis].filter(Boolean).join(' · '),
          patient: p,
        })),
      ),
    [status, tr],
  );
  return <Combobox onSearch={search} value={value} onChange={onChange} selectedLabel={selectedLabel} placeholder={tr('ស្វែងរកអ្នកជំងឺ...', 'Search patient...')} />;
}

/** Daily / Weekly / Monthly selector with prev/next arrows. */
export function PeriodPicker({ period, date, onChange, periods = ['daily', 'weekly', 'monthly'] }) {
  const { tr } = useLang();
  const labels = { daily: tr('ប្រចាំថ្ងៃ', 'Daily'), weekly: tr('ប្រចាំសប្តាហ៍', 'Weekly'), monthly: tr('ប្រចាំខែ', 'Monthly') };
  const { from, to } = periodRange(period, date);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {periods.length > 1 && (
        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
          {periods.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange({ period: p, date })}
              className={`rounded-md px-3 py-1.5 text-sm ${period === p ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {labels[p]}
            </button>
          ))}
        </div>
      )}
      <div className="inline-flex items-center gap-1">
        <button type="button" className="btn-icon border border-slate-300 bg-white" onClick={() => onChange({ period, date: shiftPeriod(period, date, -1) })} aria-label="Previous">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <input type="date" className="input w-40" value={date} onChange={(e) => e.target.value && onChange({ period, date: e.target.value })} />
        <button type="button" className="btn-icon border border-slate-300 bg-white" onClick={() => onChange({ period, date: shiftPeriod(period, date, 1) })} aria-label="Next">
          <ChevronRight className="h-4 w-4" />
        </button>
        {date !== todayStr() && (
          <button type="button" className="btn-ghost" onClick={() => onChange({ period, date: todayStr() })}>
            {tr('ថ្ងៃនេះ', 'Today')}
          </button>
        )}
      </div>
      {period !== 'daily' && (
        <span className="text-sm text-slate-500">
          {from} → {to}
        </span>
      )}
    </div>
  );
}
