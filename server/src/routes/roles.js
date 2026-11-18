import { Router } from 'express';
import { ACTIONS, MODULES } from '../config/permissions.js';
import { authorize } from '../middleware/auth.js';
import Role from '../models/Role.js';
import User from '../models/User.js';
import { asyncHandler, HttpError } from '../utils/http.js';

const router = Router();

function cleanPermissions(input = []) {
  if (!Array.isArray(input)) throw new HttpError(400, 'permissions must be an array');
  return input
    .filter((p) => MODULES.includes(p?.module))
    .map((p) => ({ module: p.module, actions: [...new Set((p.actions || []).filter((a) => ACTIONS.includes(a)))] }))
    .filter((p) => p.actions.length);
}

router.get('/meta', (_req, res) => res.json({ modules: MODULES, actions: ACTIONS }));

router.get(
  '/',
  authorize('roles', 'read'),
  asyncHandler(async (_req, res) => {
    const [roles, counts] = await Promise.all([
      Role.find().sort({ isSystem: -1, name: 1 }).lean(),
      User.aggregate([{ $group: { _id: '$role', n: { $sum: 1 } } }]),
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.n]));
    res.json({ items: roles.map((r) => ({ ...r, id: r._id, userCount: countMap.get(String(r._id)) || 0 })) });
  }),
);

router.post(
  '/',
  authorize('roles', 'create'),
  asyncHandler(async (req, res) => {
    const { name, description, permissions } = req.body || {};
    const role = await Role.create({ name, description, permissions: cleanPermissions(permissions) });
    res.status(201).json(role);
  }),
);

router.put(
  '/:id',
  authorize('roles', 'update'),
  asyncHandler(async (req, res) => {
    const role = await Role.findById(req.params.id);
    if (!role) throw new HttpError(404, 'Role not found');
    if (role.isSystem) throw new HttpError(400, 'The system administrator role cannot be changed');
    const { name, description, permissions } = req.body || {};
    if (name !== undefined) role.name = name;
    if (description !== undefined) role.description = description;
    if (permissions !== undefined) role.permissions = cleanPermissions(permissions);
    await role.save();
    res.json(role);
  }),
);

router.delete(
  '/:id',
  authorize('roles', 'delete'),
  asyncHandler(async (req, res) => {
    const role = await Role.findById(req.params.id);
    if (!role) throw new HttpError(404, 'Role not found');
    if (role.isSystem) throw new HttpError(400, 'The system administrator role cannot be deleted');
    const users = await User.countDocuments({ role: role._id });
    if (users) throw new HttpError(409, `This role is assigned to ${users} user(s). Move them to another role first.`);
    await role.deleteOne();
    res.json({ ok: true });
  }),
);

export default router;
