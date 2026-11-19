import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { authenticate, authorize } from '../middleware/auth.js';
import LoginHistory from '../models/LoginHistory.js';
import User from '../models/User.js';
import { assertPasswordPolicy, getAuthSettings, updateAuthSettings } from '../services/authSettings.js';
import { asyncHandler, HttpError } from '../utils/http.js';
import { authSettingsSchema, changePasswordSchema, loginSchema } from '../../../shared/schemas/index.js';
import { validate } from '../middleware/validate.js';


const router = Router();

// Per-IP limit on top of the per-account lockout from Settings → Auth.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many login attempts from this computer, please try again in 15 minutes', code: 'TOO_MANY_REQUESTS' },
});

const minutesLeft = (date) => Math.max(1, Math.ceil((date - Date.now()) / 60000));

// sub = user, sid = login session (LoginHistory), tv = user.tokenVersion
const signToken = (user, sessionId, settings) =>
  jwt.sign({ sub: user.id, sid: String(sessionId), tv: user.tokenVersion || 0 }, process.env.JWT_SECRET, {
    expiresIn: `${settings.sessionTimeoutHours}h`,
  });

router.post(
  '/login',
  loginLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const { username, password } = req.body;

    const settings = await getAuthSettings();
    const uname = username;
    const meta = { username: uname, ip: req.ip, userAgent: req.get('user-agent') || '' };
    const fail = (reason, user) => LoginHistory.create({ ...meta, user: user?._id, status: 'FAILED', reason });
    const user = await User.findOne({ username: uname }).select('+passwordHash').populate('role');

    if (user?.isLocked()) {
      await fail('Account locked', user);
      throw new HttpError(423, `Account is locked after too many failed logins. Try again in ${minutesLeft(user.lockedUntil)} minute(s) or ask an administrator to unlock it.`, {
        code: 'ACCOUNT_LOCKED',
        lockedUntil: user.lockedUntil,
      });
    }

    if (!user || !(await user.checkPassword(password))) {
      if (user && settings.maxFailedAttempts > 0) {
        user.failedLoginCount = (user.failedLoginCount || 0) + 1;
        if (user.failedLoginCount >= settings.maxFailedAttempts) {
          user.lockedUntil = new Date(Date.now() + settings.lockoutMinutes * 60000);
          user.failedLoginCount = 0;
          await user.save();
          await fail(`Wrong password – account locked for ${settings.lockoutMinutes} min`, user);
          throw new HttpError(423, `Too many failed logins. The account is locked for ${settings.lockoutMinutes} minute(s).`, {
            code: 'ACCOUNT_LOCKED',
            lockedUntil: user.lockedUntil,
          });
        }
        await user.save();
      }
      await fail('Invalid username or password', user);
      throw new HttpError(401, 'Invalid username or password');
    }

    if (!user.isActive) {
      await fail('Account disabled', user);
      throw new HttpError(403, 'Account is disabled');
    }

    const session = await LoginHistory.create({ ...meta, user: user._id, status: 'SUCCESS' });
    user.lastLoginAt = new Date();
    user.failedLoginCount = 0;
    user.lockedUntil = undefined;
    await user.save();

    res.json({ token: signToken(user, session.id, settings), user: user.toPublic() });
  }),
);

router.get('/me', authenticate, (req, res) => res.json({ user: req.user.toPublic() }));

// Password rule shown in the forms.
router.get(
  '/policy',
  authenticate,
  asyncHandler(async (_req, res) => {
    const { minPasswordLength } = await getAuthSettings();
    res.json({ minPasswordLength });
  }),
);

router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    if (req.sessionId) await LoginHistory.updateOne({ _id: req.sessionId, user: req.user._id }, { logoutAt: new Date() });
    res.json({ ok: true });
  }),
);

router.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  asyncHandler(async (req, res) => {
    const { currentPassword, newPassword } = req.body || {};
    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!(await user.checkPassword(currentPassword))) throw new HttpError(400, 'Current password is incorrect');
    if (currentPassword === newPassword) throw new HttpError(400, 'The new password must be different from the current one');
    await assertPasswordPolicy(newPassword);
    await user.setPassword(newPassword);
    // signs out every other device; this session gets a fresh token
    user.revokeSessions();
    await user.save();
    res.json({ ok: true, token: signToken(user, req.sessionId, await getAuthSettings()) });
  }),
);

// ---- Settings → Auth -------------------------------------------------------

router.get(
  '/settings',
  authenticate,
  authorize('authSettings', 'read'),
  asyncHandler(async (_req, res) => res.json(await getAuthSettings())),
);

router.put(
  '/settings',
  authenticate,
  authorize('authSettings', 'update'),
  validate({ body: authSettingsSchema }),
  asyncHandler(async (req, res) => res.json(await updateAuthSettings(req.body, req.user._id))),
);

export default router;
