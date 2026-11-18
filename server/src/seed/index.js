// Usage:
//   npm run seed        -> roles, admin user and the medicine list (safe to run again)
//   npm run seed:demo   -> the above + demo stock, patients and 14 days of usage (only on an empty stock)
import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { fullPermissions } from '../config/permissions.js';
import Medicine from '../models/Medicine.js';
import Patient from '../models/Patient.js';
import Role from '../models/Role.js';
import StockBatch from '../models/StockBatch.js';
import StockOut from '../models/StockOut.js';
import User from '../models/User.js';
import { allocate } from '../services/stock.js';
import { addDays, dayStart, todayStr } from '../utils/date.js';
import { medicineDocs } from './medicines.js';

const ROLES = [
  { name: 'Admin', description: 'Full access to everything', isSystem: true, permissions: fullPermissions() },
  {
    name: 'Pharmacist',
    description: 'Manages medicine list, stock in/out and reports',
    permissions: [
      { module: 'dashboard', actions: ['read'] },
      { module: 'patients', actions: ['read'] },
      { module: 'medicines', actions: ['read', 'create', 'update', 'delete'] },
      { module: 'stock', actions: ['read', 'create', 'update', 'delete'] },
      { module: 'usage', actions: ['read', 'create', 'update', 'delete'] },
      { module: 'reports', actions: ['read', 'update'] },
    ],
  },
  {
    name: 'Nurse',
    description: 'Registers patients and records medicine usage',
    permissions: [
      { module: 'dashboard', actions: ['read'] },
      { module: 'patients', actions: ['read', 'create', 'update'] },
      { module: 'stock', actions: ['read'] },
      { module: 'usage', actions: ['read', 'create'] },
      { module: 'reports', actions: ['read'] },
    ],
  },
  {
    name: 'Viewer',
    description: 'Read-only access to dashboard and reports',
    permissions: [
      { module: 'dashboard', actions: ['read'] },
      { module: 'patients', actions: ['read'] },
      { module: 'stock', actions: ['read'] },
      { module: 'reports', actions: ['read'] },
    ],
  },
];

async function seedRoles() {
  for (const r of ROLES) {
    const exists = await Role.findOne({ name: r.name });
    if (!exists) await Role.create(r);
    else if (r.isSystem) await Role.updateOne({ _id: exists._id }, { isSystem: true, permissions: r.permissions });
  }
  console.log(`✓ roles: ${ROLES.map((r) => r.name).join(', ')}`);
}

async function seedAdmin() {
  const username = (process.env.ADMIN_USERNAME || 'admin').toLowerCase();
  if (await User.exists({ username })) return console.log(`✓ admin user "${username}" already exists`);
  const role = await Role.findOne({ name: 'Admin' });
  const user = new User({ username, fullName: 'System Administrator', role: role._id });
  await user.setPassword(process.env.ADMIN_PASSWORD || 'admin123');
  await user.save();
  console.log(`✓ admin user created: ${username} / ${process.env.ADMIN_PASSWORD || 'admin123'}  (change this password after first login!)`);
}

async function seedMedicines() {
  const docs = medicineDocs();
  for (const { demo, ...m } of docs) {
    await Medicine.updateOne(
      { name: m.name, form: m.form, strength: m.strength, category: m.category },
      { $setOnInsert: m },
      { upsert: true },
    );
  }
  console.log(`✓ medicines: ${docs.length} in the list`);
}

// ---- demo data -----------------------------------------------------------

