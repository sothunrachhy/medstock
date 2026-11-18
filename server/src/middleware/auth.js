import jwt from 'jsonwebtoken';
import { hasPermission } from '../config/permissions.js';
import User from '../models/User.js';
import { getAuthSettings } from '../services/authSettings.js';
import { asyncHandler, HttpError } from '../utils/http.js';

export const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Please log in');

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    throw new HttpError(401, 'Your session has expired, please log in again');
  }

  // A shorter session timeout set in Settings → Auth also ends sessions that are already open.
  const { sessionTimeoutHours } = await getAuthSettings();
  if (payload.iat && Date.now() / 1000 - payload.iat > sessionTimeoutHours * 3600) {
    throw new HttpError(401, 'Your session has expired, please log in again');
  }

  // Load the user on every request so role/permission changes apply immediately.
  const user = await User.findById(payload.sub).populate('role');
  if (!user || !user.isActive) throw new HttpError(401, 'Account is disabled');
  req.user = user;
  req.sessionId = payload.sid;
  next();
});

export const authorize = (module, action = 'read') => (req, _res, next) => {
  if (hasPermission(req.user?.role, module, action)) return next();
  next(new HttpError(403, `You do not have permission to ${action} ${module}`));
};
