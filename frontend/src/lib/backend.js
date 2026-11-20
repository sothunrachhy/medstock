// Every call to the FastAPI backend goes through this file. It translates between the backend's
// shapes (snake_case, { data, total } envelope, UUID ids, TABLET/INJECTION + is_narcotic) and the
// shapes the screens use (camelCase, _id, categories INJECTION / PILL / NARCOTIC). Screens never
// build URLs themselves, so an API change is fixed here only.
import api, { refreshSession, tokenStore } from '@/lib/api';

// ------------------------------------------------------------------ helpers

const num = (v) => (v === null || v === undefined || v === '' ? 0 : Number(v));
const numOrNull = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const text = (v) => v ?? '';
const blankToNull = (v) => (v === undefined ? undefined : v === '' || v === null ? null : v);
/** Backend timestamps are UTC without a zone ("2026-11-20T01:15:00"); mark them as UTC. */
const utc = (s) => (s && !/(Z|[+-]\d\d:\d\d)$/.test(s) ? `${s}Z` : s || null);
const ageOf = (v) => (v === null || v === undefined || v === '' ? null : /^\d+$/.test(String(v)) ? Number(v) : v);
const data = (res) => res.data.data;
const pageParams = ({ page = 1, limit = 50 } = {}) => ({ limit, offset: (Math.max(1, page) - 1) * limit });
const paged = (res, { page = 1, limit = 50 } = {}, map) => ({ items: res.data.data.map(map), total: res.data.total, page, limit });
const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== ''));

// ------------------------------------------------------------------ reference data & session

/** Filled after login: medicine forms (code -> name) and the user's department. */
const ref = { forms: [], formNames: {}, departmentCode: 'SURGICAL_ICU', isAdmin: false };

export async function loadReference() {
  const res = await api.get('/medicines/forms');
  ref.forms = data(res);
  ref.formNames = Object.fromEntries(ref.forms.map((f) => [f.code, f.name]));
  return ref.forms;
}
export const medicineForms = () => ref.forms;
const formName = (code, name) => name || ref.formNames[code] || code || '';

// ------------------------------------------------------------------ categories

/** Screen category from a backend medicine: NARCOTIC, PILL (tablets) or INJECTION. */
export const uiCategory = (m) => (m?.is_narcotic ? 'NARCOTIC' : m?.category_code === 'TABLET' ? 'PILL' : 'INJECTION');
const TAB = { PILL: 'TABLET', INJECTION: 'INJECTION', NARCOTIC: 'NARCOTIC' };
/** "INJECTION,PILL" (or an array) -> "INJECTION,TABLET" for the backend's `tabs` filter. */
const tabsParam = (categories) => {
  const list = (Array.isArray(categories) ? categories : String(categories || '').split(',')).map((c) => c.trim()).filter(Boolean);
  return list.length ? list.map((c) => TAB[c] || c).join(',') : undefined;
};
const categoryList = (categories) =>
  (Array.isArray(categories) ? categories : String(categories || '').split(',')).map((c) => c.trim()).filter(Boolean);

// ------------------------------------------------------------------ permissions

/** Screen permission modules -> backend RBAC services. */
const MODULE_SERVICE = {
  dashboard: 'DASHBOARD',
  patients: 'PATIENT',
  medicines: 'STOCK',
  stock: 'STOCK',
  usage: 'DISPENSING',
  reports: 'REPORT',
  users: 'SETTING',
  roles: 'SETTING',
  loginHistory: 'SETTING',
};
export const SERVICES = ['DASHBOARD', 'PATIENT', 'DISPENSING', 'STOCK', 'REPORT', 'SETTING'];
const ACTION_FROM_API = { READ: 'read', WRITE: 'create', UPDATE: 'update', DELETE: 'delete' };

