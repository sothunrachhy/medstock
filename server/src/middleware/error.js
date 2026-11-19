import { HttpError } from '../utils/http.js';

export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, ...err.extra });
  }
  if (err?.name === 'ValidationError') {
    const message = Object.values(err.errors).map((e) => e.message).join(', ');
    return res.status(400).json({ message });
  }
  if (err?.name === 'CastError') {
    return res.status(400).json({ message: `Invalid ${err.path}` });
  }
  if (err?.code === 11000) {
    const fields = Object.keys(err.keyValue || {}).join(', ');
    return res.status(409).json({ message: `A record with the same ${fields} already exists` });
  }
  if (err?.status && err.status < 500) {
    return res.status(err.status).json({ message: err.message });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Invalid JSON body' });
  }
  console.error(err);
  res.status(500).json({ message: 'Internal server error' });
}
