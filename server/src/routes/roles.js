import { Router } from 'express';
import { ACTIONS, MODULES } from '../config/permissions.js';
import { authorize } from '../middleware/auth.js';
import Role from '../models/Role.js';
import User from '../models/User.js';
import { asyncHandler, HttpError } from '../utils/http.js';
import { idParams, roleSchema, roleUpdateSchema } from '../../../shared/schemas/index.js';
import { validate } from '../middleware/validate.js';


const router = Router();

// Permissions that control who can do what. Only administrators may hand them out,
// otherwise a role manager could grant themselves full access.
const PRIVILEGED_MODULES = ['users', 'roles', 'authSettings'];

function assertCanGrant(actor, permissions) {
  if (actor.role?.isSystem) return;
  const privileged = permissions.filter((p) => PRIVILEGED_MODULES.includes(p.module)).map((p) => p.module);
  if (privileged.length) {
    throw new HttpError(403, `Only an administrator can grant these permissions: ${[...new Set(privileged)].join(', ')}`);
  }
}

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
  validate({ body: roleSchema }),
  asyncHandler(async (req, res) => {
    const { name, description, permissions } = req.body || {};
    const clean = cleanPermissions(permissions);
    assertCanGrant(req.user, clean);
    const role = await Role.create({ name, description, permissions: clean });
    res.status(201).json(role);
  }),
);

router.put(
  '/:id',
  authorize('roles', 'update'),
  validate({ params: idParams, body: roleUpdateSchema }),
  asyncHandler(async (req, res) => {
    const role = await Role.findById(req.params.id);
    if (!role) throw new HttpError(404, 'Role not found');
    if (role.isSystem) throw new HttpError(400, 'The system administrator role cannot be changed');
    if (!req.user.role?.isSystem && String(req.user.role?._id) === String(role._id)) {
      throw new HttpError(403, 'You cannot change your own role');
    }
    const { name, description, permissions } = req.body || {};
    if (name !== undefined) role.name = name;
    if (description !== undefined) role.description = description;
    if (permissions !== undefined) {
      const clean = cleanPermissions(permissions);
      // a non-admin may keep privileged permissions a role already has, but not add new ones
      const had = new Set(role.permissions.flatMap((p) => p.actions.map((a) => `${p.module}:${a}`)));
      const added = clean
        .map((p) => ({ module: p.module, actions: p.actions.filter((a) => !had.has(`${p.module}:${a}`)) }))
        .filter((p) => p.actions.length);
      assertCanGrant(req.user, added);
      role.permissions = clean;
    }
    await role.save();
    res.json(role);
  }),
);

router.delete(
  '/:id',
  authorize('roles', 'delete'),
  validate({ params: idParams }),
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
