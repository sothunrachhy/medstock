// Client-side form validation (Zod schemas in shared/schemas). The backend checks the same rules again.
import { useCallback, useState } from 'react';
import { apiFieldErrors } from '@/lib/api';
import { FIELD_NAMES } from '@/lib/backend';

/** Validates `data`. Returns { ok: true, data } or { ok: false, errors: { field: message }, message }. */
export function checkForm(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data, errors: {} };
  const errors = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    if (!errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors, message: Object.values(errors)[0] };
}

/** Field errors returned by the API (422), renamed to the form's field names ("items.0.quantity"). */
export const serverFieldErrors = (err) =>
  Object.fromEntries(
    Object.entries(apiFieldErrors(err)).map(([key, message]) => [
      key
        .split('.')
        .map((part) => FIELD_NAMES[part] || part)
        .join('.'),
      message,
    ]),
  );

/** Field-error state for a form. */
export function useFieldErrors() {
  const [errors, setErrors] = useState({});
  const clear = useCallback((field) => setErrors((e) => (field ? { ...e, [field]: undefined } : {})), []);
  return { errors, setErrors, clear };
}
