import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLang } from '@/app/LangContext';

export function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const width = { sm: 'max-w-md', md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' }[size];
  return (
    <div className="no-print fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8">
      <div className={`card w-full ${width} my-auto`} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, required, children, hint, className = '' }) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className="label">
          {label} {required && <span className="text-rose-500">*</span>}
        </span>
      )}
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="no-print mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const BADGE = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-rose-50 text-rose-700 ring-rose-200',
  blue: 'bg-sky-50 text-sky-700 ring-sky-200',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
};
export function Badge({ color = 'slate', children }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${BADGE[color]}`}>{children}</span>;
}

export function Spinner({ className = '' }) {
  return <Loader2 className={`h-5 w-5 animate-spin text-brand-600 ${className}`} />;
}

export function Loading() {
  return (
    <div className="flex justify-center py-16">
      <Spinner className="h-7 w-7" />
    </div>
  );
}

export function Empty({ children }) {
  const { tr } = useLang();
  return <div className="py-12 text-center text-sm text-slate-400">{children || tr('មិនមានទិន្នន័យ', 'No data')}</div>;
}

// Client-side paging for lists that are already loaded in full.
// Goes back to page 1 whenever one of `resetKeys` (tab, search, filter) changes.
export function usePaged(rows, limit = 10, resetKeys = []) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), resetKeys); // eslint-disable-line react-hooks/exhaustive-deps
  const pages = Math.max(1, Math.ceil(rows.length / limit));
  const current = Math.min(page, pages); // stay valid after rows shrink (e.g. a delete)
  return {
    pageRows: rows.slice((current - 1) * limit, current * limit),
    pager: { page: current, limit, total: rows.length, onChange: setPage },
  };
}

// Page numbers to show: all when few, otherwise first, last and the neighbours of the current page.
function pageList(page, pages) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  if (page <= 3) [2, 3, 4].forEach((p) => set.add(p));
  if (page >= pages - 2) [pages - 3, pages - 2, pages - 1].forEach((p) => set.add(p));
  const sorted = [...set].sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i && p - sorted[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
}

export function Pagination({ page, limit, total, onChange }) {
  const { tr } = useLang();
  if (!total) return null;
  const pages = Math.max(1, Math.ceil(total / limit));
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const arrow =
    'inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 disabled:hover:bg-white';
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600">
      <span>
        {tr('បង្ហាញ', 'Showing')}{' '}
        <b className="font-semibold text-slate-900">
          {from}–{to}
        </b>{' '}
        {tr('នៃ', 'of')} <b className="font-semibold text-slate-900">{total}</b> {tr('លទ្ធផល', 'results')}
      </span>
      <nav className="flex items-center gap-1.5" aria-label="Pagination">
        <button type="button" className={arrow} disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label={tr('មុន', 'Previous')}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pageList(page, pages).map((p) =>
          typeof p === 'string' ? (
            <span key={p} className="px-1 text-slate-400">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 font-medium transition ${
                p === page ? 'bg-brand-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {p}
            </button>
          ),
        )}
        <button type="button" className={arrow} disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label={tr('បន្ទាប់', 'Next')}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="no-print mb-4 flex overflow-x-auto overflow-y-hidden shadow-[inset_0_-1px_0_var(--color-slate-200)]">
      {tabs.map((t) => (
        <button key={t.value} type="button" className={`tab ${value === t.value ? 'tab-active' : ''}`} onClick={() => onChange(t.value)}>
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs text-slate-500">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function StatCard({ icon: Icon, label, value, sub, tone = 'brand', onClick }) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-rose-50 text-rose-700',
    blue: 'bg-sky-50 text-sky-700',
    violet: 'bg-violet-50 text-violet-700',
  };
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} className={`card flex items-center gap-4 p-4 text-left ${onClick ? 'transition hover:border-brand-300 hover:shadow' : ''}`}>
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-sm text-slate-500">{label}</div>
        <div className="text-2xl font-semibold text-slate-900 tabular-nums">{value}</div>
        {sub && <div className="truncate text-xs text-slate-400">{sub}</div>}
      </div>
    </Tag>
  );
}
