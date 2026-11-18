import { AlertTriangle, CalendarClock, ClipboardList, PackageX, Pill, RefreshCw, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api, { errMsg } from '../api/client';
import { medLabel } from '../components/pickers';
import { Badge, Empty, Loading, PageHeader, StatCard } from '../components/ui';
import { CATEGORY_COLORS, CATEGORY_LABELS, useLang } from '../context/LangContext';
import { useToast } from '../context/ToastContext';
import { daysUntil, fmtDate } from '../utils/dates';

// Reserved status palette (always shown with a text label).
const STATUS_COLORS = { OK: '#0ca30c', LOW: '#fab219', OUT: '#d03b3b' };
const AXIS = { fontSize: 12, fill: '#52514e' };
const GRID = '#e7e5e4';

function ChartCard({ title, subtitle, children, className = '' }) {
  return (
    <div className={`card p-4 ${className}`}>
      <div className="mb-3">
        <h3 className="font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

const tooltipStyle = { borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,.08)' };

export default function Dashboard() {
  const { tr } = useLang();
  const toast = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api
      .get('/dashboard')
      .then((r) => setData(r.data))
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !data) return <Loading />;
  if (!data) return <Empty />;
  const k = data.kpis;
  const SHORT = { INJECTION: ['ថ្នាំចាក់', 'Injection'], PILL: ['ថ្នាំគ្រាប់', 'Pills'], NARCOTIC: ['ថ្នាំញៀន', 'Narcotic'] };
  const catName = (c) => tr(...(SHORT[c] || CATEGORY_LABELS[c]));
  const trend = data.trend.map((t) => ({ ...t, label: t.date.slice(8, 10) + '/' + t.date.slice(5, 7) }));
  const statusData = data.stockByCategory.map((c) => ({ ...c, name: catName(c.category) }));

  return (
    <div className="space-y-5">
      <PageHeader
        title={tr('ផ្ទាំងគ្រប់គ្រង', 'Dashboard')}
        subtitle={`${tr('ស្ថានភាពឱសថ និងស្តុក', 'Medicine status & stock')} · ${fmtDate(data.today)}`}
        actions={
          <button className="btn-secondary" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> {tr('ធ្វើបច្ចុប្បន្នភាព', 'Refresh')}
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard icon={Users} label={tr('អ្នកជំងឺកំពុងសម្រាក', 'Admitted patients')} value={k.admitted} sub={`${tr('ចូលថ្ងៃនេះ', 'New today')}: ${k.admittedToday}`} onClick={() => navigate('/patients')} />
        <StatCard
          icon={ClipboardList}
          tone="blue"
          label={tr('ឱសថប្រើថ្ងៃនេះ', 'Units used today')}
          value={k.usageToday}
          sub={`${k.patientsTreatedToday} ${tr('នាក់', 'patients')} · ${k.usageEntriesToday} ${tr('ដង', 'entries')}`}
          onClick={() => navigate('/usage')}
        />
        <StatCard icon={Pill} tone="violet" label={tr('ចំនួនមុខឱសថ', 'Medicines in list')} value={k.medicines} onClick={() => navigate('/stock')} />
        <StatCard icon={AlertTriangle} tone="amber" label={tr('ស្តុកជិតអស់', 'Low stock')} value={k.lowStock} sub={tr('ទាបជាងកម្រិតអប្បបរមា', 'At or below minimum')} onClick={() => navigate('/stock?status=LOW')} />
        <StatCard icon={PackageX} tone="red" label={tr('អស់ស្តុក', 'Out of stock')} value={k.outOfStock} onClick={() => navigate('/stock?status=OUT')} />
        <StatCard
          icon={CalendarClock}
          tone="amber"
          label={tr('ជិតផុតកំណត់', 'Near expiry (batches)')}
          value={k.expiringBatches}
          sub={`${tr('ក្នុងរយៈពេល', 'Within')} ${data.expiryWarnDays} ${tr('ថ្ងៃ', 'days')} · ${tr('ផុតកំណត់', 'Expired')}: ${k.expiredBatches}`}
          onClick={() => navigate('/stock?status=EXPIRING')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard className="xl:col-span-2" title={tr('ការប្រើប្រាស់ឱសថ ១៤ ថ្ងៃចុងក្រោយ', 'Medicine usage – last 14 days')} subtitle={tr('ចំនួនឯកតា (អំពូល/ដប/គ្រាប់)', 'Units dispensed (amp / vial / tablet)')}>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={trend} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={GRID} />
                <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: GRID }} />
                <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(15,23,42,.05)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                {['INJECTION', 'PILL', 'NARCOTIC'].map((c, i, arr) => (
                  <Bar key={c} dataKey={c} name={catName(c)} stackId="u" fill={CATEGORY_COLORS[c]} stroke="#fff" strokeWidth={1} radius={i === arr.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={28} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title={tr('ស្ថានភាពស្តុកតាមប្រភេទ', 'Stock status by category')} subtitle={tr('ចំនួនមុខឱសថ', 'Number of medicines')}>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={statusData} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
                <CartesianGrid horizontal={false} stroke={GRID} />
                <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={AXIS} tickLine={false} axisLine={false} width={96} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(15,23,42,.05)' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="OK" name={tr('គ្រប់គ្រាន់', 'OK')} stackId="s" fill={STATUS_COLORS.OK} stroke="#fff" strokeWidth={1} maxBarSize={26} />
                <Bar dataKey="LOW" name={tr('ជិតអស់', 'Low')} stackId="s" fill={STATUS_COLORS.LOW} stroke="#fff" strokeWidth={1} maxBarSize={26} />
                <Bar dataKey="OUT" name={tr('អស់', 'Out')} stackId="s" fill={STATUS_COLORS.OUT} stroke="#fff" strokeWidth={1} radius={[0, 4, 4, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title={tr('ឱសថប្រើច្រើនបំផុត (ខែនេះ)', 'Most used this month')} subtitle={tr('១០ មុខដំបូង', 'Top 10')}>
          {data.topUsed.length ? (
            <div className="h-80">
              <ResponsiveContainer>
                <BarChart data={data.topUsed} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid horizontal={false} stroke={GRID} />
                  <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ ...AXIS, fontSize: 11 }} tickLine={false} axisLine={false} width={130} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(15,23,42,.05)' }} formatter={(v) => [v, tr('ចំនួន', 'Quantity')]} />
                  <Bar dataKey="quantity" fill={CATEGORY_COLORS.INJECTION} radius={[0, 4, 4, 0]} maxBarSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Empty />
          )}
        </ChartCard>

        <ChartCard title={tr('ស្តុកជិតអស់ / អស់', 'Low / out of stock')} subtitle={tr('បញ្ជាទិញបន្ថែម', 'Needs re-ordering')}>
          <div className="max-h-80 overflow-y-auto">
            {data.lowStock.length ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>{tr('ឱសថ', 'Medicine')}</th>
                    <th className="text-right">{tr('សល់', 'Left')}</th>
                    <th className="text-right">{tr('អប្បបរមា', 'Min')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lowStock.map((m) => (
                    <tr key={m._id}>
                      <td>
                        <div className="font-medium">{medLabel(m)}</div>
                        <div className="text-xs text-slate-500">{catName(m.category)}</div>
                      </td>
                      <td className="text-right tabular-nums">
                        <Badge color={m.status === 'OUT' ? 'red' : 'amber'}>{m.usable}</Badge>
                      </td>
                      <td className="text-right text-slate-500 tabular-nums">{m.minStock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty>{tr('ស្តុកគ្រប់គ្រាន់', 'All stock levels OK')}</Empty>
            )}
          </div>
        </ChartCard>

        <ChartCard title={tr('ឱសថជិតផុតកំណត់', 'Nearly expired medicine')} subtitle={`${tr('ក្នុងរយៈពេល', 'Within')} ${data.expiryWarnDays} ${tr('ថ្ងៃ', 'days')}`}>
          <div className="max-h-80 overflow-y-auto">
            {data.expiring.length ? (
              <table className="table">
                <thead>
                  <tr>
                    <th>{tr('ឱសថ', 'Medicine')}</th>
                    <th className="text-right">{tr('សល់', 'Left')}</th>
                    <th className="text-right">{tr('ផុតកំណត់', 'Expires')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.expiring.map((b) => {
                    const d = daysUntil(b.expiryDate);
                    return (
                      <tr key={b._id}>
                        <td>
                          <div className="font-medium">{medLabel(b.medicine)}</div>
                          <div className="text-xs text-slate-500">{b.batchNo && `#${b.batchNo}`}</div>
                        </td>
                        <td className="text-right tabular-nums">{b.remaining}</td>
                        <td className="text-right">
                          <div className="tabular-nums">{fmtDate(b.expiryDate)}</div>
                          <Badge color={d < 0 ? 'red' : d <= 30 ? 'amber' : 'slate'}>{d < 0 ? tr('ផុតកំណត់', 'Expired') : `${d} ${tr('ថ្ងៃ', 'days')}`}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <Empty>{tr('គ្មានឱសថជិតផុតកំណត់', 'Nothing expiring soon')}</Empty>
            )}
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