/** True if a role's permissions ([{ module: SERVICE, actions }]) allow `action` on a screen module. */
export function roleAllows(role, module, action = 'read') {
  if (!role) return false;
  if (role.isSystem) return true;
  const service = MODULE_SERVICE[module] || module;
  return !!role.permissions?.find((p) => p.module === service)?.actions.includes(action);
}

// ------------------------------------------------------------------ mappers

const mapUser = (u, roleNames = {}) => ({
  id: u.id,
  username: u.username,
  fullName: u.full_name,
  fullNameKh: u.full_name_kh || '',
  email: u.email || '',
  isActive: u.is_active,
  lastLoginAt: utc(u.last_login_datetime),
  lockedUntil: null,
  departmentCode: u.department_code,
  role: {
    id: u.role_code,
    name: roleNames[u.role_code] || u.role_code,
    isSystem: u.role_code === 'ADMIN',
    permissions: Object.entries(u.permissions || {}).map(([service, actions]) => ({ module: service, actions: actions.map((a) => ACTION_FROM_API[a]) })),
  },
});

const mapMedicine = (m) => ({
  _id: m.id,
  code: m.code,
  name: m.name,
  form: formName(m.form_code, m.form_name),
  formCode: m.form_code,
  strength: text(m.dosage),
  category: uiCategory(m),
  categoryCode: m.category_code,
  order: m.sort_order,
  minStock: m.min_stock,
  isActive: m.status_code === 'ACTIVE',
  note: text(m.note),
  ...(m.stock && {
    balance: num(m.stock.balance),
    usable: num(m.stock.usable),
    status: m.stock.stock_status,
    expiredQty: num(m.stock.expired_qty),
    expiringQty: num(m.stock.expiring_qty),
    nearestExpiry: m.stock.nearest_expiry,
    batches: m.stock.batch_count,
  }),
});

const lineMedicine = (l) => ({
  _id: l.medicine_id,
  name: l.medicine_name,
  form: formName(l.form_code),
  strength: text(l.dosage),
  category: uiCategory(l),
});

const reportMedicine = (m) => ({
  _id: m.id,
  name: m.name,
  form: formName(m.form_code, m.form_name),
  strength: text(m.dosage),
  category: uiCategory(m),
  order: m.sort_order,
});

const mapPatient = (p) => ({
  _id: p.id,
  code: text(p.patient_code),
  name: p.full_name,
  sex: p.sex,
  age: ageOf(p.age),
  diagnosis: text(p.diagnostic),
  province: text(p.pob_province),
  dateIn: p.date_in,
  dateOut: p.date_out || null,
  status: p.admission_status,
  note: text(p.note),
  createdAt: utc(p.created_datetime),
  updatedAt: utc(p.updated_datetime),
});

const mapLine = (l) => ({
  _id: l.id,
  dispensingId: l.dispensing_id,
  type: 'USAGE',
  medicine: lineMedicine(l),
  patient: { _id: l.patient_id, name: l.patient_name, sex: l.sex, age: ageOf(l.age), diagnosis: text(l.diagnostic), province: text(l.address_province) },
  date: l.dispense_date,
  quantity: num(l.quantity),
  shift: text(l.shift_code),
  payment: text(l.payment_code),
  doctor: text(l.doctor_name),
  note: text(l.note),
  createdBy: { fullName: l.created_by_name || l.created_by || '' },
  createdAt: utc(l.created_datetime),
});

const mapBatch = (b) => ({
  _id: b.id,
  medicine: { _id: b.medicine_id, name: b.medicine_name, form: formName(b.form_code), strength: text(b.dosage), category: uiCategory(b) },
  quantity: num(b.total_qty),
  remaining: num(b.remaining_qty),
  receivedDate: b.input_date,
  expiryDate: b.expire_date,
  batchNo: text(b.batch_no),
  source: text(b.source),
  note: text(b.note),
  createdBy: { fullName: b.created_by_name || b.created_by || '' },
  createdAt: utc(b.created_datetime),
});

