import { useRef, useState } from 'react';
import { medLabel, PeriodPicker } from '@/components/pickers';
import { ReportActions, Sheet, Signatures } from './ReportParts';
import { Empty, Loading } from '@/components/ui';
import { useLang } from '@/app/LangContext';
import { todayStr } from '@/lib/dates';
import { khDateParts, pad2 } from '@/lib/khmer';
import { CategorySelect, REPORT_CATEGORIES } from './Reports';
import { reports } from '@/lib/backend';
import useReport from './useReport';

/**
 * Daily medicine sheet per patient (template: ថ្នាំចាក់/ថ្នាំគ្រាប់_ប្រចាំថ្ងៃ).
 * Rows = patients, columns = medicines given that day.
 */
export default function DailySheet() {
  const { tr } = useLang();
  const [date, setDate] = useState(todayStr());
  const [categories, setCategories] = useState('INJECTION,NARCOTIC');
  const [allColumns, setAllColumns] = useState(false);
  const tableRef = useRef(null);
  const { data, loading } = useReport(reports.dailySheet, { date, categories, allColumns: allColumns || undefined });
  const kd = khDateParts(date);

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker period="daily" periods={['daily']} date={date} onChange={(v) => setDate(v.date)} />
          <CategorySelect value={categories} onChange={setCategories} options={REPORT_CATEGORIES.slice(0, 2)} />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={allColumns} onChange={(e) => setAllColumns(e.target.checked)} />
            {tr('បង្ហាញគ្រប់ជួរឈរ', 'Show all columns')}
          </label>
        </div>
        <ReportActions tableRef={tableRef} filename={`daily-sheet-${categories === 'PILL' ? 'pills' : 'injections'}-${date}`} />
      </div>

      {loading && !data ? (
        <Loading />
      ) : data ? (
        <Sheet>
          <div className="mb-3 text-center">
            <div className="text-[15px]">របាយការណ៍ឱសថ បរិក្ខាពេទ្យ សំរាប់ឱសថយាម/ផ្នែកបច្ចេកទេស</div>
            <div className="mt-1 flex justify-center gap-8 text-[13px]">
              <span>
                ថ្ងៃទី {kd.day} ខែ {kd.month} ឆ្នាំ {kd.year}
              </span>
              <span>ផ្នែក ប្រពោធនកម្មសល្យសាស្ត្រ</span>
            </div>
          </div>
          {data.rows.length === 0 && !allColumns ? (
            <Empty>{tr('មិនមានការប្រើប្រាស់នៅថ្ងៃនេះ', 'No usage recorded on this day')}</Empty>
          ) : (
            <table className="report-table" ref={tableRef}>
              <thead>
                <tr>
                  <th>N°</th>
                  <th className="min-w-[140px]">NAME</th>
                  <th>AGE</th>
                  <th>SEX</th>
                  <th className="min-w-[120px]">Diagnostic</th>
                  <th>Province</th>
                  {data.columns.map((c) => (
                    <th key={c._id} className="highlight">
                      <div className="vertical">{medLabel(c)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={r.patient._id}>
                    <td className="num">{i + 1}</td>
                    <td>{r.patient.name}</td>
                    <td className="num">{r.patient.age}</td>
                    <td className="num">{r.patient.sex}</td>
                    <td>{r.patient.diagnosis}</td>
                    <td>{r.patient.province}</td>
                    {data.columns.map((c) => (
                      <td key={c._id} className="num">
                        {pad2(r.quantities[c._id])}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td colSpan={6} className="text-right">
                    សរុប / Total
                  </td>
                  {data.columns.map((c) => (
                    <td key={c._id} className="num">
                      {pad2(data.totals[c._id])}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          )}
          <Signatures names={['ប្រធានយាម', 'អ្នកធ្វើតារាង']} />
        </Sheet>
      ) : null}
    </div>
  );
}
