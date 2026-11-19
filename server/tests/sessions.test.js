import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clearAuthSettingsCache, getAuthSettings } from '../src/services/authSettings.js';
import Setting from '../src/models/Setting.js';
import { api, bearer, login, PASSWORD, setupDb, teardownDb } from './helpers.js';

let ctx;
beforeAll(async () => {
  ctx = await setupDb();
});
afterAll(teardownDb);

const me = (token) => api().get('/api/auth/me').set(bearer(token));

describe('login sessions can be ended', () => {
  it('a token stops working after logout', async () => {
    const token = await login('viewer');
    expect((await me(token)).status).toBe(200);
    expect((await api().post('/api/auth/logout').set(bearer(token))).status).toBe(200);
    expect((await me(token)).status).toBe(401);
  });

  it('changing your password signs out other devices but keeps this one', async () => {
    const phone = await login('viewer');
    const laptop = await login('viewer');
    const res = await api()
      .post('/api/auth/change-password')
      .set(bearer(laptop))
      .send({ currentPassword: PASSWORD, newPassword: 'brand-new-pass-1' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect((await me(phone)).status).toBe(401);
    expect((await me(laptop)).status).toBe(401); // the old token of this device is replaced...
    expect((await me(res.body.token)).status).toBe(200); // ...by the new one
    await login('viewer', 'brand-new-pass-1');
  });

  it('an administrator resetting a password ends that user’s sessions', async () => {
    const managerToken = await login('manager');
    const adminToken = await login('admin');
    const res = await api().put(`/api/users/${ctx.users.manager.id}`).set(bearer(adminToken)).send({ password: 'reset-by-admin-1' });
    expect(res.status).toBe(200);
    expect((await me(managerToken)).status).toBe(401);
  });

  it('disabling an account ends its sessions', async () => {
    const managerToken = await login('manager', 'reset-by-admin-1');
    const adminToken = await login('admin');
    await api().put(`/api/users/${ctx.users.manager.id}`).set(bearer(adminToken)).send({ isActive: false });
    expect((await me(managerToken)).status).toBe(401);
  });

  it('a forged or tampered token is rejected', async () => {
    const token = await login('admin');
    const tampered = token.slice(0, -2) + (token.endsWith('a') ? 'bb' : 'aa');
    expect((await me(tampered)).status).toBe(401);
    expect((await api().get('/api/auth/me')).status).toBe(401);
  });
});

describe('auth settings cache', () => {
  it('picks up changes saved by another server instance', async () => {
    clearAuthSettingsCache();
    expect((await getAuthSettings()).lockoutMinutes).toBe(15);
    // simulate another instance writing the setting directly
    await Setting.updateOne({ key: 'auth' }, { value: { lockoutMinutes: 30 } }, { upsert: true });
    clearAuthSettingsCache(); // in production this happens after 60 s
    expect((await getAuthSettings()).lockoutMinutes).toBe(30);
    await Setting.deleteOne({ key: 'auth' });
    clearAuthSettingsCache();
  });
});
