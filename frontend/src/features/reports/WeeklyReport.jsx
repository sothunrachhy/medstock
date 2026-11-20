import { Copy, Save } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { errMsg } from '@/lib/api';
import { reports } from '@/lib/backend';
import { PeriodPicker } from '@/components/pickers';
import { ReportActions, ReportHeader, Sheet, Signatures } from './ReportParts';
import { Loading } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { useLang } from '@/app/LangContext';
import { useToast } from '@/app/ToastContext';
import { fmtDateTime, periodRange, todayStr } from '@/lib/dates';
import { khDate, khNum, pad2 } from '@/lib/khmer';
import { CategorySelect, REPORT_CATEGORIES } from './Reports';
import useReport from './useReport';

/**
 * Weekly usage & request report sent to management
 * (template: របាយការណ៍ប្រើប្រាស់ឱសថ_ប្រចាំថ្ងៃ_09_15).
 */
export default function WeeklyReport() {
  const { tr } = useLang();
  const { can } = useAuth();
  const toast = useToast();
  const [date, setDate] = useState(todayStr());
  const [categories, setCategories] = useState('INJECTION,NARCOTIC');
  const [hideEmpty, setHideEmpty] = useState(false);
  const [req, setReq] = useState({}); // medicineId -> { requested, provided }
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const tableRef = useRef(null);
  const { from, to } = periodRange('weekly', date);
  const { data, loading } = useReport(reports.stockSummary, { from, to, categories });
  const editable = can('reports', 'update');

  useEffect(() => {
    if (!data) return;
    setReq(Object.fromEntries(data.rows.map((r) => [r.medicine._id, { requested: r.requested ?? '', provided: r.provided ?? '' }])));
    setDirty(false);
  }, [data]);

  const setCell = (id, field, value) => {
    setReq((s) => ({ ...s, [id]: { ...s[id], [field]: value === '' ? '' : Math.max(0, Number(value)) } }));
    setDirty(true);
  };

  const fillRequested = () => {
    setReq((s) => {
      const next = { ...s };
      for (const r of data.rows) if (r.used > 0) next[r.medicine._id] = { ...next[r.medicine._id], requested: r.used };
      return next;
    });
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await reports.saveRequisition({
        categories,
        from,
        to,
        items: Object.entries(req)
          .filter(([, v]) => v.requested !== '' || v.provided !== '')
          .map(([medicine, v]) => ({ medicine, requested: v.requested || 0, provided: v.provided || 0 })),
      });
      setDirty(false);
      toast(tr('បានរក្សាទុកសំណើ', 'Request saved'));
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const rows = (data?.rows || []).filter((r) => !hideEmpty || r.opening || r.received || r.used || r.writeOff || req[r.medicine._id]?.requested);

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker period="weekly" periods={['weekly']} date={date} onChange={(v) => setDate(v.date)} />
          <CategorySelect value={categories} onChange={setCategories} options={REPORT_CATEGORIES.slice(0, 2)} />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
            {tr('លាក់ឱសថគ្មានចលនា', 'Hide rows without movement')}
          </label>
        </div>
        <ReportActions tableRef={tableRef} filename={`weekly-${categories === 'PILL' ? 'pills' : 'injections'}-${from}_${to}`}>
          {editable && (
            <>
              <button className="btn-secondary" onClick={fillRequested} disabled={!data} title={tr('ស្នើសុំស្មើនឹងចំនួនបានប្រើ', 'Set requested = used')}>
                <Copy className="h-4 w-4" /> {tr('ស្នើ = ចំណាយ', 'Request = used')}
              </button>
              <button className="btn-secondary" onClick={save} disabled={!dirty || saving}>
                <Save className="h-4 w-4" /> {tr('រក្សាទុកសំណើ', 'Save request')}
              </button>
            </>
          )}
        </ReportActions>
      </div>
      {data?.requisition?.updatedAt && (
        <div className="no-print text-xs text-slate-500">
          {tr('សំណើរក្សាទុកចុងក្រោយ', 'Request last saved')}: {fmtDateTime(data.requisition.updatedAt)}
        </div>
      )}

      {loading && !data ? (
        <Loading />
      ) : data ? (
        <Sheet>
          <ReportHeader left="short" title="របាយការណ៍ចំណូលចំណាយ និងសំណើឱសថ" subtitle={`ចាប់ពី${khDate(data.from)} ដល់${khDate(data.to)}`} />
          <table className="report-table" ref={tableRef}>
            <thead>
              <tr>
                <th rowSpan={2}>ល.រ</th>
                <th rowSpan={2} className="min-w-[150px]">
                  ឱសថ
                </th>
                <th rowSpan={2}>ប្រភេទ</th>
                <th rowSpan={2}>កម្រិត</th>
                <th rowSpan={2}>ដើមគ្រា</th>
                <th rowSpan={2}>ចំណូល</th>
                <th colSpan={data.days.length}>បរិមាណប្រើប្រាស់</th>
                <th rowSpan={2}>ចំណាយសរុប</th>
                <th rowSpan={2}>ចំនួនសល់</th>
                <th rowSpan={2}>ចំនួនស្នើសុំ</th>
                <th rowSpan={2}>ចំនួនផ្ដល់</th>
              </tr>
              <tr>
                {data.days.map((d) => (
                  <th key={d} className="font-normal">
                    {khNum(d.slice(8, 10))}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const id = r.medicine._id;
                const v = req[id] || { requested: '', provided: '' };
                return (
                  <tr key={id}>
                    <td className="num">{i + 1}</td>
                    <td>{r.medicine.name}</td>
                    <td className="num">{r.medicine.category === 'PILL' ? 'គ្រាប់' : r.medicine.form}</td>
                    <td className="num">{r.medicine.strength}</td>
                    <td className="num">{pad2(r.opening)}</td>
                    <td className="num highlight">{r.received ? pad2(r.received) : ''}</td>
                    {data.days.map((d) => (
                      <td key={d} className="num">
                        {r.daily[d] ? pad2(r.daily[d]) : ''}
                      </td>
                    ))}
                    <td className="num">
                      {pad2(r.used)}
                      {r.writeOff ? <span className="no-print block text-[10px] text-amber-700">+{r.writeOff} {tr('កាត់ចេញ', 'w/o')}</span> : null}
                    </td>
                    <td className={`num font-semibold ${r.closing < 0 ? 'text-rose-600' : ''}`}>{pad2(r.closing)}</td>
                    {['requested', 'provided'].map((f) => (
                      <td key={f} className="num w-20 p-0">
                        {editable ? (
                          <>
                            <input
                              type="number"
                              min="0"
                              className="no-print w-full bg-transparent px-1 py-1 text-center outline-none focus:bg-brand-50"
                              value={v[f]}
                              onChange={(e) => setCell(id, f, e.target.value)}
                            />
                            <span className="hidden print:inline">{v[f] === '' ? '' : pad2(v[f])}</span>
                          </>
                        ) : v[f] === '' ? (
                          ''
                        ) : (
                          pad2(v[f])
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Signatures names={['នាយកមន្ទីរពេទ្យ', 'មន្ត្រីគ្រប់គ្រងឱសថ', 'នាយផ្នែក', 'នាយសាល', 'អ្នកទទួល', 'អ្នកប្រគល់']} />
        </Sheet>
      ) : null}
    </div>
  );
}