const mapRole = (r) => ({
  _id: r.code,
  id: r.code,
  code: r.code,
  name: r.name,
  description: text(r.description),
  isSystem: r.code === 'ADMIN',
  permissions: (r.permissions || [])
    .map((p) => ({
      module: p.service_code,
      actions: [p.can_read && 'read', p.can_write && 'create', p.can_update && 'update', p.can_delete && 'delete'].filter(Boolean),
    }))
    .filter((p) => p.actions.length),
  userCount: r.user_count || 0,
});

const permissionsBody = (permissions = []) =>
  SERVICES.map((service) => {
    const actions = permissions.find((p) => p.module === service)?.actions || [];
    return {
      service_code: service,
      can_read: actions.includes('read'),
      can_write: actions.includes('create'),
      can_update: actions.includes('update'),
      can_delete: actions.includes('delete'),
    };
  });

// ------------------------------------------------------------------ auth

export const auth = {
  async login(username, password) {
    const res = await api.post('/auth/login', { username: username.trim(), password, device: { platform: 'web' } });
    tokenStore.set(data(res).access_token);
    return auth.me();
  },
  async me() {
    const user = mapUser(data(await api.get('/auth/me')));
    ref.departmentCode = user.departmentCode || 'SURGICAL_ICU';
    ref.isAdmin = user.role.isSystem;
    return user;
  },
  async restore() {
    await refreshSession();
    return auth.me();
  },
  async logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      tokenStore.clear();
    }
  },
  async changePassword({ currentPassword, newPassword }) {
    await api.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword });
    // The password change ends other sessions and old access tokens; get a fresh one for this device.
    await refreshSession();
  },
};

// ------------------------------------------------------------------ dashboard

export async function getDashboard() {
  const d = data(await api.get('/dashboard', { params: { expiring_within_days: 90 } }));
  const byTab = Object.fromEntries(d.stock_status_by_tab.map((s) => [s.tab_code, s]));
  return {
    today: d.today,
    expiryWarnDays: d.expiry_warn_days,
    kpis: {
      medicines: d.total_medicines,
      admitted: d.admitted_count,
      admittedToday: d.admitted_today,
      usageToday: num(d.usage_qty_today),
      usageEntriesToday: d.usage_lines_today,
      patientsTreatedToday: d.patients_treated_today,
      lowStock: d.low_stock_count,
      outOfStock: d.out_of_stock_count,
      expiringBatches: d.expiring_batch_count,
      expiredBatches: d.expired_batch_count,
    },
    stockByCategory: [
      ['INJECTION', 'INJECTION'],
      ['PILL', 'TABLET'],
      ['NARCOTIC', 'NARCOTIC'],
    ].map(([category, tab]) => ({ category, OK: byTab[tab]?.ok || 0, LOW: byTab[tab]?.low || 0, OUT: byTab[tab]?.out || 0, total: byTab[tab]?.total || 0 })),
    lowStock: d.low_stock_list.map((m) => ({
      _id: m.medicine_id,
      name: m.medicine_name,
      form: formName(m.form_code),
      strength: text(m.dosage),
      category: uiCategory(m),
      minStock: m.min_stock,
      balance: num(m.balance),
      usable: num(m.usable),
      status: m.stock_status,
      nearestExpiry: m.nearest_expiry,
    })),
    expiring: d.nearly_expired_batches.slice(0, 15).map((b) => ({
      _id: b.batch_id,
      medicine: { _id: b.medicine_id, name: b.medicine_name, form: formName(b.form_code), strength: text(b.dosage), category: uiCategory(b) },
      remaining: num(b.remaining_qty),
      receivedDate: b.input_date,
      expiryDate: b.expire_date,
      batchNo: text(b.batch_no),
    })),
    trend: d.usage_trend.map((t) => ({ date: t.day, INJECTION: num(t.injection), PILL: num(t.tablet), NARCOTIC: num(t.narcotic), admissions: t.admissions })),
    topUsed: d.top_used_this_month.map((t) => ({ name: [t.medicine_name, t.dosage].filter(Boolean).join(' '), category: uiCategory(t), quantity: num(t.quantity) })),
  };
}

