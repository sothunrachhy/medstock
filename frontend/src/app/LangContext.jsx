import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const LangContext = createContext(null);
const KEY = 'medstock_lang';

function readLang() {
  try {
    return localStorage.getItem(KEY) || 'km';
  } catch {
    return 'km';
  }
}

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(readLang);
  const setLang = useCallback((l) => {
    setLangState(l);
    try {
      localStorage.setItem(KEY, l);
    } catch {
      /* ignore */
    }
  }, []);
  // tr('ខ្មែរ', 'English') → text in the current language
  const tr = useCallback((km, en) => (lang === 'en' ? en ?? km : km), [lang]);
  const value = useMemo(() => ({ lang, setLang, tr }), [lang, setLang, tr]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

// Shared labels
export const CATEGORY_LABELS = {
  INJECTION: ['ថ្នាំចាក់', 'Injection'],
  PILL: ['ថ្នាំគ្រាប់', 'Pills'],
  NARCOTIC: ['ថ្នាំញៀន (បំបាត់ការឈឺចាប់)', 'Narcotic pain killer'],
};

// Validated categorical slots 1–3 (also used by the dashboard charts)
export const CATEGORY_COLORS = { INJECTION: '#2a78d6', PILL: '#eb6834', NARCOTIC: '#1baf7a' };

// Permission modules of the backend (role permissions are set per module)
export const MODULE_LABELS = {
  DASHBOARD: ['ផ្ទាំងគ្រប់គ្រង', 'Dashboard'],
  PATIENT: ['អ្នកជំងឺ', 'Patients'],
  DISPENSING: ['ការប្រើប្រាស់ឱសថ', 'Medicine usage'],
  STOCK: ['ស្តុក និងបញ្ជីឱសថ', 'Stock & medicine list'],
  REPORT: ['របាយការណ៍', 'Reports'],
  SETTING: ['ការកំណត់ (អ្នកប្រើប្រាស់ តួនាទី ប្រវត្តិចូល)', 'Settings (users, roles, login history)'],
};

// Built-in roles of the backend
export const ROLE_LABELS = {
  ADMIN: ['អ្នកគ្រប់គ្រង', 'Administrator'],
  PHARMACIST: ['ឱសថការី', 'Pharmacist'],
  NURSE: ['គិលានុបដ្ឋាក', 'Nurse'],
  VIEWER: ['អ្នកមើល', 'Viewer'],
};

export const ACTION_LABELS = {
  read: ['មើល', 'Read'],
  create: ['បង្កើត', 'Create'],
  update: ['កែប្រែ', 'Update'],
  delete: ['លុប', 'Delete'],
};

// Payment types: short = table/badge, label + hint = the choice in the usage form
export const PAYMENT_LABELS = {
  CASH: { short: ['សាច់ប្រាក់', 'Cash'], label: ['សាច់ប្រាក់', 'Cash'], hint: ['ប្រាក់រៀល និងដុល្លារ', 'Riel and dollar'], badge: 'green' },
  NSSF: { short: ['ប.ស.ស', 'NSSF'], label: ['បណ្ណ ប.ស.ស', 'NSSF card'], hint: ['NSSF', 'National Social Security Fund'], badge: 'blue' },
  HEF: {
    short: ['បណ្ណក្រីក្រ', 'HEF'],
    label: ['បណ្ណមូលនិធិសមធម៌សុខាភិបាល', 'Health Equity Fund card'],
    hint: ['បណ្ណក្រីក្រ / IDPoor', 'IDPoor card'],
    badge: 'amber',
  },
};

export const OUT_TYPE_LABELS = {
  USAGE: ['ប្រើប្រាស់', 'Usage'],
  EXPIRED: ['ផុតកំណត់', 'Expired'],
  DAMAGED: ['ខូចខាត', 'Damaged'],
  ADJUSTMENT: ['កែតម្រូវ', 'Adjustment'],
  IN: ['ចំណូល', 'Stock in'],
};
