import { HttpError } from '../utils/http.js';

// Every error response has the same shape: { message, code, fields? }.
const CODES = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  423: 'LOCKED',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

const send = (res, status, message, extra = {}) =>
  res.status(status).json({ message, code: extra.code || CODES[status] || 'ERROR', ...extra });

const isDatabaseDown = (err) =>
  ['MongoServerSelectionError', 'MongoNetworkError', 'MongoNetworkTimeoutError', 'MongooseServerSelectionError'].includes(err?.name) ||
  // Atlas authentication failure (wrong MONGO_URI user/password)
  (err?.name === 'MongoServerError' && [18, 8000].includes(err.code));

export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) return send(res, err.status, err.message, err.extra);

  if (err?.name === 'ValidationError' && err.errors) {
    const fields = Object.fromEntries(Object.entries(err.errors).map(([k, e]) => [k, e.message]));
    return send(res, 400, Object.values(fields)[0] || 'Invalid data', { code: 'VALIDATION_ERROR', fields });
  }
  if (err?.name === 'CastError' || err?.name === 'BSONError') {
    return send(res, 400, `Invalid ${err.path || 'ID'}`, { code: 'INVALID_ID' });
  }
  if (err?.code === 11000) {
    const fields = Object.keys(err.keyValue || {});
    return send(res, 409, `A record with the same ${fields.join(', ')} already exists`, { code: 'DUPLICATE' });
  }
  if (err?.type === 'entity.parse.failed') return send(res, 400, 'Invalid JSON body', { code: 'INVALID_JSON' });
  if (err?.type === 'entity.too.large') return send(res, 413, 'Request is too large');
  if (isDatabaseDown(err)) {
    console.error('Database unavailable:', err.name, err.code ?? '', err.message);
    return send(res, 503, 'The database is not reachable right now. Please try again in a moment.', { code: 'DATABASE_UNAVAILABLE' });
  }
  if (err?.status && err.status < 500) return send(res, err.status, err.message);

  // unexpected: log the details on the server only
  console.error(err);
  return send(res, 500, 'Internal server error');
}
