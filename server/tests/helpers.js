// Integration-test helpers: a fresh medstock_test database with a few users and roles.
import mongoose from 'mongoose';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDB } from '../src/config/db.js';
import { fullPermissions } from '../src/config/permissions.js';
import Role from '../src/models/Role.js';
import User from '../src/models/User.js';

export const PASSWORD = 'Passw0rd-test';

export async function setupDb() {
  if (!/_test\b|_test\?|_test$/.test(process.env.MONGO_URI)) throw new Error('Refusing to run tests on a non-test database');
  await connectDB();
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));

  const admin = await Role.create({ name: 'Admin', isSystem: true, permissions: fullPermissions() });
  // a non-admin role that may manage users and roles (the escalation scenario)
  const manager = await Role.create({
    name: 'Manager',
    permissions: [
      { module: 'users', actions: ['read', 'create', 'update', 'delete'] },
      { module: 'roles', actions: ['read', 'create', 'update', 'delete'] },
      { module: 'patients', actions: ['read', 'create', 'update', 'delete'] },
    ],
  });
  const viewer = await Role.create({ name: 'Viewer', permissions: [{ module: 'patients', actions: ['read'] }] });

  const users = {};
  for (const [username, role] of [
    ['admin', admin],
    ['manager', manager],
    ['viewer', viewer],
  ]) {
    const u = new User({ username, fullName: username, role: role._id });
    await u.setPassword(PASSWORD);
    await u.save();
    users[username] = u;
  }
  return { roles: { admin, manager, viewer }, users };
}

export async function teardownDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

export const app = createApp();
export const api = () => request(app);

export async function login(username, password = PASSWORD) {
  const res = await api().post('/api/auth/login').send({ username, password });
  if (res.status !== 200) throw new Error(`login ${username} failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.token;
}

export const bearer = (token) => ({ Authorization: `Bearer ${token}` });
