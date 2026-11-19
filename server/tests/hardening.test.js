import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { safeRedirect } from '../../shared/safeRedirect.js';
import Patient from '../src/models/Patient.js';
import { api, bearer, login, setupDb, teardownDb } from './helpers.js';

describe('safeRedirect (return-to page after login)', () => {
  it.each(['/patients', '/patients?page=2', '/reports/weekly', '/'])('keeps same-site path %s', (p) => {
    expect(safeRedirect(p)).toBe(p);
  });
  it.each([
    '//evil.com',
    '/\\evil.com',
    'https://evil.com',
    'javascript:alert(1)',
    '/login',
    '/login?x=1',
    '/%0a',
    '/a\nb',
    '',
    null,
    undefined,
    { pathname: '/x' },
  ])('rejects %s', (p) => {
    expect(safeRedirect(p)).toBe('/');
  });
});

describe('query string operator injection', () => {
  let token;
  beforeAll(async () => {
    await setupDb();
    token = await login('admin');
    await Patient.create([
      { name: 'A', sex: 'M', dateIn: new Date(), status: 'ADMITTED' },
      { name: 'B', sex: 'F', dateIn: new Date(), status: 'DISCHARGED' },
    ]);
  });
  afterAll(teardownDb);

  it('"status[$ne]=…" is not turned into a MongoDB operator', async () => {
    const res = await api().get('/api/patients?status[$ne]=ADMITTED').set(bearer(token));
    expect(res.status).toBe(200);
    // with the old parser this returned only the discharged patient; now the key is ignored
    expect(res.body.items.map((p) => p.name).sort()).toEqual(['A', 'B']);
  });
});
