import { useMemo, useState } from 'react';
import { medLabel, PeriodPicker, useMedicines } from '@/components/pickers';
import Select from '@/components/ui/Select';
import { ReportActions, ReportHeader, Sheet, Signatures } from './ReportParts';
import { Loading } from '@/components/ui';
import { ORG } from '@/config/org';
import { useLang } from '@/app/LangContext';
import { fmtDate, periodRange, todayStr } from '@/lib/dates';
import { khDateParts, pad2 } from '@/lib/khmer';
import useReport from './useReport';

const MIN_ROWS = 15;

/**
 * Narcotic register (template: របាយការណ៍ថ្នាំបំបាត់ការឈឺចាប់មានសារធាតុញៀន).
 * One sheet per narcotic medicine (Fentanyl, Morphine...).
 */
export default function NarcoticReport() {
  const { tr } = useLang();
  const [pp, setPp] = useState({ period: 'daily', date: todayStr() });
  const [medicine, setMedicine] = useState('');
  const { items: narcotics } = useMedicines({ categories: 'NARCOTIC' });
  const { from, to } = periodRange(pp.period, pp.date);
  const { data, loading } = useReport('/reports/narcotic', { from, to, medicine: medicine || undefined });

  const sheets = useMemo(() => {
    if (!data) return [];
    const meds = medicine ? narcotics.filter((m) => m._id === medicine) : narcotics;
    return meds.map((m) => ({ medicine: m, items: data.items.filter((i) => i.medicine?._id === m._id) }));
  }, [data, narcotics, medicine]);

  const end = khDateParts(to);

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker period={pp.period} date={pp.date} onChange={setPp} />
          <Select
            className="w-auto min-w-44"
            value={medicine}
            onChange={setMedicine}
            options={[{ value: '', label: tr('ថ្នាំញៀនទាំងអស់', 'All narcotics') }, ...narcotics.map((m) => ({ value: m._id, label: medLabel(m), hint: m.form }))]}
          />
        </div>
        <ReportActions />
      </div>

      {loading && !data ? (
        <Loading />
      ) : (
        sheets.map(({ medicine: m, items }, idx) => {
          const total = items.reduce((s, i) => s + i.quantity, 0);
          const blanks = Math.max(0, MIN_ROWS - items.length);
          return (
            <div key={m._id} className={idx > 0 ? 'page-break' : ''}>
              <Sheet>
                <ReportHeader left="short" refNo={ORG.narcoticRefNo} />
                <h2 className="mb-1 text-center text-[15px]">
                  <span className="moul">របាយការណ៍ប្រើប្រាស់ឱសថមានសារធាតុញៀន</span> {m.name} {m.strength} {m.form?.toLowerCase()}
                </h2>
                <div className="mb-2 text-center text-[12px]">
                  {from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`}
                </div>
                <table className="report-table">
                  <thead>
                    <tr>
                      <th>ល.រ</th>
                      <th>ថ្ងៃ/ទី/ខែ</th>
                      <th className="min-w-[140px]">ឈ្មោះអ្នកជំងឺ</th>
                      <th>អាយុ</th>
                      <th>ភេទ</th>
                      <th>អាស័យដ្ឋាន</th>
                      <th>ចំនួនប្រើ</th>
                      <th className="min-w-[200px]">រោគវិនិច្ឆ័យ</th>
                      <th>ឈ្មោះគ្រូពេទ្យ</th>
                      <th className="min-w-[90px]">ហត្ថលេខា</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i, n) => (
                      <tr key={i._id}>
                        <td className="num">{n + 1}</td>
                        <td className="num">{fmtDate(i.date)}</td>
                        <td>{i.patient?.name}</td>
                        <td className="num">{i.patient?.age}</td>
                        <td className="num">{i.patient?.sex === 'M' ? 'ប' : i.patient?.sex === 'F' ? 'ស' : ''}</td>
                        <td>{i.patient?.province}</td>
                        <td className="num">{pad2(i.quantity)}</td>
                        <td>{i.patient?.diagnosis}</td>
                        <td>{i.doctor}</td>
                        <td></td>
                      </tr>
                    ))}
                    {Array.from({ length: blanks }, (_, b) => (
                      <tr key={`b${b}`}>
                        <td className="num">{items.length + b + 1}</td>
                        {Array.from({ length: 9 }, (__, c) => (
                          <td key={c}>&nbsp;</td>
                        ))}
                      </tr>
                    ))}
                    <tr>
                      <td colSpan={10} className="text-center">
                        ចំនួនប្រើប្រាស់សរុបៈ {pad2(total)}អំពូល
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="mt-2 text-right text-[13px]">
                  ថ្ងៃទី{end.day} ខែ{end.month} ឆ្នាំ{end.year}
                </div>
                <Signatures names={['នាយកមន្ទីរពេទ្យ', 'បានពិនិត្យដោយមន្ត្រីគ្រប់គ្រងឱសថ', 'ហត្ថលេខានាយផ្នែក']} />
              </Sheet>
            </div>
          );
        })
      )}
    </div>
  );
}