// ------------------------------------------------------------------ patients

const patientBody = (f) =>
  clean({
    patient_code: blankToNull(f.code),
    full_name: f.name?.trim(),
    sex: f.sex,
    age: f.age === undefined ? undefined : f.age === null || f.age === '' ? null : String(f.age),
    diagnostic: blankToNull(f.diagnosis),
    pob_province: blankToNull(f.province),
    date_in: f.dateIn || undefined,
    date_out: f.status === 'ADMITTED' ? null : f.dateOut === undefined ? undefined : blankToNull(f.dateOut),
    note: blankToNull(f.note),
  });

export const patients = {
  async list({ search, status, from, to, page = 1, limit = 20 } = {}) {
    const res = await api.get('/patients', {
      params: clean({ search, admission_status: status, start_date: from, end_date: to, ...pageParams({ page, limit }) }),
    });
    return paged(res, { page, limit }, mapPatient);
  },
  get: async (id) => mapPatient(data(await api.get(`/patients/${id}`))),
  create: async (form) => mapPatient(data(await api.post('/patients', patientBody(form)))),
  update: async (id, form) => mapPatient(data(await api.put(`/patients/${id}`, patientBody(form)))),
  remove: (id) => api.delete(`/patients/${id}`),
};

// ------------------------------------------------------------------ medicines

const medicineBody = (f, existing) => {
  const narcotic = f.category === 'NARCOTIC';
  const categoryCode = f.category === 'PILL' ? 'TABLET' : f.category === 'INJECTION' ? 'INJECTION' : existing?.categoryCode || 'INJECTION';
  return clean({
    name: f.name?.trim(),
    form_code: f.formCode,
    dosage: blankToNull(f.strength),
    category_code: f.category ? categoryCode : undefined,
    is_narcotic: f.category ? narcotic : undefined,
    sort_order: f.order === undefined || f.order === '' ? undefined : f.order,
    min_stock: f.minStock === undefined || f.minStock === '' ? undefined : Number(f.minStock),
    note: blankToNull(f.note),
  });
};

export const medicines = {
  /** `active`: undefined/'true' = active only, 'false' = inactive only, 'all' = both. */
  async list({ categories, withStock = false, active, search } = {}) {
    const status = active === 'all' ? 'ALL' : active === 'false' || active === false ? 'INACTIVE' : 'ACTIVE';
    const res = await api.get('/medicines', {
      params: clean({ tabs: tabsParam(categories), with_stock: withStock || undefined, status_code: status, search, limit: 1000 }),
    });
    return data(res).map(mapMedicine);
  },
  async create(form) {
    let med = data(await api.post('/medicines', medicineBody(form)));
    if (form.isActive === false) med = data(await api.put(`/medicines/${med.id}`, { status_code: 'INACTIVE' }));
    return mapMedicine(med);
  },
  async update(existing, form) {
    const body = { ...medicineBody(form, existing), status_code: form.isActive === undefined ? undefined : form.isActive ? 'ACTIVE' : 'INACTIVE' };
    return mapMedicine(data(await api.put(`/medicines/${existing._id}`, clean(body))));
  },
  /** Returns { deleted, deactivated }. */
  remove: async (id) => data(await api.delete(`/medicines/${id}`)),
};

// ------------------------------------------------------------------ stock

const AVAILABILITY = { available: 'AVAILABLE', expiring: 'EXPIRING', expired: 'EXPIRED' };

