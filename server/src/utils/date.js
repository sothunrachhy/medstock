import { HttpError } from './http.js';

// All "days" in the system are Cambodia days (UTC+7, no DST).
export const TZ = 'Asia/Phnom_Penh';
const OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Date -> 'YYYY-MM-DD' (Cambodia time) */
export function toDayStr(date) {
  return new Date(new Date(date).getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

export function todayStr() {
  return toDayStr(new Date());
}

/** 'YYYY-MM-DD' -> Date at 00:00 Cambodia time */
export function dayStart(str) {
  return new Date(`${str}T00:00:00+07:00`);
}

/** Accepts 'YYYY-MM-DD' or any date string, returns the start of that Cambodia day. */
export function parseDay(value, field = 'date') {
  if (value instanceof Date) return dayStart(toDayStr(value));
  if (typeof value === 'string' && DAY_RE.test(value)) {
    const d = dayStart(value);
    if (!Number.isNaN(d.getTime())) return d;
  } else if (value) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return dayStart(toDayStr(d));
  }
  throw new HttpError(400, `Invalid ${field}`);
}

export function addDays(date, n) {
  return new Date(date.getTime() + n * DAY_MS);
}

/** Exclusive end of the day given as 'YYYY-MM-DD' (or Date) */
export function dayEnd(value) {
  return addDays(parseDay(value), 1);
}

export function listDays(fromStr, toStr) {
  const days = [];
  for (let d = dayStart(fromStr); d <= dayStart(toStr); d = addDays(d, 1)) days.push(toDayStr(d));
  return days;
}

/** Reads ?from=&to= (YYYY-MM-DD). Defaults to today. */
export function parseRange(query, maxDays = 400) {
  const from = query.from || todayStr();
  const to = query.to || from;
  const start = parseDay(from, 'from');
  const end = dayEnd(to);
  if (end <= start) throw new HttpError(400, '"to" must be on or after "from"');
  const days = Math.round((end - start) / DAY_MS);
  if (days > maxDays) throw new HttpError(400, `Date range is too long (max ${maxDays} days)`);
  return { from: toDayStr(start), to: toDayStr(addDays(end, -1)), start, end, days };
}
