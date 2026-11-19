import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cambodiaToday, patientSchema, stockInSchema, usageSchema } from '../../shared/schemas/index.js';
import { checkEnv } from '../src/config/env.js';
import Medicine from '../src/models/Medicine.js';
import Patient from '../src/models/Patient.js';
import { api, bearer, login, setupDb, teardownDb } from './helpers.js';

const ID = '0123456789abcdef01234567';
const tomorrow = () => {
  const d = new Date(`${cambodiaToday()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

describe('shared schemas', () => {
  it('trims text, strips HTML tags and normalises Unicode', () => {
    const r = patientSchema.parse({ name: '  <b>Sok</b> <script>x</script>Dara  ', sex: 'M' });
    expect(r.name).toBe('Sok xDara');
  });
  it('rejects text over the maximum length', () => {
    const r = patientSchema.safeParse({ name: 'x'.repeat(121), sex: 'F' });
    expect(r.success).toBe(false);
    expect(r.error.issues[0].message).toMatch(/too long/);
  });
  it('rejects impossible dates and date out before date in', () => {
    expect(patientSchema.safeParse({ name: 'A', sex: 'M', dateIn: '2026-02-30' }).success).toBe(false);
    const r = patientSchema.safeParse({ name: 'A', sex: 'M', dateIn: '2026-11-10', dateOut: '2026-11-09' });
    expect(r.success).toBe(false);
    expect(r.error.issues[0].path).toEqual(['dateOut']);
  });
  it('treats empty age / date out as "clear"', () => {
    const r = patientSchema.parse({ name: 'A', sex: 'M', age: '', dateOut: '' });
    expect(r.age).toBeNull();
    expect(r.dateOut).toBeNull();
  });
  it('requires a positive whole quantity and a valid medicine id', () => {
    const r = usageSchema.safeParse({ patient: ID, items: [{ medicine: 'nope', quantity: 0 }] });
    const paths = r.error.issues.map((i) => i.path.join('.'));
    expect(paths).toEqual(expect.arrayContaining(['items.0.medicine', 'items.0.quantity']));
    expect(usageSchema.safeParse({ patient: ID, items: [{ medicine: ID, quantity: 1.5 }] }).success).toBe(false);
  });
  it('accepts a single stock line or a list', () => {
    expect(stockInSchema.parse({ medicine: ID, quantity: 5, expiryDate: '2030-01-01' }).items).toHaveLength(1);
    expect(stockInSchema.safeParse({ items: [] }).success).toBe(false);
  });
});

describe('environment check', () => {
  const good = { JWT_SECRET: 'x'.repeat(40), MONGO_URI: 'mongodb://127.0.0.1/medstock' };
  it('accepts a valid configuration', () => expect(checkEnv(good).ok).toBe(true));
  it('reports missing or weak secrets without showing their value', () => {
    expect(checkEnv({}).errors.join()).toMatch(/JWT_SECRET/);
    const r = checkEnv({ JWT_SECRET: 'short-secret' });
    expect(r.errors.join()).toMatch(/at least 32/);
    expect(r.errors.join()).not.toContain('short-secret');
  });
  it('requires MONGO_URI and a real secret in production', () => {
    const r = checkEnv({ NODE_ENV: 'production', JWT_SECRET: 'change-me-to-a-long-random-string' });
    expect(r.errors.join()).toMatch(/MONGO_URI is required/);
    expect(r.errors.join()).toMatch(/example value/);
  });
  it('validates CLIENT_ORIGIN', () => {
    expect(checkEnv({ ...good, CLIENT_ORIGIN: 'https://a.example' }).ok).toBe(true);
    expect(checkEnv({ ...good, CLIENT_ORIGIN: 'not a url' }).ok).toBe(false);
  });
});

describe('API validation', () => {
  let token;
  let medicine;
  let patient;
  beforeAll(async () => {
    await setupDb();
    token = await login('admin');
    medicine = await Medicine.create({ name: 'Paracetamol', form: 'FL', strength: '1g', category: 'INJECTION' });
    patient = await Patient.create({ name: 'Test', sex: 'M', dateIn: new Date('2026-01-01T00:00:00+07:00') });
  });
  afterAll(teardownDb);
  const auth = () => bearer(token);

  it('returns field errors in one consistent shape', async () => {
    const res = await api().post('/api/patients').set(auth()).send({ sex: 'X' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR', fields: { name: expect.any(String), sex: expect.any(String) } });
    expect(typeof res.body.message).toBe('string');
  });

  it('drops unknown body fields', async () => {
    const res = await api().post('/api/patients').set(auth()).send({ name: 'Keo', sex: 'F', createdBy: ID, _id: ID });
    expect(res.status).toBe(201);
    expect(res.body._id).not.toBe(ID);
    expect(res.body.createdBy).not.toBe(ID);
  });

  it('can clear a discharge date when editing', async () => {
    const created = await api().post('/api/patients').set(auth()).send({ name: 'Out', sex: 'M', dateIn: '2026-11-01', dateOut: '2026-11-05' });
    const res = await api().put(`/api/patients/${created.body._id}`).set(auth()).send({ dateOut: '', status: 'ADMITTED' });
    expect(res.status).toBe(200);
    expect(res.body.dateOut).toBeFalsy();
    expect(res.body.status).toBe('ADMITTED');
  });

  it('rejects usage dated in the future', async () => {
    const res = await api()
      .post('/api/usage')
      .set(auth())
      .send({ patient: patient.id, date: tomorrow(), items: [{ medicine: medicine.id, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.fields.date).toMatch(/future/);
  });

  it('rejects stock whose expiry is before the input date', async () => {
    const res = await api()
      .post('/api/stock/batches')
      .set(auth())
      .send({ items: [{ medicine: medicine.id, quantity: 5, receivedDate: '2026-11-10', expiryDate: '2026-11-01' }] });
    expect(res.status).toBe(400);
    expect(res.body.fields['items.0.expiryDate']).toBeTruthy();
  });

  it('rejects repeated or nested query parameters instead of crashing', async () => {
    expect((await api().get('/api/patients?search=a&search=b').set(auth())).status).toBe(400);
    expect((await api().get('/api/patients?page=-1').set(auth())).status).toBe(400);
  });

  it('rejects malformed ids with 400 (not 500)', async () => {
    expect((await api().get('/api/patients/not-an-id').set(auth())).status).toBe(400);
    expect((await api().get('/api/reports/medicine-usage?medicine=bad').set(auth())).status).toBe(400);
    expect((await api().delete('/api/usage/123').set(auth())).status).toBe(400);
  });

  it('rejects a login with non-text credentials', async () => {
    const res = await api().post('/api/auth/login').send({ username: { $ne: null }, password: { $ne: null } });
    expect(res.status).toBe(400);
  });

  it('uses the same error shape for unknown routes and bad JSON', async () => {
    const nf = await api().get('/api/nope').set(auth());
    expect(nf.body).toEqual({ message: 'Not found', code: 'NOT_FOUND' });
    const bad = await api().post('/api/patients').set(auth()).set('Content-Type', 'application/json').send('{bad json');
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('INVALID_JSON');
  });
});
