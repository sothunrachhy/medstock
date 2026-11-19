import { Eye, Filter, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import Select from '@/components/ui/Select';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg } from '@/lib/api';
import { Badge, Empty, Loading, PageHeader, Pagination } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { useLang } from '@/app/LangContext';
import { useToast } from '@/app/ToastContext';
import { fmtDate } from '@/lib/dates';
import PatientForm from './PatientForm';

export default function Patients() {
  const { tr } = useLang();
  const { can } = useAuth();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, limit: 10 });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | {} | patient

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get('/patients', { params: { search: query || undefined, status: status || undefined, page, limit: 10 } })
      .then((r) => setData(r.data))
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => setLoading(false));
  }, [query, status, page, toast]);

  useEffect(load, [load]);

  const remove = async (p) => {
    if (!window.confirm(tr(`លុបអ្នកជំងឺ "${p.name}"?`, `Delete patient "${p.name}"?`))) return;
    try {
      await api.delete(`/patients/${p._id}`);
      toast(tr('បានលុប', 'Deleted'));
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div>
      <PageHeader
        title={tr('អ្នកជំងឺ', 'Patients')}
        subtitle={tr('បញ្ជីអ្នកជំងឺក្នុងផ្នែក', 'Patients in the department')}
        actions={
          can('patients', 'create') && (
            <button className="btn-primary" onClick={() => setEditing({})}>
              <Plus className="h-4 w-4" /> {tr('បញ្ចូលអ្នកជំងឺ', 'Add patient')}
            </button>
          )
        }
      />

      <div className="card">
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder={tr('ស្វែងរកតាមឈ្មោះ លេខកូដ ឬរោគវិនិច្ឆ័យ...', 'Search by name, ID or diagnosis...')} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select
            className="w-auto min-w-44"
            icon={Filter}
            value={status}
            onChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
            options={[
              { value: '', label: tr('ទាំងអស់', 'All') },
              { value: 'ADMITTED', label: tr('កំពុងសម្រាកព្យាបាល', 'Admitted') },
              { value: 'DISCHARGED', label: tr('បានចេញ', 'Discharged') },
            ]}
          />
        </div>

        {loading ? (
          <Loading />
        ) : data.items.length === 0 ? (
          <Empty />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{tr('ឈ្មោះ', 'Name')}</th>
                  <th>{tr('ភេទ', 'Sex')}</th>
                  <th>{tr('អាយុ', 'Age')}</th>
                  <th>{tr('រោគវិនិច្ឆ័យ', 'Diagnosis')}</th>
                  <th>{tr('ខេត្ត', 'Province')}</th>
                  <th>{tr('ថ្ងៃចូល', 'Date in')}</th>
                  <th>{tr('ស្ថានភាព', 'Status')}</th>
                  <th className="w-28"></th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p._id}>
                    <td>
                      <Link to={`/patients/${p._id}`} className="font-medium text-brand-700 hover:underline">
                        {p.name}
                      </Link>
                      {p.code && <div className="text-xs text-slate-500">{p.code}</div>}
                    </td>
                    <td>{p.sex === 'M' ? tr('ប្រុស', 'M') : tr('ស្រី', 'F')}</td>
                    <td className="tabular-nums">{p.age ?? ''}</td>
                    <td className="max-w-xs truncate">{p.diagnosis}</td>
                    <td>{p.province}</td>
                    <td className="tabular-nums">{fmtDate(p.dateIn)}</td>
                    <td>
                      {p.status === 'ADMITTED' ? (
                        <Badge color="green">{tr('កំពុងព្យាបាល', 'Admitted')}</Badge>
                      ) : (
                        <Badge>
                          {tr('ចេញ', 'Out')} {fmtDate(p.dateOut)}
                        </Badge>
                      )}
                    </td>
                    <td className="text-right whitespace-nowrap">
                      <Link to={`/patients/${p._id}`} className="btn-icon" title={tr('មើល', 'View')}>
                        <Eye className="h-4 w-4" />
                      </Link>
                      {can('patients', 'update') && (
                        <button className="btn-icon" onClick={() => setEditing(p)} title={tr('កែប្រែ', 'Edit')}>
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      {can('patients', 'delete') && (
                        <button className="btn-icon hover:text-rose-600" onClick={() => remove(p)} title={tr('លុប', 'Delete')}>
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

      <PatientForm open={!!editing} patient={editing?._id ? editing : null} onClose={() => setEditing(null)} onSaved={load} />
    </div>
  );
}
