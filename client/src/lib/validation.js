// Client-side form validation with the same Zod schemas the API uses (shared/schemas).
import { useCallback, useState } from 'react';

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

/** Field errors returned by the API (400 VALIDATION_ERROR). */
export const serverFieldErrors = (err) => err?.response?.data?.fields || {};

/** Field-error state for a form. */
export function useFieldErrors() {
  const [errors, setErrors] = useState({});
  const clear = useCallback((field) => setErrors((e) => (field ? { ...e, [field]: undefined } : {})), []);
  return { errors, setErrors, clear };
}
