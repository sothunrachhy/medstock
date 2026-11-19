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

export const MODULE_LABELS = {
  dashboard: ['ផ្ទាំងគ្រប់គ្រង', 'Dashboard'],
  patients: ['អ្នកជំងឺ', 'Patients'],
  medicines: ['បញ្ជីឱសថ', 'Medicine list'],
  stock: ['ស្តុកឱសថ', 'Stock'],
  usage: ['ការប្រើប្រាស់ឱសថ', 'Medicine usage'],
  reports: ['របាយការណ៍', 'Reports'],
  users: ['អ្នកប្រើប្រាស់', 'Users'],
  roles: ['តួនាទី', 'Roles'],
  loginHistory: ['ប្រវត្តិចូលប្រព័ន្ធ', 'Login history'],
  authSettings: ['ការកំណត់សុវត្ថិភាព', 'Auth settings'],
};

export const ACTION_LABELS = {
  read: ['មើល', 'Read'],
  create: ['បង្កើត', 'Create'],
  update: ['កែប្រែ', 'Update'],
  delete: ['លុប', 'Delete'],
};

export const OUT_TYPE_LABELS = {
  USAGE: ['ប្រើប្រាស់', 'Usage'],
  EXPIRED: ['ផុតកំណត់', 'Expired'],
  DAMAGED: ['ខូចខាត', 'Damaged'],
  ADJUSTMENT: ['កែតម្រូវ', 'Adjustment'],
  IN: ['ចំណូល', 'Stock in'],
};
