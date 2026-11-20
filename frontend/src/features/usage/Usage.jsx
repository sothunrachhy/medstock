import { Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { errMsg } from '@/lib/api';
import { usage as usageApi } from '@/lib/backend';
import { medLabel, PeriodPicker } from '@/components/pickers';
import { Badge, Empty, Loading, PageHeader, Pagination } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import Select from '@/components/ui/Select';
import { CATEGORY_COLORS, CATEGORY_LABELS, PAYMENT_LABELS, useLang } from '@/app/LangContext';
import { useToast } from '@/app/ToastContext';
import { fmtDate, fmtDateTime, periodRange, todayStr } from '@/lib/dates';
import UsageForm from './UsageForm';

export const CAT_BADGE = { INJECTION: 'blue', PILL: 'amber', NARCOTIC: 'violet' };

export default function Usage() {
  const { tr } = useLang();
  const { can } = useAuth();
  const toast = useToast();
  const [pp, setPp] = useState({ period: 'daily', date: todayStr() });
  const [category, setCategory] = useState('');
  const [payment, setPayment] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, limit: 50 });
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(() => {
    const { from, to } = periodRange(pp.period, pp.date);
    setLoading(true);
    usageApi
      .list({ from, to, categories: category || undefined, payment: payment || undefined, page, limit: 50 })
      .then(setData)
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setLoading(false));
  }, [pp, category, payment, page, toast]);
  useEffect(load, [load]);

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

  return (
    <div>
      <PageHeader
        title={tr('ការប្រើប្រាស់ឱសថ', 'Medicine usage')}
        subtitle={tr('កត់ត្រាឱសថដែលបានផ្តល់ឱ្យអ្នកជំងឺ', 'Medicines given to patients')}
        actions={
          can('usage', 'create') && (
            <button className="btn-primary" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> {tr('កត់ត្រាការប្រើប្រាស់', 'Record usage')}
            </button>
          )
        }
      />
      <div className="card">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <PeriodPicker
            period={pp.period}
            date={pp.date}
            onChange={(v) => {
              setPp(v);
              setPage(1);
            }}
          />
          <Select
            className="w-auto min-w-44"
            value={category}
            onChange={(v) => {
              setCategory(v);
              setPage(1);
            }}
            menuWidth={240}
            options={[
              { value: '', label: tr('គ្រប់ប្រភេទ', 'All categories') },
              ...Object.entries(CATEGORY_LABELS).map(([c, l]) => ({ value: c, label: tr(...l), dot: CATEGORY_COLORS[c] })),
            ]}
          />
          <Select
            className="w-auto min-w-44"
            value={payment}
            onChange={(v) => {
              setPayment(v);
              setPage(1);
            }}
            menuWidth={300}
            options={[
              { value: '', label: tr('គ្រប់ការបង់ប្រាក់', 'All payments') },
              ...Object.entries(PAYMENT_LABELS).map(([p, l]) => ({ value: p, label: tr(...l.label) })),
            ]}
          />
        </div>
        {loading ? (
          <Loading />
        ) : !data.items.length ? (
          <Empty />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{tr('កាលបរិច្ឆេទ', 'Date')}</th>
                  <th>{tr('អ្នកជំងឺ', 'Patient')}</th>
                  <th>{tr('ឱសថ', 'Medicine')}</th>
                  <th className="text-right">{tr('ចំនួន', 'Qty')}</th>
                  <th>{tr('វេន', 'Shift')}</th>
                  <th>{tr('ការបង់ប្រាក់', 'Payment')}</th>
                  <th>{tr('គ្រូពេទ្យ', 'Doctor')}</th>
                  <th>{tr('អ្នកកត់ត្រា', 'Recorded by')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((u) => (
                  <tr key={u._id}>
                    <td className="tabular-nums">{fmtDate(u.date)}</td>
                    <td>
                      {u.patient ? (
                        <Link className="text-brand-700 hover:underline" to={`/patients/${u.patient._id}`}>
                          {u.patient.name}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <div className="font-medium">
                        {medLabel(u.medicine)} <span className="text-xs font-normal text-slate-500">{u.medicine?.form}</span>
                      </div>
                      <Badge color={CAT_BADGE[u.medicine?.category]}>{tr(...(CATEGORY_LABELS[u.medicine?.category] || ['']))}</Badge>
                    </td>
                    <td className="text-right font-semibold tabular-nums">{u.quantity}</td>
                    <td>{u.shift === 'DAY' ? tr('ថ្ងៃ', 'Day') : u.shift === 'NIGHT' ? tr('យប់', 'Night') : ''}</td>
                    <td>{PAYMENT_LABELS[u.payment] && <Badge color={PAYMENT_LABELS[u.payment].badge}>{tr(...PAYMENT_LABELS[u.payment].short)}</Badge>}</td>
                    <td>{u.doctor}</td>
                    <td className="text-xs text-slate-500">
                      {u.createdBy?.fullName}
                      <div>{fmtDateTime(u.createdAt)}</div>
                    </td>
                    <td className="text-right">
                      {can('usage', 'delete') && (
                        <button className="btn-icon hover:text-rose-600" onClick={() => remove(u)} title={tr('លុប', 'Delete')}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={data.page || page} limit={data.limit} total={data.total} onChange={setPage} />
      </div>
      <UsageForm open={formOpen} onClose={() => setFormOpen(false)} defaultDate={pp.period === 'daily' ? pp.date : undefined} onSaved={load} />
    </div>
  );
}
