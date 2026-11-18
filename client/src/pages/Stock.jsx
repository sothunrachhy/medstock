import { Filter, Plus, Search } from 'lucide-react';
import Select from '../components/Select';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { medLabel, useMedicines } from '../components/pickers';
import { Badge, Empty, Loading, PageHeader, Pagination, Tabs, usePaged } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { CATEGORY_LABELS, useLang } from '../context/LangContext';
import { fmtDate } from '../utils/dates';
import MedicineStockDetail, { ExpiryBadge } from './MedicineStockDetail';
import StockInForm from './StockInForm';

const CATS = ['INJECTION', 'PILL', 'NARCOTIC'];

export default function Stock() {
  const { tr } = useLang();
  const { can } = useAuth();
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const category = CATS.includes(params.category?.toUpperCase()) ? params.category.toUpperCase() : 'INJECTION';
  const status = searchParams.get('status') || '';
  const [search, setSearch] = useState('');
  const { items, loading, reload } = useMedicines({ withStock: true });
  const [detail, setDetail] = useState(null);
  const [stockIn, setStockIn] = useState(null); // { medicineId? }

  // keep the open detail in sync after reloads
  useEffect(() => {
    if (detail) setDetail(items.find((m) => m._id === detail._id) || null);
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => Object.fromEntries(CATS.map((c) => [c, items.filter((m) => m.category === c && m.isActive).length])), [items]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((m) => {
      if (m.category !== category) return false;
      if (q && !`${m.name} ${m.strength} ${m.form}`.toLowerCase().includes(q)) return false;
      if (status === 'LOW') return m.status === 'LOW';
      if (status === 'OUT') return m.status === 'OUT';
      if (status === 'EXPIRING') return m.expiringQty > 0 || m.expiredQty > 0;
      if (status === 'IN') return m.balance > 0;
      return true;
    });
  }, [items, category, search, status]);
  const { pageRows, pager } = usePaged(rows, 10, [category, search, status]);

  const statusBadge = (m) =>
    m.status === 'OUT' ? <Badge color="red">{tr('អស់ស្តុក', 'Out')}</Badge> : m.status === 'LOW' ? <Badge color="amber">{tr('ជិតអស់', 'Low')}</Badge> : <Badge color="green">{tr('គ្រប់គ្រាន់', 'OK')}</Badge>;

  return (
    <div>
      <PageHeader
        title={tr('ស្តុកឱសថ', 'Stock of medicine')}
        subtitle={tr('ចំនួនសល់ និងថ្ងៃផុតកំណត់ (ដកចេញតាមលំដាប់ផុតកំណត់មុន)', 'Balances and expiry (dispensed first-expiry-first-out)')}
        actions={
          can('stock', 'create') && (
            <button className="btn-primary" onClick={() => setStockIn({})}>
              <Plus className="h-4 w-4" /> {tr('បញ្ចូលស្តុកថ្មី', 'Insert new stock')}
            </button>
          )
        }
      />

      <Tabs
        value={category}
        onChange={(c) => navigate(`/stock/${c.toLowerCase()}${status ? `?status=${status}` : ''}`)}
        tabs={CATS.map((c) => ({ value: c, label: tr(...CATEGORY_LABELS[c]), count: counts[c] }))}
      />

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder={tr('ស្វែងរកឱសថ...', 'Search medicine...')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select
            className="w-auto min-w-44"
            icon={Filter}
            value={status}
            onChange={(v) => setSearchParams(v ? { status: v } : {})}
            options={[
              { value: '', label: tr('ទាំងអស់', 'All') },
              { value: 'IN', label: tr('មានក្នុងស្តុក', 'In stock'), dot: '#0ca30c' },
              { value: 'LOW', label: tr('ជិតអស់', 'Low stock'), dot: '#fab219' },
              { value: 'OUT', label: tr('អស់ស្តុក', 'Out of stock'), dot: '#d03b3b' },
              { value: 'EXPIRING', label: tr('ជិតផុតកំណត់ / ផុតកំណត់', 'Near expiry / expired'), dot: '#ec835a' },
            ]}
          />
        </div>
        {loading ? (
          <Loading />
        ) : !rows.length ? (
          <Empty />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-12">{tr('ល.រ', 'No.')}</th>
                  <th>{tr('ឈ្មោះឱសថ', 'Medicine')}</th>
                  <th>{tr('ប្រភេទ', 'Form')}</th>
                  <th>{tr('កម្រិត', 'Strength')}</th>
                  <th className="text-right">{tr('ចំនួនសល់', 'Balance')}</th>
                  <th className="text-right">{tr('អប្បបរមា', 'Min')}</th>
                  <th>{tr('ផុតកំណត់ឆាប់បំផុត', 'Nearest expiry')}</th>
                  <th>{tr('ស្ថានភាព', 'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((m) => (
                  <tr key={m._id} className={`cursor-pointer ${m.isActive ? '' : 'opacity-50'}`} onClick={() => setDetail(m)}>
                    <td className="text-slate-400 tabular-nums">{m.order}</td>
                    <td className="font-medium">{m.name}</td>
                    <td>{m.form}</td>
                    <td>{m.strength}</td>
                    <td className="text-right font-semibold tabular-nums">
                      {m.balance}
                      {m.expiredQty > 0 && <div className="text-xs font-normal text-rose-600">{tr(`ផុតកំណត់ ${m.expiredQty}`, `${m.expiredQty} expired`)}</div>}
                    </td>
                    <td className="text-right text-slate-500 tabular-nums">{m.minStock}</td>
                    <td>
                      {m.nearestExpiry ? (
                        <span className="flex items-center gap-2">
                          <span className="tabular-nums">{fmtDate(m.nearestExpiry)}</span>
                          <ExpiryBadge date={m.nearestExpiry} />
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td>{statusBadge(m)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination {...pager} />
          </div>
        )}
      </div>

      <MedicineStockDetail medicine={detail} onClose={() => setDetail(null)} onChanged={reload} onAddStock={(m) => setStockIn({ medicineId: m._id, category: m.category })} />
      <StockInForm open={!!stockIn} category={stockIn?.category || category} medicineId={stockIn?.medicineId} onClose={() => setStockIn(null)} onSaved={reload} />
    </div>
  );
}
