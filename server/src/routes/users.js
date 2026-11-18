import { Router } from 'express';
import { authorize } from '../middleware/auth.js';
import Role from '../models/Role.js';
import User from '../models/User.js';
import { assertPasswordPolicy } from '../services/authSettings.js';
import { asyncHandler, escapeRegex, HttpError } from '../utils/http.js';

const router = Router();

async function ensureRole(roleId) {
  const role = await Role.findById(roleId);
  if (!role) throw new HttpError(400, 'Role not found');
  return role;
}

router.get(
  '/',
  authorize('users', 'read'),
  asyncHandler(async (req, res) => {
    const filter = {};
    if (req.query.search) {
      const re = new RegExp(escapeRegex(req.query.search), 'i');
      filter.$or = [{ username: re }, { fullName: re }];
    }
    const users = await User.find(filter).populate('role').sort({ createdAt: 1 });
    res.json({ items: users.map((u) => u.toPublic()) });
  }),
);

// Role choices for the user form (doesn't require the "roles" permission).
router.get(
  '/role-options',
  authorize('users', 'read'),
  asyncHandler(async (_req, res) => {
    const roles = await Role.find({}, 'name isSystem').sort({ isSystem: -1, name: 1 }).lean();
    res.json({ items: roles });
  }),
);

router.post(
  '/',
  authorize('users', 'create'),
  asyncHandler(async (req, res) => {
    const { username, fullName, password, role, isActive = true } = req.body || {};
    await ensureRole(role);
    await assertPasswordPolicy(password);
    const user = new User({ username, fullName, role, isActive });
    await user.setPassword(password);
    await user.save();
    await user.populate('role');
    res.status(201).json(user.toPublic());
  }),
);

router.put(
  '/:id',
  authorize('users', 'update'),
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id);
    if (!user) throw new HttpError(404, 'User not found');
    const { fullName, role, isActive, password, username, unlock } = req.body || {};
    const isSelf = user.id === req.user.id;

    if (username !== undefined) user.username = username;
    if (fullName !== undefined) user.fullName = fullName;
    if (role !== undefined && String(role) !== String(user.role)) {
      if (isSelf) throw new HttpError(400, 'You cannot change your own role');
      await ensureRole(role);
      user.role = role;
    }
    if (isActive !== undefined) {
      if (isSelf && !isActive) throw new HttpError(400, 'You cannot disable your own account');
      user.isActive = !!isActive;
    }
    if (password) {
      await assertPasswordPolicy(password);
      await user.setPassword(password);
    }
    // an admin unlocking the account, or setting a new password, clears the lockout
    if (unlock || password) {
      user.lockedUntil = undefined;
      user.failedLoginCount = 0;
    }
    await user.save();
    await user.populate('role');
    res.json(user.toPublic());
  }),
);

router.delete(
  '/:id',
  authorize('users', 'delete'),
  asyncHandler(async (req, res) => {
    if (req.params.id === req.user.id) throw new HttpError(400, 'You cannot delete your own account');
    const user = await User.findById(req.params.id).populate('role');
    if (!user) throw new HttpError(404, 'User not found');
    if (user.role?.isSystem) {
      const admins = await User.countDocuments({ role: user.role._id, isActive: true });
      if (admins <= 1) throw new HttpError(400, 'Cannot delete the last administrator');
    }
    await user.deleteOne();
    res.json({ ok: true });
  }),
);

export default router;
