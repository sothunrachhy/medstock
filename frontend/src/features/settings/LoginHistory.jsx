import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errMsg } from '@/lib/api';
import { loginHistory } from '@/lib/backend';
import Select from '@/components/ui/Select';
import { Badge, Empty, Loading, Pagination } from '@/components/ui';
import { useLang } from '@/app/LangContext';
import { useToast } from '@/app/ToastContext';
import { fmtDateTime } from '@/lib/dates';

function device(ua = '') {
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : ua.split('/')[0] || '—';
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return [browser, os].filter(Boolean).join(' · ');
}

export default function LoginHistory() {
  const { tr } = useLang();
  const toast = useToast();
  const [filters, setFilters] = useState({ search: '', status: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, limit: 30 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      const params = Object.fromEntries(Object.entries({ ...filters, page }).filter(([, v]) => v));
      loginHistory(params)
        .then(setData)
        .catch((e) => toast.error(errMsg(e)))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [filters, page, toast]);

  const set = (k) => (e) => {
    setFilters((f) => ({ ...f, [k]: e.target.value }));
    setPage(1);
  };

  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder={tr('ឈ្មោះអ្នកប្រើ...', 'Username...')} value={filters.search} onChange={set('search')} />
        </div>
        <Select
          className="w-auto min-w-36"
          value={filters.status}
          onChange={(v) => {
            setFilters((f) => ({ ...f, status: v }));
            setPage(1);
          }}
          options={[
            { value: '', label: tr('ទាំងអស់', 'All') },
            { value: 'SUCCESS', label: tr('ជោគជ័យ', 'Success'), dot: '#0ca30c' },
            { value: 'FAILED', label: tr('បរាជ័យ', 'Failed'), dot: '#d03b3b' },
          ]}
        />
        <input type="date" className="input w-auto" value={filters.from} onChange={set('from')} aria-label="From" />
        <span className="text-slate-400">→</span>
        <input type="date" className="input w-auto" value={filters.to} onChange={set('to')} aria-label="To" />
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
                <th>{tr('ពេលចូល', 'Login time')}</th>
                <th>{tr('អ្នកប្រើ', 'User')}</th>
                <th>{tr('លទ្ធផល', 'Result')}</th>
                <th>IP</th>
                <th>{tr('ឧបករណ៍', 'Device')}</th>
                <th>{tr('ពេលចាកចេញ', 'Logout')}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((h) => (
                <tr key={h._id}>
                  <td className="tabular-nums">{fmtDateTime(h.loginAt)}</td>
                  <td>
                    <div className="font-medium">{h.user?.fullName || h.username}</div>
                    <div className="text-xs text-slate-500">@{h.username}</div>
                  </td>
                  <td>
                    {h.status === 'SUCCESS' ? (
                      <Badge color="green">{tr('ជោគជ័យ', 'Success')}</Badge>
                    ) : (
                      <span title={h.reason}>
                        <Badge color="red">{tr('បរាជ័យ', 'Failed')}</Badge>
                        <div className="text-xs text-slate-500">{h.reason}</div>
                      </span>
                    )}
                  </td>
                  <td className="text-sm tabular-nums">{h.ip}</td>
                  <td className="text-sm" title={h.userAgent}>
                    {device(h.userAgent)}
                  </td>
                  <td className="text-sm text-slate-500 tabular-nums">{fmtDateTime(h.logoutAt) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={data.page || page} limit={data.limit} total={data.total} onChange={setPage} />
    </div>
  );
}
