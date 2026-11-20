// Validation schemas used by the forms (the backend checks the same rules again).
// Body schemas strip unknown fields; query schemas reject repeated / nested keys.
import { z } from 'zod';
import {
  bool,
  cambodiaToday,
  categoriesQuery,
  day,
  int,
  MAX,
  recordId,
  roleCode,
  optionalDay,
  optionalText,
  pagingQuery,
  rangeQuery,
  searchQuery,
  text,
} from './common.js';

export * from './common.js';

export const CATEGORIES = ['INJECTION', 'PILL', 'NARCOTIC'];
export const WRITE_OFF_TYPES = ['EXPIRED', 'DAMAGED', 'ADJUSTMENT'];
// How the patient pays: cash (riel or dollar), NSSF card, Health Equity Fund card (IDPoor)
export const PAYMENT_TYPES = ['CASH', 'NSSF', 'HEF'];

// ---- auth -----------------------------------------------------------------

export const loginSchema = z.object({
  username: z
    .string({ required_error: 'Username is required', invalid_type_error: 'Username is required' })
    .trim()
    .toLowerCase()
    .min(1, 'Username is required')
    .max(50, 'Username is too long'),
  password: z
    .string({ required_error: 'Password is required', invalid_type_error: 'Password is required' })
    .min(1, 'Password is required')
    .max(MAX.password, 'Password is too long'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string({ required_error: 'Current password is required' }).min(1, 'Current password is required').max(MAX.password),
  newPassword: z.string({ required_error: 'New password is required' }).min(1, 'New password is required').max(MAX.password, 'Password is too long'),
});

// ---- users & roles --------------------------------------------------------

const username = z
  .string({ required_error: 'Username is required' })
  .trim()
  .toLowerCase()
  .min(3, 'Username must be at least 3 characters')
  .max(50, 'Username is too long (max 50 characters)')
  .regex(/^[a-z0-9._-]+$/, 'Username may only contain letters, numbers, dot, dash and underscore');

const newPassword = z
  .string({ invalid_type_error: 'Password must be text' })
  .max(MAX.password, 'Password is too long')
  .optional()
  .transform((v) => v || undefined);

export const userCreateSchema = z.object({
  username,
  fullName: text('Full name', MAX.name),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required').max(MAX.password, 'Password is too long'),
  role: roleCode('Role'),
  isActive: bool.optional(),
});

export const userUpdateSchema = z.object({
  username: username.optional(),
  fullName: text('Full name', MAX.name).optional(),
  password: newPassword,
  role: roleCode('Role').optional(),
  isActive: bool.optional(),
  unlock: bool.optional(),
});

const permission = z.object({
  module: z.string().max(40),
  actions: z.array(z.string().max(20)).max(10),
});

export const roleSchema = z.object({
  name: text('Role name', MAX.short),
  description: optionalText('Description', MAX.text),
  permissions: z.array(permission, { invalid_type_error: 'permissions must be a list' }).max(50).optional(),
});
export const roleUpdateSchema = roleSchema.partial();

// ---- patients -------------------------------------------------------------

// '' / null clear the age; a missing field leaves it unchanged
const age = z
  .union([z.literal(''), z.null(), int('Age', { min: 0, max: 150 })])
  .transform((v) => (v === '' || v === null ? null : v))
  .optional();

const patientFields = {
  code: optionalText('Patient ID', MAX.code),
  name: text('Patient name', MAX.name),
  sex: z.enum(['M', 'F'], { errorMap: () => ({ message: 'Choose the sex (M or F)' }) }),
  age,
  diagnosis: optionalText('Diagnosis', MAX.text),
  province: optionalText('Address / province', MAX.label),
  dateIn: day('Date in').optional(),
  dateOut: optionalDay('Date out'),
  status: z.enum(['ADMITTED', 'DISCHARGED']).optional(),
  note: optionalText('Note', MAX.text),
};

const dateOutAfterIn = (p) => !p.dateIn || !p.dateOut || p.dateOut >= p.dateIn;
const dateOutRule = { message: 'Date out cannot be before date in', path: ['dateOut'] };

export const patientSchema = z.object(patientFields).refine(dateOutAfterIn, dateOutRule);
export const patientUpdateSchema = z.object(patientFields).partial().refine(dateOutAfterIn, dateOutRule);

export const patientListQuery = z.object({
  ...pagingQuery,
  ...rangeQuery,
  search: searchQuery,
  status: z.enum(['ADMITTED', 'DISCHARGED']).optional(),
});

// ---- medicines ------------------------------------------------------------

const medicineFields = {
  name: text('Medicine name', MAX.name),
  formCode: z.string({ required_error: 'Choose a form', invalid_type_error: 'Choose a form' }).min(1, 'Choose a form').max(50),
  strength: optionalText('Strength', MAX.short),
  category: z.enum(CATEGORIES, { errorMap: () => ({ message: 'Choose a category' }) }),
  order: z
    .union([z.literal(''), z.null(), int('No.', { min: 0, max: 100000 })])
    .transform((v) => (v === '' || v === null ? undefined : v))
    .optional(),
  minStock: int('Minimum stock', { min: 0, max: 1_000_000 }).optional(),
  isActive: bool.optional(),
  note: optionalText('Note', MAX.text),
};
export const medicineSchema = z.object(medicineFields);
export const medicineUpdateSchema = z.object(medicineFields).partial();

export const medicineListQuery = z.object({
  category: categoriesQuery,
  categories: categoriesQuery,
  active: z.enum(['all', 'true', 'false']).optional(),
  search: searchQuery,
  withStock: z.string().max(5).optional(),
});

// ---- stock ----------------------------------------------------------------

const quantity = (label = 'Quantity') => int(label, { min: 1, max: 1_000_000 });

export const stockLineSchema = z
  .object({
    medicine: recordId('Medicine'),
    quantity: quantity(),
    receivedDate: day('Input date').optional(),
    expiryDate: day('Expiry date'),
    batchNo: optionalText('Batch number', MAX.code),
    source: optionalText('Source', MAX.label),
    note: optionalText('Note', MAX.text),
  })
  .refine((l) => !l.receivedDate || l.expiryDate > l.receivedDate, {
    message: 'Expiry date must be after the input date',
    path: ['expiryDate'],
  });

export const stockInSchema = z.preprocess(
  // accepts { items: [...] } or a single line
  (v) => (v && typeof v === 'object' && !Array.isArray(v) && !('items' in v) ? { items: [v] } : v),
  z.object({ items: z.array(stockLineSchema).min(1, 'Add at least one medicine').max(200, 'Too many lines (max 200)') }),
);

export const batchUpdateSchema = z.object({
  quantity: quantity().optional(),
  receivedDate: day('Input date').optional(),
  expiryDate: day('Expiry date').optional(),
  batchNo: optionalText('Batch number', MAX.code),
  source: optionalText('Source', MAX.label),
  note: optionalText('Note', MAX.text),
});

export const writeOffSchema = z.object({
  batch: recordId('Batch'),
  quantity: quantity(),
  type: z.enum(WRITE_OFF_TYPES, { errorMap: () => ({ message: 'Invalid write-off type' }) }).default('EXPIRED'),
  date: day('Date').optional(),
  note: optionalText('Note', MAX.text),
});

export const batchListQuery = z.object({
  ...pagingQuery,
  medicine: recordId('Medicine').optional(),
  status: z.enum(['all', 'available', 'expiring', 'expired']).optional(),
  days: z.coerce.number().int().min(1).max(3650).optional(),
});

export const movementsQuery = z.object({
  medicine: recordId('Medicine'),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

// ---- usage ----------------------------------------------------------------

export const usageSchema = z
  .object({
    patient: recordId('Patient'),
    date: day('Date').optional(),
    shift: z.enum(['DAY', 'NIGHT', '']).default(''),
    payment: z.enum(PAYMENT_TYPES, { errorMap: () => ({ message: 'Select how the patient pays' }) }),
    doctor: optionalText('Doctor', MAX.label),
    note: optionalText('Note', MAX.text),
    items: z
      .array(z.object({ medicine: recordId('Medicine'), quantity: quantity() }), { required_error: 'Add at least one medicine' })
      .min(1, 'Add at least one medicine')
      .max(100, 'Too many lines (max 100)'),
  })
  .refine((u) => !u.date || u.date <= cambodiaToday(), { message: 'Usage date cannot be in the future', path: ['date'] });

export const usageListQuery = z.object({
  ...pagingQuery,
  ...rangeQuery,
  patient: recordId('Patient').optional(),
  medicine: recordId('Medicine').optional(),
  categories: categoriesQuery,
  payment: z.enum(PAYMENT_TYPES).optional(),
  type: z.enum(['USAGE', ...WRITE_OFF_TYPES]).optional(),
});

// ---- reports --------------------------------------------------------------

export const reportRangeQuery = z.object({
  ...rangeQuery,
  date: day('Date').optional(),
  categories: categoriesQuery,
  medicine: recordId('Medicine').optional(),
  patient: recordId('Patient').optional(),
  allColumns: z.enum(['0', '1']).optional(),
});

const requested = z.coerce.number().min(0, 'Quantities cannot be negative').max(1_000_000);
export const requisitionSchema = z.object({
  categories: z.union([z.string().max(100), z.array(z.string().max(20)).max(5)]).optional(),
  from: day('From'),
  to: day('To'),
  items: z
    .array(z.object({ medicine: recordId('Medicine'), requested: requested.default(0), provided: requested.default(0) }))
    .max(1000)
    .default([]),
  note: optionalText('Note', MAX.text),
});

// ---- login history ----------------------------------------------------------

export const loginHistoryQuery = z.object({
  ...pagingQuery,
  ...rangeQuery,
  status: z.enum(['SUCCESS', 'FAILED']).optional(),
  user: recordId('User').optional(),
  search: searchQuery,
});

export const usersQuery = z.object({ search: searchQuery });