export const stock = {
  async batches({ medicine, status, days, page = 1, limit = 50 } = {}) {
    const res = await api.get('/stock/batches', {
      params: clean({
        medicine_id: medicine,
        availability: AVAILABILITY[status],
        expiring_within_days: status === 'expiring' ? days || 90 : undefined,
        ...pageParams({ page, limit }),
      }),
    });
    return paged(res, { page, limit }, mapBatch);
  },
  async receive(lines) {
    const res = await api.post('/stock/batches/bulk', {
      department_code: ref.departmentCode,
      items: lines.map((l) =>
        clean({
          medicine_id: l.medicine,
          total_qty: l.quantity,
          input_date: l.receivedDate || undefined,
          expire_date: l.expiryDate || undefined,
          batch_no: blankToNull(l.batchNo),
          source: blankToNull(l.source),
          note: blankToNull(l.note),
        }),
      ),
    });
    return data(res).map(mapBatch);
  },
  async updateBatch(id, f) {
    const body = clean({
      total_qty: f.quantity,
      input_date: f.receivedDate,
      expire_date: f.expiryDate,
      batch_no: blankToNull(f.batchNo),
      source: blankToNull(f.source),
      note: blankToNull(f.note),
    });
    return mapBatch(data(await api.put(`/stock/batches/${id}`, body)));
  },
  removeBatch: (id) => api.delete(`/stock/batches/${id}`),
  writeOff: ({ batch, quantity, type, date, note }) =>
    api.post('/stock/writeoff', clean({ batch_id: batch, quantity, movement_type: type || 'EXPIRED', movement_date: date || undefined, note: blankToNull(note) })),
  removeWriteOff: (id) => api.delete(`/stock/writeoff/${id}`),
  async movements({ medicine, limit = 100 }) {
    const res = await api.get('/stock/movements', { params: { medicine_id: medicine, limit } });
    return data(res).map((m) => ({
      _id: m.id,
      kind: m.movement_type,
      date: m.movement_date,
      quantity: num(m.quantity),
      detail:
        m.movement_type === 'IN'
          ? [m.batch_no && `Batch ${m.batch_no}`, m.batch_source].filter(Boolean).join(' · ')
          : m.patient_name || m.note || (m.batch_no ? `Batch ${m.batch_no}` : ''),
      by: m.created_by_name || m.created_by || '',
      createdAt: utc(m.created_datetime),
    }));
  },
};

// ------------------------------------------------------------------ usage (dispensing lines)

export const usage = {
  async list({ from, to, patient, medicine, categories, payment, page = 1, limit = 50 } = {}) {
    const res = await api.get('/dispensing/items', {
      params: clean({
        start_date: from,
        end_date: to,
        patient_id: patient,
        medicine_id: medicine,
        tabs: tabsParam(categories),
        payment_code: payment,
        ...pageParams({ page, limit }),
      }),
    });
    return paged(res, { page, limit }, mapLine);
  },
  /** Medicines given to one patient on one day; saved all together or not at all. */
  record: ({ patient, date, shift, payment, doctor, note, items }) =>
    api.post('/dispensing/visit', {
      patient_id: patient,
      dispense_date: date || undefined,
      department_code: ref.departmentCode,
      payment_code: payment,
      shift_code: shift || null,
      doctor_name: blankToNull(doctor) ?? null,
      note: blankToNull(note) ?? null,
      items: items.map((i) => ({ medicine_id: i.medicine, quantity: i.quantity })),
    }),
  remove: (lineId) => api.delete(`/dispensing/items/${lineId}`),
};

// ------------------------------------------------------------------ reports

