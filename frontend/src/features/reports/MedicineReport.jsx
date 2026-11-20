import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment, useRef, useState } from 'react';
import { PeriodPicker } from '@/components/pickers';
import { ReportActions, ReportHeader, Sheet } from './ReportParts';
import { Empty, Loading } from '@/components/ui';
import { useLang } from '@/app/LangContext';
import { periodRange, todayStr } from '@/lib/dates';
import { khDate } from '@/lib/khmer';
import { CategorySelect, categoryKm } from './Reports';
import useReport from './useReport';

const PERIOD_KM = { daily: 'ប្រចាំថ្ងៃ', weekly: 'ប្រចាំសប្តាហ៍', monthly: 'ប្រចាំខែ' };

/** Medicine report: how much of each medicine was used, and by which patients. */
export default function MedicineReport() {
  const { tr } = useLang();
  const [pp, setPp] = useState({ period: 'monthly', date: todayStr() });
  const [categories, setCategories] = useState('INJECTION,NARCOTIC');
  const [expandAll, setExpandAll] = useState(false);
  const [open, setOpen] = useState({});
  const tableRef = useRef(null);
  const { from, to } = periodRange(pp.period, pp.date);
  const { data, loading } = useReport('/reports/medicine-usage', { from, to, categories });
  const isOpen = (id) => expandAll || open[id];

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker period={pp.period} date={pp.date} onChange={setPp} />
          <CategorySelect value={categories} onChange={setCategories} />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={expandAll} onChange={(e) => setExpandAll(e.target.checked)} />
            {tr('បង្ហាញតាមអ្នកជំងឺ', 'Show patients')}
          </label>
        </div>
        <ReportActions tableRef={tableRef} filename={`medicine-usage-${from}_${to}`} />
      </div>
      {loading && !data ? (
        <Loading />
      ) : data ? (
        <Sheet>
          <ReportHeader
            left="short"
            title={`របាយការណ៍ប្រើប្រាស់ឱសថ (${categoryKm(categories)}) ${PERIOD_KM[pp.period]}`}
            subtitle={from === to ? khDate(from) : `ចាប់ពី${khDate(from)} ដល់${khDate(to)}`}
          />
          {!data.items.length ? (
            <Empty />
          ) : (
            <table className="report-table" ref={tableRef}>
              <thead>
                <tr>
                  <th>ល.រ</th>
                  <th>ឱសថ</th>
                  <th>ប្រភេទ</th>
                  <th>កម្រិត</th>
                  <th>អ្នកជំងឺ (នាក់)</th>
                  <th>ចំនួនប្រើសរុប</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((e, i) => (
                  <Fragment key={e.medicine._id}>
                    <tr className="cursor-pointer" onClick={() => setOpen((o) => ({ ...o, [e.medicine._id]: !o[e.medicine._id] }))}>
                      <td className="num">{i + 1}</td>
                      <td className="font-medium">
                        <span className="no-print mr-1 inline-block align-middle text-slate-400">
                          {isOpen(e.medicine._id) ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </span>
                        {e.medicine.name}
                      </td>
                      <td className="num">{e.medicine.category === 'PILL' ? 'គ្រាប់' : e.medicine.form}</td>
                      <td className="num">{e.medicine.strength}</td>
                      <td className="num">{e.patientCount}</td>
                      <td className="num font-semibold">{e.total}</td>
                    </tr>
                    {isOpen(e.medicine._id) &&
                      e.patients.map((p, j) => (
                        <tr key={j} className="text-[12px] text-slate-600">
                          <td></td>
                          <td colSpan={3} className="pl-8">
                            {p.patient.name} {p.patient.age ? `(${p.patient.sex || ''} ${p.patient.age})` : ''}
                          </td>
                          <td className="num">{p.times} {tr('ដង', 'times')}</td>
                          <td className="num">{p.quantity}</td>
                        </tr>
                      ))}
                  </Fragment>
                ))}
                <tr className="font-semibold">
                  <td colSpan={5} className="text-right">
                    សរុប ({data.items.length} មុខ)
                  </td>
                  <td className="num">{data.items.reduce((s, e) => s + e.total, 0)}</td>
                </tr>
              </tbody>
            </table>
          )}
          <div className="no-print mt-2 text-xs text-slate-400">{tr('ចុចលើឱសថ ដើម្បីមើលអ្នកជំងឺដែលបានប្រើ', 'Click a medicine to see which patients used it')}</div>
        </Sheet>
      ) : null}
    </div>
  );
}
