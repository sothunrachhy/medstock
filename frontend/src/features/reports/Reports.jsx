import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader, Tabs } from '@/components/ui';
import Select from '@/components/ui/Select';
import { CATEGORY_COLORS, useLang } from '@/app/LangContext';
import DailySheet from './DailySheet';
import DailyStock from './DailyStock';
import MedicineReport from './MedicineReport';
import NarcoticReport from './NarcoticReport';
import PatientReport from './PatientReport';
import WeeklyReport from './WeeklyReport';

export default function Reports() {
  const { tr } = useLang();
  const { tab = 'weekly' } = useParams();
  const navigate = useNavigate();
  const tabs = [
    { value: 'weekly', label: tr('សំណើប្រចាំសប្តាហ៍', 'Weekly request'), el: <WeeklyReport /> },
    { value: 'stock', label: tr('ស្តុកប្រចាំថ្ងៃ', 'Daily stock'), el: <DailyStock /> },
    { value: 'daily-sheet', label: tr('ឱសថប្រចាំថ្ងៃ (តាមអ្នកជំងឺ)', 'Daily sheet (per patient)'), el: <DailySheet /> },
    { value: 'narcotic', label: tr('ថ្នាំញៀន', 'Narcotics'), el: <NarcoticReport /> },
    { value: 'medicine', label: tr('តាមឱសថ', 'By medicine'), el: <MedicineReport /> },
    { value: 'patient', label: tr('តាមអ្នកជំងឺ', 'By patient'), el: <PatientReport /> },
  ];
  const current = tabs.find((t) => t.value === tab) || tabs[0];
  return (
    <div>
      <PageHeader title={tr('របាយការណ៍', 'Reports')} subtitle={tr('គណនាដោយស្វ័យប្រវត្តិ — បោះពុម្ព ឬនាំចេញជា Excel', 'Calculated automatically — print or export to Excel')} />
      <Tabs tabs={tabs} value={current.value} onChange={(v) => navigate(`/reports/${v}`)} />
      {current.el}
    </div>
  );
}

/** Category choices used by the reports. Narcotics are injections, so they are included there. */
export const REPORT_CATEGORIES = [
  { value: 'INJECTION,NARCOTIC', km: 'ថ្នាំចាក់', en: 'Injections' },
  { value: 'PILL', km: 'ថ្នាំគ្រាប់', en: 'Pills' },
  { value: 'NARCOTIC', km: 'ថ្នាំញៀន', en: 'Narcotics' },
  { value: 'INJECTION,PILL,NARCOTIC', km: 'ទាំងអស់', en: 'All' },
];

const DOTS = { 'INJECTION,NARCOTIC': CATEGORY_COLORS.INJECTION, PILL: CATEGORY_COLORS.PILL, NARCOTIC: CATEGORY_COLORS.NARCOTIC };

export function CategorySelect({ value, onChange, options = REPORT_CATEGORIES }) {
  const { tr } = useLang();
  return (
    <Select
      className="w-auto min-w-38"
      value={value}
      onChange={onChange}
      aria-label={tr('ប្រភេទឱសថ', 'Medicine type')}
      options={options.map((o) => ({ value: o.value, label: tr(o.km, o.en), dot: DOTS[o.value] || '#94a3b8' }))}
    />
  );
}

export const categoryKm = (value) => REPORT_CATEGORIES.find((c) => c.value === value)?.km || '';