function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function seedDemo() {
  if (await StockBatch.exists({})) {
    console.log('• demo skipped: stock already has data');
    return;
  }
  const rand = rng(42);
  const pickOne = (arr) => arr[Math.floor(rand() * arr.length)];
  const int = (a, b) => a + Math.floor(rand() * (b - a + 1));
  const today = dayStart(todayStr());
  const admin = await User.findOne({ username: (process.env.ADMIN_USERNAME || 'admin').toLowerCase() });

  // 1) opening stock received 30 days ago
  const meds = await Medicine.find().lean();
  const demoQty = new Map(medicineDocs().map((d) => [`${d.name}|${d.form}|${d.strength}|${d.category}`, d.demo]));
  const batches = [];
  for (const m of meds) {
    const qty = demoQty.get(`${m.name}|${m.form}|${m.strength}|${m.category}`) || 0;
    if (!qty) continue;
    const first = Math.ceil(qty * 0.4);
    const expiryDays = int(1, 10) === 1 ? int(20, 80) : int(200, 720); // ~10% expire soon
    batches.push({ medicine: m._id, quantity: first, remaining: first, receivedDate: addDays(today, -30), expiryDate: addDays(today, expiryDays), batchNo: `B${int(1000, 9999)}`, source: 'Hospital pharmacy', createdBy: admin._id });
    if (qty - first > 0) {
      batches.push({ medicine: m._id, quantity: qty - first, remaining: qty - first, receivedDate: addDays(today, -30), expiryDate: addDays(today, int(300, 900)), batchNo: `B${int(1000, 9999)}`, source: 'Hospital pharmacy', createdBy: admin._id });
    }
  }
  await StockBatch.insertMany(batches);
  console.log(`✓ demo stock batches: ${batches.length}`);

  // 2) patients
  const family = ['សុខ', 'ចាន់', 'ហេង', 'លី', 'កែវ', 'ឈឹម', 'ម៉ៅ', 'សៀង', 'ពេជ្រ', 'នួន', 'អ៊ុំ', 'ស៊ុន'];
  const given = ['ដារ៉ា', 'សុភា', 'វណ្ណា', 'ស្រីមុំ', 'បុប្ផា', 'វិចិត្រ', 'រតនា', 'សំណាង', 'ពិសិដ្ឋ', 'ចន្ធូ', 'សុខា', 'វាសនា', 'មករា', 'ធីតា'];
  const diagnoses = ['Post-op laparotomy', 'Traumatic brain injury', 'Septic shock', 'Peritonitis', 'Polytrauma (RTA)', 'Post-op craniotomy', 'Bowel obstruction', 'Burn 30%', 'Acute pancreatitis', 'Perforated ulcer', 'Chest trauma', 'Post-op thyroidectomy'];
  const provinces = ['រាជធានីភ្នំពេញ', 'កណ្ដាល', 'កំពង់ចាម', 'តាកែវ', 'ព្រៃវែង', 'កំពង់ស្ពឺ', 'បាត់ដំបង', 'សៀមរាប', 'កំពត', 'ស្វាយរៀង'];
  const patients = [];
  for (let i = 0; i < 28; i++) {
    const dateIn = addDays(today, -int(0, 16));
    const stay = int(2, 12);
    const out = addDays(dateIn, stay);
    patients.push({
      code: `ICU-${String(2026000 + i + 1)}`,
      name: `${pickOne(family)} ${pickOne(given)}`,
      sex: rand() < 0.55 ? 'M' : 'F',
      age: int(16, 85),
      diagnosis: pickOne(diagnoses),
      province: pickOne(provinces),
      dateIn,
      ...(out < today ? { dateOut: out, status: 'DISCHARGED' } : { status: 'ADMITTED' }),
      createdBy: admin._id,
    });
  }
  const savedPatients = await Patient.insertMany(patients);
  console.log(`✓ demo patients: ${savedPatients.length}`);

  // 3) usage for the last 14 days
  const common = ['Ceftriaxone', 'Paracétamol', 'Cimetidine', 'Sérum Sale 0,9%', 'Tramadol ampoule', 'Métronidazole', 'Glucose', 'Serum Lactate', 'Calcium Gluconate', 'Dexamethasone', 'Vitamine K1', 'Tranexamic Acid', 'Omeprazol', 'Amikacine', 'Midazolam', 'Noradrenaline'];
  const injections = meds.filter((m) => m.category === 'INJECTION' && common.includes(m.name));
  const pills = meds.filter((m) => m.category === 'PILL');
  const narcotics = meds.filter((m) => m.category === 'NARCOTIC');
  const doctors = ['វេជ្ជ. សុខ សំណាង', 'វេជ្ជ. ចាន់ វិបុល', 'វេជ្ជ. ហេង ម៉ារី'];
  let count = 0;
  for (let back = 13; back >= 0; back--) {
    const day = addDays(today, -back);
    for (const p of savedPatients) {
      if (p.dateIn > day || (p.dateOut && p.dateOut < day)) continue;
      const lines = new Map();
      for (let k = 0; k < int(3, 6); k++) lines.set(pickOne(injections), int(1, 3));
      if (rand() < 0.4) lines.set(pickOne(pills), int(1, 3));
      const doctor = pickOne(doctors);
      if (rand() < 0.15) lines.set(pickOne(narcotics), 1);
      for (const [m, quantity] of lines) {
        try {
          const allocations = await allocate(m._id, quantity, { asOf: day, label: m.name });
          await StockOut.create({ type: 'USAGE', medicine: m._id, patient: p._id, date: day, quantity, shift: rand() < 0.5 ? 'DAY' : 'NIGHT', doctor: m.category === 'NARCOTIC' ? doctor : '', allocations, createdBy: admin._id });
          count++;
        } catch {
          /* not enough stock, skip */
        }
      }
    }
  }
  console.log(`✓ demo usage records: ${count}`);
}

async function main() {
  await connectDB();
  await seedRoles();
  await seedAdmin();
  await seedMedicines();
  if (process.argv.includes('--demo')) await seedDemo();
  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect();
  process.exit(1);
});
