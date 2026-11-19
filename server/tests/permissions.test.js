import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, bearer, login, setupDb, teardownDb } from './helpers.js';

let ctx;
let adminToken;
let managerToken;

beforeAll(async () => {
  ctx = await setupDb();
  adminToken = await login('admin');
  managerToken = await login('manager');
});
afterAll(teardownDb);

describe('admin accounts are protected from non-admins', () => {
  it('a manager cannot create an administrator', async () => {
    const res = await api()
      .post('/api/users')
      .set(bearer(managerToken))
      .send({ username: 'evil', fullName: 'Evil', password: 'whatever123', role: String(ctx.roles.admin._id) });
    expect(res.status).toBe(403);
  });

  it('a manager cannot promote a user to administrator', async () => {
    const res = await api()
      .put(`/api/users/${ctx.users.viewer.id}`)
      .set(bearer(managerToken))
      .send({ role: String(ctx.roles.admin._id) });
    expect(res.status).toBe(403);
  });

  it("a manager cannot reset an administrator's password or disable them", async () => {
    const pw = await api().put(`/api/users/${ctx.users.admin.id}`).set(bearer(managerToken)).send({ password: 'takeover123' });
    expect(pw.status).toBe(403);
    const off = await api().put(`/api/users/${ctx.users.admin.id}`).set(bearer(managerToken)).send({ isActive: false });
    expect(off.status).toBe(403);
    const del = await api().delete(`/api/users/${ctx.users.admin.id}`).set(bearer(managerToken));
    expect(del.status).toBe(403);
  });

  it('a manager does not see the administrator role as an option', async () => {
    const res = await api().get('/api/users/role-options').set(bearer(managerToken));
    expect(res.status).toBe(200);
    expect(res.body.items.some((r) => r.isSystem)).toBe(false);
  });

  it('a manager can still manage normal users', async () => {
    const res = await api()
      .post('/api/users')
      .set(bearer(managerToken))
      .send({ username: 'nurse1', fullName: 'Nurse One', password: 'nursepass1', role: String(ctx.roles.viewer._id) });
    expect(res.status).toBe(201);
  });

  it('an administrator can create another administrator', async () => {
    const res = await api()
      .post('/api/users')
      .set(bearer(adminToken))
      .send({ username: 'admin2', fullName: 'Admin Two', password: 'adminpass2', role: String(ctx.roles.admin._id) });
    expect(res.status).toBe(201);
  });
});

describe('roles cannot be used to escalate', () => {
  it('a manager cannot edit their own role', async () => {
    const res = await api()
      .put(`/api/roles/${ctx.roles.manager._id}`)
      .set(bearer(managerToken))
      .send({ permissions: [{ module: 'authSettings', actions: ['read', 'update'] }] });
    expect(res.status).toBe(403);
  });

  it('a manager cannot grant user/role/auth-settings management to any role', async () => {
    const res = await api()
      .put(`/api/roles/${ctx.roles.viewer._id}`)
      .set(bearer(managerToken))
      .send({ permissions: [{ module: 'users', actions: ['read', 'update'] }] });
    expect(res.status).toBe(403);
    const created = await api()
      .post('/api/roles')
      .set(bearer(managerToken))
      .send({ name: 'Sneaky', permissions: [{ module: 'roles', actions: ['update'] }] });
    expect(created.status).toBe(403);
  });

  it('a manager can still edit ordinary permissions of other roles', async () => {
    const res = await api()
      .put(`/api/roles/${ctx.roles.viewer._id}`)
      .set(bearer(managerToken))
      .send({ permissions: [{ module: 'patients', actions: ['read', 'create'] }] });
    expect(res.status).toBe(200);
  });

  it('an administrator can grant any permission', async () => {
    const res = await api()
      .put(`/api/roles/${ctx.roles.viewer._id}`)
      .set(bearer(adminToken))
      .send({ permissions: [{ module: 'users', actions: ['read'] }] });
    expect(res.status).toBe(200);
  });
});
