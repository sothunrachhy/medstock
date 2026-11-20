import { FileSpreadsheet, Printer } from 'lucide-react';
import { ORG } from '@/config/org';
import { useLang } from '@/app/LangContext';
import { exportTableToExcel } from '@/lib/exportExcel';

/** Header block used on the printed reports (same layout as the paper templates). */
export function ReportHeader({ kingdom = false, title, subtitle, refNo, left = 'full' }) {
  return (
    <div className="mb-3">
      {kingdom && (
        <div className="moul text-center leading-7">
          <div className="text-[15px]">{ORG.kingdom}</div>
          <div className="text-[14px]">{ORG.motto}</div>
        </div>
      )}
      <div className={`leading-6 ${left === 'full' ? 'moul text-[13px]' : 'text-[13px]'}`}>
        {left === 'full' && <div>{ORG.ministry}</div>}
        <div>{ORG.hospital}</div>
        <div>{ORG.department}</div>
        {refNo && <div className="font-sans">លេខ៖{refNo}</div>}
      </div>
      {title && <h2 className="moul mt-2 text-center text-[15px]">{title}</h2>}
      {subtitle && <div className="mt-1 text-center text-[13px]">{subtitle}</div>}
    </div>
  );
}

/** Row of signature captions under a report. */
export function Signatures({ names, place }) {
  return (
    <div className="mt-6">
      {place && <div className="mb-2 text-right text-[13px]">{place}</div>}
      <div className="flex justify-around gap-4 text-center text-[13px]">
        {names.map((n, i) => (
          <div key={i} className={`min-w-[110px] pb-16 ${i === 0 ? 'moul' : ''}`}>
            {n}
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportActions({ tableRef, filename, children }) {
  const { tr } = useLang();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {children}
      {tableRef && (
        <button type="button" className="btn-secondary" onClick={() => exportTableToExcel(tableRef.current, filename)}>
          <FileSpreadsheet className="h-4 w-4" /> Excel
        </button>
      )}
      <button type="button" className="btn-primary" onClick={() => window.print()}>
        <Printer className="h-4 w-4" /> {tr('បោះពុម្ព', 'Print')}
      </button>
    </div>
  );
}

/** White "paper" wrapper for a report; scrolls horizontally on small screens. */
export function Sheet({ children }) {
  return (
    <div className="card print-area overflow-x-auto">
      <div className="report-sheet min-w-[900px]">{children}</div>
    </div>
  );
}
