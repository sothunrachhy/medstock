import { Fragment, useRef, useState } from 'react';
import { medLabel, PatientSelect, PeriodPicker } from '../../components/pickers';
import { ReportActions, ReportHeader, Sheet } from '../../components/ReportParts';
import { Empty, Loading } from '../../components/ui';
import { useLang } from '../../context/LangContext';
import { periodRange, todayStr } from '../../utils/dates';
import { khDate } from '../../utils/khmer';
import { CategorySelect } from './Reports';
import useReport from './useReport';

const PERIOD_KM = { daily: 'ប្រចាំថ្ងៃ', weekly: 'ប្រចាំសប្តាហ៍', monthly: 'ប្រចាំខែ' };

/** Patient report: how much of each medicine every patient (or one patient) received. */
export default function PatientReport() {
  const { tr } = useLang();
  const [pp, setPp] = useState({ period: 'monthly', date: todayStr() });
  const [categories, setCategories] = useState('INJECTION,PILL,NARCOTIC');
  const [patient, setPatient] = useState({ id: '', name: '' });
  const tableRef = useRef(null);
  const { from, to } = periodRange(pp.period, pp.date);
  const { data, loading } = useReport('/reports/patient-usage', { from, to, categories, patient: patient.id || undefined });

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker period={pp.period} date={pp.date} onChange={setPp} />
          <CategorySelect value={categories} onChange={setCategories} />
          <div className="w-64">
            <PatientSelect value={patient.id} selectedLabel={patient.name} onChange={(id, o) => setPatient({ id, name: o.label })} />
          </div>
          {patient.id && (
            <button className="btn-ghost" onClick={() => setPatient({ id: '', name: '' })}>
              {tr('អ្នកជំងឺទាំងអស់', 'All patients')}
            </button>
          )}
        </div>
        <ReportActions tableRef={tableRef} filename={`patient-usage-${from}_${to}`} />
      </div>
      {loading && !data ? (
        <Loading />
      ) : data ? (
        <Sheet>
          <ReportHeader
            left="short"
            title={`របាយការណ៍ប្រើប្រាស់ឱសថតាមអ្នកជំងឺ ${PERIOD_KM[pp.period]}`}
            subtitle={from === to ? khDate(from) : `ចាប់ពី${khDate(from)} ដល់${khDate(to)}`}
          />
          {!data.items.length ? (
            <Empty />
          ) : (
            <table className="report-table" ref={tableRef}>
              <thead>
                <tr>
                  <th>ល.រ</th>
                  <th>ឈ្មោះអ្នកជំងឺ</th>
                  <th>ភេទ/អាយុ</th>
                  <th>រោគវិនិច្ឆ័យ</th>
                  <th>ឱសថ</th>
                  <th>ប្រភេទ</th>
                  <th>ចំនួនថ្ងៃ</th>
                  <th>ចំនួនប្រើ</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((e, i) => (
                  <Fragment key={e.patient._id}>
                    {e.items.map((it, j) => (
                      <tr key={it.medicine._id}>
                        {j === 0 && (
                          <>
                            <td className="num align-top" rowSpan={e.items.length + 1}>
                              {i + 1}
                            </td>
                            <td className="align-top font-medium" rowSpan={e.items.length + 1}>
                              {e.patient.name}
                            </td>
                            <td className="num align-top" rowSpan={e.items.length + 1}>
                              {e.patient.sex} {e.patient.age}
                            </td>
                            <td className="align-top" rowSpan={e.items.length + 1}>
                              {e.patient.diagnosis}
                            </td>
                          </>
                        )}
                        <td>{medLabel(it.medicine)}</td>
                        <td className="num">{it.medicine.category === 'PILL' ? 'គ្រាប់' : it.medicine.form}</td>
                        <td className="num">{it.days}</td>
                        <td className="num">{it.quantity}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50 font-semibold">
                      <td colSpan={3} className="text-right">
                        សរុប
                      </td>
                      <td className="num">{e.total}</td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </Sheet>
      ) : null}
    </div>
  );
}
