import { useRef, useState } from 'react';
import { PeriodPicker } from '../../components/pickers';
import { ReportActions, ReportHeader, Sheet, Signatures } from '../../components/ReportParts';
import { Loading } from '../../components/ui';
import { useLang } from '../../context/LangContext';
import { ORG } from '../../config/org';
import { todayStr } from '../../utils/dates';
import { khDateParts, pad2 } from '../../utils/khmer';
import { CategorySelect, REPORT_CATEGORIES } from './Reports';
import useReport from './useReport';

/**
 * Daily stock report (template: របាយការណ៍ស្តុកថ្នាំចាក់/គ្រាប់).
 * ចំនួនសល់ពីមុន + ចំនួនបន្ថែម = ចំនួនសរុប; ចំនួនសរុប − ប្រើប្រាស់ − ផ្សេងៗ = ចំនួនសល់
 */
export default function DailyStock() {
  const { tr } = useLang();
  const [date, setDate] = useState(todayStr());
  const [categories, setCategories] = useState('INJECTION,NARCOTIC');
  const [hideEmpty, setHideEmpty] = useState(false);
  const tableRef = useRef(null);
  const { data, loading } = useReport('/reports/stock-summary', { from: date, to: date, categories });
  const kd = khDateParts(date);
  const isPill = categories === 'PILL';
  const rows = (data?.rows || []).filter((r) => !hideEmpty || r.opening || r.received || r.used || r.writeOff);

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker period="daily" periods={['daily']} date={date} onChange={(v) => setDate(v.date)} />
          <CategorySelect value={categories} onChange={setCategories} options={REPORT_CATEGORIES.slice(0, 2)} />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
            {tr('លាក់ឱសថគ្មានស្តុក', 'Hide empty rows')}
          </label>
        </div>
        <ReportActions tableRef={tableRef} filename={`stock-${isPill ? 'pills' : 'injections'}-${date}`} />
      </div>

      {loading && !data ? (
        <Loading />
      ) : data ? (
        <Sheet>
          <ReportHeader
            kingdom
            title="របាយការណ៍ ចំណូល-ចំណាយ សម្ភារៈបរិក្ខាពេទ្យ-ឱសថប្រចាំថ្ងៃ"
            subtitle={`ប្រចាំថ្ងៃទី ${kd.day} ខែ ${kd.month} ឆ្នាំ${kd.year}`}
          />
          <table className="report-table" ref={tableRef}>
            <thead>
              <tr>
                <th>ល.រ</th>
                <th>សំភារៈ ឱសថ និងបរិក្ខា</th>
                <th>ប្រភេទ</th>
                <th>កំរិត</th>
                <th>ចំនួនសល់ពីមុន</th>
                <th>ចំនួនបន្ថែម</th>
                <th>ចំនួនសរុប</th>
                <th>ចំនួនប្រើប្រាស់</th>
                <th>ចំនួនសល់</th>
                <th>ផ្សេងៗ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.medicine._id}>
                  <td className="num">{i + 1}</td>
                  <td>{r.medicine.name}</td>
                  <td className="num">{isPill ? 'គ្រាប់' : r.medicine.form}</td>
                  <td className="num">{r.medicine.strength}</td>
                  <td className="num">{pad2(r.opening)}</td>
                  <td className="num">{r.received ? pad2(r.received) : ''}</td>
                  <td className="num">{pad2(r.opening + r.received)}</td>
                  <td className="num">{r.used ? pad2(r.used) : ''}</td>
                  <td className="num font-semibold">{pad2(r.closing)}</td>
                  <td className="num">{r.writeOff ? `${tr('កាត់ចេញ', 'Write-off')} ${r.writeOff}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Signatures place={`${ORG.city},ថ្ងៃទី${kd.day} ខែ${kd.month} ឆ្នាំ${kd.year}`} names={['នាយផ្នែក', 'នាយសាល']} />
        </Sheet>
      ) : null}
    </div>
  );
}
