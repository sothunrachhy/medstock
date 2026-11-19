import { HttpError } from '../utils/http.js';

/** Turns Zod issues into { "field.path": "message" } (first message per field). */
export function issuesToFields(issues, prefix = '') {
  const fields = {};
  for (const issue of issues) {
    const key = [prefix, ...issue.path].filter((p) => p !== '').join('.') || prefix || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

/**
 * Validates and normalises req.body / req.query / req.params with Zod schemas.
 * On success the parsed values replace the originals (unknown body fields are dropped).
 * On failure: 400 { message, code: 'VALIDATION_ERROR', fields }.
 */
export const validate =
  ({ body, query, params } = {}) =>
  (req, _res, next) => {
    let fields = {};
    const run = (schema, value, prefix) => {
      const result = schema.safeParse(value ?? {});
      if (result.success) return result.data;
      fields = { ...fields, ...issuesToFields(result.error.issues, prefix) };
      return undefined;
    };
    const parsed = {
      params: params && run(params, req.params, 'params'),
      query: query && run(query, req.query, ''),
      body: body && run(body, req.body, ''),
    };
    const keys = Object.keys(fields);
    if (keys.length) {
      return next(new HttpError(400, fields[keys[0]], { code: 'VALIDATION_ERROR', fields }));
    }
    if (params) req.params = parsed.params;
    if (query) req.query = parsed.query;
    if (body) req.body = parsed.body;
    next();
  };
