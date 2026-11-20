// Building blocks for the validation schemas used by the forms (the API applies the same rules, see API.md).
import { z } from 'zod';

/** Maximum lengths of text fields. */
export const MAX = {
  name: 120, // patient, medicine, user full name
  code: 40, // patient ID, batch number
  short: 60, // form, strength, role name
  label: 120, // province, doctor, supplier
  text: 500, // diagnosis, notes, descriptions
  search: 100,
  password: 200,
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
// Records are identified by UUIDs, roles by their code (e.g. PHARMACIST)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLE_CODE_RE = /^[A-Z0-9_]{2,50}$/;
const HTML_TAG_RE = /<\/?[a-z][^>]*>/gi;

/** Today's date in Cambodia (UTC+7) as YYYY-MM-DD. */
export function cambodiaToday(now = new Date()) {
  return new Date(now.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Trim, normalise Unicode (Khmer combining marks) and strip HTML tags. */
export function cleanText(value) {
  return String(value).normalize('NFC').replace(HTML_TAG_RE, '').trim();
}

/** Required text. */
export const text = (label, max) =>
  z
    .string({ required_error: `${label} is required`, invalid_type_error: `${label} must be text` })
    .transform(cleanText)
    .pipe(z.string().min(1, `${label} is required`).max(max, `${label} is too long (max ${max} characters)`));

/** Optional text: missing / null become '' (or stay missing on updates). */
export const optionalText = (label, max) =>
  z
    .union([z.string({ invalid_type_error: `${label} must be text` }), z.null()])
    .transform((v) => (v === null ? '' : cleanText(v)))
    .pipe(z.string().max(max, `${label} is too long (max ${max} characters)`))
    .optional();

export const recordId = (label = 'ID') =>
  z
    .string({ required_error: `${label} is required`, invalid_type_error: `${label} is invalid` })
    .regex(UUID_RE, `${label} is invalid`);

export const roleCode = (label = 'Role') =>
  z
    .string({ required_error: `${label} is required`, invalid_type_error: `${label} is invalid` })
    .regex(ROLE_CODE_RE, `${label} is invalid`);

const isRealDay = (s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/** A calendar day as YYYY-MM-DD. */
export const day = (label = 'Date') =>
  z
    .string({ required_error: `${label} is required`, invalid_type_error: `${label} must be a date` })
    .regex(DAY_RE, `${label} must be a date (YYYY-MM-DD)`)
    .refine(isRealDay, `${label} is not a valid date`);

/** Optional day. '' and null become null ("clear this date"); a missing field stays missing. */
export const optionalDay = (label) =>
  z
    .union([z.literal(''), z.null(), day(label)])
    .transform((v) => v || null)
    .optional();

export const int = (label, { min = 0, max = 1_000_000 } = {}) =>
  z.coerce
    .number({ invalid_type_error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(min, min === 1 ? `${label} must be at least 1` : `${label} must be ${min} or more`)
    .max(max, `${label} must be ${max} or less`);

export const bool = z.union([z.boolean(), z.enum(['true', 'false']).transform((v) => v === 'true')]);

// ---- query strings --------------------------------------------------------

export const pagingQuery = {
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
};

export const searchQuery = z.string().max(MAX.search, 'Search text is too long').optional();

export const rangeQuery = {
  from: day('From').optional(),
  to: day('To').optional(),
};

export const categoriesQuery = z.string().max(100).optional();

export const idParams = z.object({ id: recordId() });
