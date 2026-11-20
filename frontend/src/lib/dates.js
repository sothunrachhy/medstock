// All dates are Cambodia days (Asia/Phnom_Penh), exchanged with the API as 'YYYY-MM-DD'.
const TZ = 'Asia/Phnom_Penh';
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });

export const toDayStr = (d) => (d ? dayFmt.format(new Date(d)) : '');
export const todayStr = () => toDayStr(new Date());

const parse = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fmt = (date) => date.toISOString().slice(0, 10);

export function addDays(dayStr, n) {
  const d = parse(dayStr);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}

/** 'YYYY-MM-DD' → 'DD/MM/YYYY' */
export function fmtDate(value) {
  if (!value) return '';
  const s = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : toDayStr(value);
  const [y, m, d] = s.split('-');
  return `${d}/${m}/${y}`;
}

export function fmtDateTime(value) {
  if (!value) return '';
  return `${fmtDate(value)} ${timeFmt.format(new Date(value))}`;
}

export function daysUntil(value) {
  const diff = parse(toDayStr(value)) - parse(todayStr());
  return Math.round(diff / 86400000);
}

/** Period → { from, to } (weeks run Monday–Sunday). */
export function periodRange(period, dayStr) {
  if (period === 'weekly') {
    const dow = parse(dayStr).getUTCDay(); // 0 = Sunday
    const from = addDays(dayStr, -((dow + 6) % 7));
    return { from, to: addDays(from, 6) };
  }
  if (period === 'monthly') {
    const [y, m] = dayStr.split('-').map(Number);
    const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
    return { from: `${dayStr.slice(0, 7)}-01`, to: `${dayStr.slice(0, 7)}-${String(last).padStart(2, '0')}` };
  }
  return { from: dayStr, to: dayStr };
}

/** Moves the anchor date one period back/forward. */
export function shiftPeriod(period, dayStr, dir) {
  if (period === 'weekly') return addDays(dayStr, 7 * dir);
  if (period === 'monthly') {
    const [y, m] = dayStr.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + dir, 1));
    return fmt(d);
  }
  return addDays(dayStr, dir);
}
