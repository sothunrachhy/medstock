import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { errMsg } from '@/lib/api';
import { patients, usage as usageApi } from '@/lib/backend';
import { medLabel } from '@/components/pickers';
import { Badge, Empty, Loading } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { CATEGORY_LABELS, PAYMENT_LABELS, useLang } from '@/app/LangContext';
import { useToast } from '@/app/ToastContext';
import { fmtDate, toDayStr } from '@/lib/dates';
import PatientForm from './PatientForm';
import { CAT_BADGE } from '@/features/usage/Usage';
import UsageForm from '@/features/usage/UsageForm';

export default function PatientDetail() {
  const { id } = useParams();
  const { tr } = useLang();
  const { can } = useAuth();
  const toast = useToast();
  const [patient, setPatient] = useState(null);
  const [usage, setUsage] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, u] = await Promise.all([
        patients.get(id),
        can('usage') ? usageApi.list({ patient: id, limit: 1000 }) : Promise.resolve({ items: [] }),
      ]);
      setPatient(p);
      setUsage(u.items);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [id, can, toast]);
  useEffect(() => {
    load();
  }, [load]);

  // totals per medicine and entries grouped by day
  const { totals, days } = useMemo(() => {
    const t = new Map();
    const d = new Map();
    for (const u of usage) {
      const key = u.medicine?._id;
      if (!t.has(key)) t.set(key, { medicine: u.medicine, quantity: 0 });
      t.get(key).quantity += u.quantity;
      const day = toDayStr(u.date);
      if (!d.has(day)) d.set(day, []);
      d.get(day).push(u);
    }
    return { totals: [...t.values()].sort((a, b) => b.quantity - a.quantity), days: [...d.entries()] };
  }, [usage]);

  const remove = async (u) => {
    if (!window.confirm(tr('លុបកំណត់ត្រានេះ? ចំនួនឱសថនឹងត្រូវបញ្ចូលទៅស្តុកវិញ។', 'Delete this record? The quantity will be returned to stock.'))) return;
    try {
      await usageApi.remove(u._id);
      toast(tr('បានលុប', 'Deleted'));
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  if (loading) return <Loading />;
  if (!patient) return <Empty />;

  const info = [
    [tr('ភេទ', 'Sex'), patient.sex === 'M' ? tr('ប្រុស', 'Male') : tr('ស្រី', 'Female')],
    [tr('អាយុ', 'Age'), patient.age ?? '—'],
    [tr('រោគវិនិច្ឆ័យ', 'Diagnosis'), patient.diagnosis || '—'],
    [tr('អាសយដ្ឋាន', 'Province'), patient.province || '—'],
    [tr('ថ្ងៃចូល', 'Date in'), fmtDate(patient.dateIn)],
    [tr('ថ្ងៃចេញ', 'Date out'), patient.dateOut ? fmtDate(patient.dateOut) : '—'],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/patients" className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
            <ArrowLeft className="h-4 w-4" /> {tr('អ្នកជំងឺ', 'Patients')}
          </Link>
          <h1 className="flex items-center gap-3 text-xl font-semibold">
            {patient.name}
            {patient.status === 'ADMITTED' ? <Badge color="green">{tr('កំពុងព្យាបាល', 'Admitted')}</Badge> : <Badge>{tr('បានចេញ', 'Discharged')}</Badge>}
          </h1>
          {patient.code && <div className="text-sm text-slate-500">{patient.code}</div>}
        </div>
        <div className="flex gap-2">
          {can('patients', 'update') && (
            <button className="btn-secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" /> {tr('កែប្រែ', 'Edit')}
            </button>
          )}
          {can('usage', 'create') && (
            <button className="btn-primary" onClick={() => setUsageOpen(true)}>
              <Plus className="h-4 w-4" /> {tr('កត់ត្រាការប្រើប្រាស់', 'Record usage')}
            </button>
          )}
        </div>
      </div>

      <div className="card grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-6">
        {info.map(([k, v]) => (
          <div key={k}>
            <div className="text-xs text-slate-500">{k}</div>
            <div className="font-medium">{v}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="card">
          <div className="border-b border-slate-200 px-4 py-3 font-semibold">{tr('សរុបឱសថបានប្រើ', 'Total medicines used')}</div>
          {totals.length ? (
            <table className="table">
              <tbody>
                {totals.map((t) => (
                  <tr key={t.medicine?._id}>
                    <td>
                      {medLabel(t.medicine)} <span className="text-xs text-slate-500">{t.medicine?.form}</span>
                    </td>
                    <td className="text-right font-semibold tabular-nums">{t.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty />
          )}
        </div>

        <div className="card lg:col-span-2">
          <div className="border-b border-slate-200 px-4 py-3 font-semibold">{tr('ប្រវត្តិការប្រើប្រាស់', 'Usage history')}</div>
          {days.length ? (
            <div className="divide-y divide-slate-100">
              {days.map(([day, entries]) => (
                <div key={day} className="px-4 py-3">
                  <div className="mb-2 text-sm font-semibold text-slate-600">{fmtDate(day)}</div>
                  <div className="space-y-1">
                    {entries.map((u) => (
                      <div key={u._id} className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          <Badge color={CAT_BADGE[u.medicine?.category]}>{tr(...(CATEGORY_LABELS[u.medicine?.category] || ['']))}</Badge>
                          <span className="truncate">{medLabel(u.medicine)}</span>
                          {u.doctor && <span className="truncate text-xs text-slate-500">· {u.doctor}</span>}
                          {PAYMENT_LABELS[u.payment] && <span className="truncate text-xs text-slate-500">· {tr(...PAYMENT_LABELS[u.payment].short)}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold tabular-nums">× {u.quantity}</span>
                          {can('usage', 'delete') && (
                            <button className="btn-icon h-7 w-7 hover:text-rose-600" onClick={() => remove(u)} aria-label="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty />
          )}
        </div>
      </div>

      <PatientForm open={editOpen} patient={patient} onClose={() => setEditOpen(false)} onSaved={load} />
      <UsageForm open={usageOpen} patient={patient} onClose={() => setUsageOpen(false)} onSaved={load} />
    </div>
  );
}
