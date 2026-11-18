const KH_DIGITS = ['០', '១', '២', '៣', '៤', '៥', '៦', '៧', '៨', '៩'];
export const KH_MONTHS = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];

export const khNum = (value) => String(value ?? '').replace(/\d/g, (d) => KH_DIGITS[d]);

/** 'YYYY-MM-DD' → { day: '០៩', month: 'វិច្ឆិកា', year: '២០២៦' } */
export function khDateParts(dayStr) {
  const [y, m, d] = dayStr.split('-');
  return { day: khNum(d), month: KH_MONTHS[Number(m) - 1], year: khNum(y) };
}

/** 'YYYY-MM-DD' → 'ថ្ងៃទី០៩ ខែ វិច្ឆិកា ឆ្នាំ២០២៦' */
export function khDate(dayStr) {
  const p = khDateParts(dayStr);
  return `ថ្ងៃទី${p.day} ខែ ${p.month} ឆ្នាំ${p.year}`;
}

/** Zero-padded quantity like the paper reports ("05", "00"); blank for empty. */
export const pad2 = (n) => (n === null || n === undefined || n === '' ? '' : n < 0 ? `-${String(-n).padStart(2, '0')}` : String(n).padStart(2, '0'));