export const reports = {
  async stockSummary({ from, to, categories }) {
    const d = data(await api.get('/reports/data/stock-summary', { params: clean({ start_date: from, end_date: to, tabs: tabsParam(categories) }) }));
    const rows = d.rows.map((r) => ({
      medicine: reportMedicine(r.medicine),
      isActive: r.medicine.status_code === 'ACTIVE',
      opening: num(r.opening),
      received: num(r.received),
      daily: Object.fromEntries(Object.entries(r.daily_used).map(([k, v]) => [k, num(v)])),
      used: num(r.used),
      writeOff: num(r.write_off),
      closing: num(r.closing),
      requested: numOrNull(r.requested_qty),
      provided: numOrNull(r.supplied_qty),
    }));
    return {
      from: d.start_date,
      to: d.end_date,
      days: d.days,
      categories: categoryList(categories),
      rows,
      requisition: rows.some((r) => r.requested !== null || r.provided !== null) ? { note: '', updatedAt: null } : null,
    };
  },
  saveRequisition: ({ from, to, items }) =>
    api.put('/reports/data/requests', {
      department_code: ref.departmentCode,
      start_date: from,
      end_date: to,
      items: items.map((i) => ({ medicine_id: i.medicine, requested_qty: num(i.requested), supplied_qty: num(i.provided) })),
    }),
  async dailySheet({ date, from, to, categories, allColumns }) {
    const d = data(
      await api.get('/reports/data/daily-sheet', {
        params: clean({ start_date: from || date, end_date: to || date, tabs: tabsParam(categories), all_columns: allColumns ? true : undefined }),
      }),
    );
    return {
      from: d.start_date,
      to: d.end_date,
      categories: categoryList(categories),
      columns: d.columns.map(reportMedicine),
      rows: d.rows.map((r) => ({
        patient: {
          _id: r.patient_id,
          code: text(r.patient_code),
          name: r.patient_name,
          sex: r.sex,
          age: ageOf(r.age),
          diagnosis: text(r.diagnostic),
          province: text(r.province),
          dateIn: r.date_in,
        },
        quantities: Object.fromEntries(Object.entries(r.quantities).map(([k, v]) => [k, num(v)])),
        first: utc(r.first_at),
      })),
      totals: Object.fromEntries(Object.entries(d.totals).map(([k, v]) => [k, num(v)])),
    };
  },
  async narcotic({ from, to, medicine }) {
    const lines = data(await api.get('/reports/data/narcotic', { params: clean({ start_date: from, end_date: to, medicine_id: medicine }) })).map(mapLine);
    return { from, to, medicine: null, items: lines, total: lines.reduce((s, l) => s + l.quantity, 0) };
  },
  async medicineUsage({ from, to, categories, medicine }) {
    const d = data(await api.get('/reports/data/medicine-usage', { params: clean({ start_date: from, end_date: to, tabs: tabsParam(categories), medicine_id: medicine }) }));
    return {
      from: d.start_date,
      to: d.end_date,
      categories: categoryList(categories),
      items: d.items.map((i) => ({
        medicine: reportMedicine(i.medicine),
        total: num(i.total),
        patientCount: i.patient_count,
        patients: i.patients.map((p) => ({ patient: { _id: p.patient_id, name: p.patient_name, sex: p.sex, age: ageOf(p.age) }, quantity: num(p.quantity), times: p.times })),
      })),
    };
  },
  async patientUsage({ from, to, categories, patient }) {
    const list = data(
      await api.get('/patients/usage-report', { params: clean({ start_date: from, end_date: to, tabs: tabsParam(categories), patient_id: patient }) }),
    );
    return {
      from,
      to,
      categories: categoryList(categories),
      items: list.map((p) => ({
        patient: {
          _id: p.patient_id,
          code: text(p.patient_code),
          name: p.patient_name,
          sex: p.sex,
          age: ageOf(p.age),
          diagnosis: text(p.diagnostic),
          province: text(p.pob_province),
          dateIn: p.date_in,
        },
        total: p.medicines.reduce((s, m) => s + num(m.total_quantity), 0),
        items: p.medicines.map((m) => ({
          medicine: {
            _id: m.medicine_id,
            name: m.medicine_name,
            form: formName(m.form_code),
            strength: text(m.dosage),
            category: uiCategory(m),
            order: m.sort_order,
          },
          quantity: num(m.total_quantity),
          days: m.days_count,
        })),
      })),
    };
  },
};

