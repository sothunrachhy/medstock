// Every screen/API group of the system is a "module". A role grants a set of
// actions per module. The built-in Admin role (isSystem) always has full access.
export const MODULES = [
  'dashboard',
  'patients',
  'medicines',
  'stock',
  'usage',
  'reports',
  'users',
  'roles',
  'loginHistory',
  'authSettings',
];

export const ACTIONS = ['read', 'create', 'update', 'delete'];

export function hasPermission(role, module, action = 'read') {
  if (!role) return false;
  if (role.isSystem) return true;
  const entry = (role.permissions || []).find((p) => p.module === module);
  return !!entry && entry.actions.includes(action);
}

export function fullPermissions() {
  return MODULES.map((module) => ({ module, actions: [...ACTIONS] }));
}