// ------------------------------------------------------------------ settings: users, roles, login history

export const users = {
  async list({ search } = {}) {
    const [u, r] = await Promise.all([api.get('/settings/users', { params: clean({ search, limit: 500 }) }), api.get('/settings/roles')]);
    const roles = data(r).map(mapRole);
    const byCode = Object.fromEntries(roles.map((x) => [x.code, x]));
    const items = data(u)
      .map((x) => {
        const user = mapUser(x);
        const role = byCode[x.role_code];
        return { ...user, role: role ? { id: role.id, name: role.name, isSystem: role.isSystem, permissions: role.permissions } : user.role };
      })
      .reverse(); // oldest first
    return { items, roles };
  },
  async roleOptions() {
    const roles = data(await api.get('/settings/roles')).map(mapRole);
    return { items: roles.filter((r) => ref.isAdmin || !r.isSystem).map((r) => ({ _id: r.code, name: r.name, isSystem: r.isSystem })) };
  },
  async create({ username, fullName, password, role, isActive }) {
    let user = data(
      await api.post('/settings/users', {
        username: username.trim().toLowerCase(),
        full_name: fullName.trim(),
        password,
        role_code: role,
        department_code: ref.departmentCode,
      }),
    );
    if (isActive === false) user = data(await api.put(`/settings/users/${user.id}`, { is_active: false }));
    return mapUser(user);
  },
  update: async (id, { fullName, role, isActive, password }) =>
    mapUser(data(await api.put(`/settings/users/${id}`, clean({ full_name: fullName?.trim(), role_code: role, is_active: isActive, password: password || undefined })))),
  remove: (id) => api.delete(`/settings/users/${id}`),
};

export const roles = {
  list: async () => ({ items: data(await api.get('/settings/roles')).map(mapRole) }),
  create: ({ name, description, permissions }) =>
    api.post('/settings/roles', { name: name.trim(), description: blankToNull(description) ?? null, permissions: permissionsBody(permissions) }),
  update: (code, { name, description, permissions }) =>
    api.put(`/settings/roles/${code}`, { name: name?.trim(), description: blankToNull(description) ?? null, permissions: permissionsBody(permissions) }),
  remove: (code) => api.delete(`/settings/roles/${code}`),
};

export async function loginHistory({ status, user, search, from, to, page = 1, limit = 30 } = {}) {
  const res = await api.get('/settings/login-history', {
    params: clean({ login_status: status, user_id: user, username: search, start_date: from, end_date: to, ...pageParams({ page, limit }) }),
  });
  return paged(res, { page, limit }, (h) => ({
    _id: h.id,
    user: h.user_id ? { _id: h.user_id, username: h.username } : null,
    username: h.username,
    status: h.login_status,
    reason: text(h.failure_reason),
    ip: text(h.ip_address),
    userAgent: text(h.user_agent),
    loginAt: utc(h.login_datetime),
    logoutAt: null,
  }));
}

/** Backend field names -> form field names, for showing 422 errors under the right input. */
export const FIELD_NAMES = {
  full_name: 'name',
  patient_code: 'code',
  diagnostic: 'diagnosis',
  pob_province: 'province',
  date_in: 'dateIn',
  date_out: 'dateOut',
  dosage: 'strength',
  form_code: 'formCode',
  category_code: 'category',
  sort_order: 'order',
  min_stock: 'minStock',
  total_qty: 'quantity',
  input_date: 'receivedDate',
  expire_date: 'expiryDate',
  batch_no: 'batchNo',
  payment_code: 'payment',
  doctor_name: 'doctor',
  dispense_date: 'date',
  patient_id: 'patient',
  medicine_id: 'medicine',
  role_code: 'role',
  current_password: 'currentPassword',
  new_password: 'newPassword',
};
