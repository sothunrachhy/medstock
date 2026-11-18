import { Router } from 'express';
import mongoose from 'mongoose';
import { authorize } from '../middleware/auth.js';
import Medicine from '../models/Medicine.js';
import Patient from '../models/Patient.js';
import Requisition from '../models/Requisition.js';
import StockBatch from '../models/StockBatch.js';
import StockOut from '../models/StockOut.js';
import { listDays, parseDay, parseRange, TZ } from '../utils/date.js';
import { asyncHandler, HttpError } from '../utils/http.js';
import { parseCategories } from './medicines.js';

const router = Router();
const oid = (v) => new mongoose.Types.ObjectId(String(v));
const toMap = (rows) => new Map(rows.map((r) => [String(r._id), r.q]));
const dayExpr = (field) => ({ $dateToString: { format: '%Y-%m-%d', date: field, timezone: TZ } });

async function medicinesFor(categories, includeInactive = true) {
  const filter = { category: { $in: categories } };
  if (!includeInactive) filter.isActive = true;
  return Medicine.find(filter).sort({ order: 1, name: 1 }).lean();
}

const sumByMedicine = (Model, match) =>
  Model.aggregate([{ $match: match }, { $group: { _id: '$medicine', q: { $sum: '$quantity' } } }]);

/**
 * Stock movement summary per medicine for a date range.
 * Used by the daily stock report (from = to) and the weekly request report.
 * opening (ដើមគ្រា) + received (ចំណូល) - used (ចំណាយ) - writeOff = closing (ចំនួនសល់)
 */
router.get(
  '/stock-summary',
  authorize('reports', 'read'),
  asyncHandler(async (req, res) => {
    const { from, to, start, end } = parseRange(req.query, 31);
    const categories = parseCategories(req.query.categories);
    const meds = await medicinesFor(categories);
    const ids = meds.map((m) => m._id);
    const inRange = { $gte: start, $lt: end };

    const [inBefore, outBefore, received, writeOff, usageDaily, requisition] = await Promise.all([
      sumByMedicine(StockBatch, { medicine: { $in: ids }, receivedDate: { $lt: start } }),
      sumByMedicine(StockOut, { medicine: { $in: ids }, date: { $lt: start } }),
      sumByMedicine(StockBatch, { medicine: { $in: ids }, receivedDate: inRange }),
      sumByMedicine(StockOut, { medicine: { $in: ids }, type: { $ne: 'USAGE' }, date: inRange }),
      StockOut.aggregate([
        { $match: { medicine: { $in: ids }, type: 'USAGE', date: inRange } },
        { $group: { _id: { m: '$medicine', d: dayExpr('$date') }, q: { $sum: '$quantity' } } },
      ]),
      Requisition.findOne({ key: [...categories].sort().join(','), from: start, to: parseDay(to) }).lean(),
    ]);

    const inB = toMap(inBefore);
    const outB = toMap(outBefore);
    const recv = toMap(received);
    const wo = toMap(writeOff);
    const daily = new Map();
    for (const r of usageDaily) {
      const key = String(r._id.m);
      if (!daily.has(key)) daily.set(key, {});
      daily.get(key)[r._id.d] = r.q;
    }
    const reqMap = new Map((requisition?.items || []).map((i) => [String(i.medicine), i]));

    const rows = meds
      .map((m) => {
        const id = String(m._id);
        const opening = (inB.get(id) || 0) - (outB.get(id) || 0);
        const rec = recv.get(id) || 0;
        const usage = daily.get(id) || {};
        const used = Object.values(usage).reduce((s, q) => s + q, 0);
        const writeOffQty = wo.get(id) || 0;
        const req = reqMap.get(id);
        return {
          medicine: { _id: m._id, name: m.name, form: m.form, strength: m.strength, category: m.category, order: m.order },
          isActive: m.isActive,
          opening,
          received: rec,
          daily: usage,
          used,
          writeOff: writeOffQty,
          closing: opening + rec - used - writeOffQty,
          requested: req?.requested ?? null,
          provided: req?.provided ?? null,
        };
      })
      .filter((r) => r.isActive || r.opening || r.received || r.used || r.writeOff);

    res.json({
      from,
      to,
      days: listDays(from, to),
      categories,
      rows,
      requisition: requisition ? { note: requisition.note, updatedAt: requisition.updatedAt } : null,
    });
  }),
);

// Save requested / provided quantities of a weekly report.
router.put(
  '/requisition',
  authorize('reports', 'update'),
  asyncHandler(async (req, res) => {
    const { categories, from, to, items = [], note = '' } = req.body || {};
    const { start } = parseRange({ from, to }, 31);
    const cats = parseCategories(Array.isArray(categories) ? categories.join(',') : categories);
    const clean = items
      .filter((i) => i.medicine)
      .map((i) => ({
        medicine: i.medicine,
        requested: Math.max(0, Number(i.requested) || 0),
        provided: Math.max(0, Number(i.provided) || 0),
      }));
    const doc = await Requisition.findOneAndUpdate(
      { key: [...cats].sort().join(','), from: start, to: parseDay(to) },
      { items: clean, note, updatedBy: req.user._id },
      { upsert: true, new: true, runValidators: true },
    );
    res.json(doc);
  }),
);

/**
 * Daily sheet (ថ្នាំចាក់/ថ្នាំគ្រាប់ ប្រចាំថ្ងៃ): rows = patients, columns = medicines used.
 */
router.get(
  '/daily-sheet',
  authorize('reports', 'read'),
  asyncHandler(async (req, res) => {
    const { from, to, start, end } = parseRange({ from: req.query.date || req.query.from, to: req.query.date || req.query.to }, 31);
    const categories = parseCategories(req.query.categories);
    const meds = await medicinesFor(categories);
    const ids = meds.map((m) => m._id);

    const rows = await StockOut.aggregate([
      { $match: { type: 'USAGE', medicine: { $in: ids }, date: { $gte: start, $lt: end } } },
      { $group: { _id: { p: '$patient', m: '$medicine' }, q: { $sum: '$quantity' }, first: { $min: '$createdAt' } } },
    ]);

    const patientIds = [...new Set(rows.map((r) => String(r._id.p)))];
    const patients = await Patient.find({ _id: { $in: patientIds } }).lean();
    const pMap = new Map(patients.map((p) => [String(p._id), p]));
    const usedMeds = new Set(rows.map((r) => String(r._id.m)));
    const columns = meds.filter((m) => usedMeds.has(String(m._id)) || req.query.allColumns === '1');

    const byPatient = new Map();
    for (const r of rows) {
      const pid = String(r._id.p);
      if (!byPatient.has(pid)) byPatient.set(pid, { patient: pMap.get(pid) || { _id: pid, name: '—' }, quantities: {}, first: r.first });
      const entry = byPatient.get(pid);
      entry.quantities[String(r._id.m)] = r.q;
      if (r.first < entry.first) entry.first = r.first;
    }
    const patientRows = [...byPatient.values()].sort((a, b) => a.first - b.first);
    const totals = {};
    for (const r of rows) totals[String(r._id.m)] = (totals[String(r._id.m)] || 0) + r.q;

    res.json({
      from,
      to,
      categories,
      columns: columns.map((m) => ({ _id: m._id, name: m.name, form: m.form, strength: m.strength, category: m.category })),
      rows: patientRows,
      totals,
    });
  }),
);

/**
 * Narcotic register (Fentanyl / Morphine): one line per administration.
 */
router.get(
  '/narcotic',
  authorize('reports', 'read'),
  asyncHandler(async (req, res) => {
    const { from, to, start, end } = parseRange(req.query, 400);
    const filter = { type: 'USAGE', date: { $gte: start, $lt: end } };
    let medicine = null;
    if (req.query.medicine) {
      medicine = await Medicine.findById(req.query.medicine).lean();
      if (!medicine) throw new HttpError(404, 'Medicine not found');
      filter.medicine = medicine._id;
    } else {
      const meds = await Medicine.find({ category: 'NARCOTIC' }, '_id').lean();
      filter.medicine = { $in: meds.map((m) => m._id) };
    }
    const items = await StockOut.find(filter)
      .populate('patient', 'name age sex province diagnosis')
      .populate('medicine', 'name form strength')
      .sort({ date: 1, createdAt: 1 })
      .lean();
    res.json({ from, to, medicine, items, total: items.reduce((s, i) => s + i.quantity, 0) });
  }),
);

/**
 * Medicine usage report: totals per medicine with a breakdown per patient.
 */
router.get(
  '/medicine-usage',
  authorize('reports', 'read'),
  asyncHandler(async (req, res) => {
    const { from, to, start, end } = parseRange(req.query, 400);
    const categories = parseCategories(req.query.categories);
    const meds = await medicinesFor(categories);
    const match = { type: 'USAGE', date: { $gte: start, $lt: end }, medicine: { $in: meds.map((m) => m._id) } };
    if (req.query.medicine) match.medicine = oid(req.query.medicine);

    const rows = await StockOut.aggregate([
      { $match: match },
      { $group: { _id: { m: '$medicine', p: '$patient' }, q: { $sum: '$quantity' }, times: { $sum: 1 } } },
    ]);
    const patients = await Patient.find({ _id: { $in: [...new Set(rows.map((r) => String(r._id.p)))] } }, 'name sex age').lean();
    const pMap = new Map(patients.map((p) => [String(p._id), p]));
    const medMap = new Map(meds.map((m) => [String(m._id), m]));

    const byMed = new Map();
    for (const r of rows) {
      const mid = String(r._id.m);
      if (!byMed.has(mid)) {
        const m = medMap.get(mid);
        byMed.set(mid, { medicine: m, total: 0, patients: [] });
      }
      const e = byMed.get(mid);
      e.total += r.q;
      e.patients.push({ patient: pMap.get(String(r._id.p)) || { name: '—' }, quantity: r.q, times: r.times });
    }
    const items = [...byMed.values()]
      .filter((e) => e.medicine)
      .map((e) => ({ ...e, patientCount: e.patients.length, patients: e.patients.sort((a, b) => b.quantity - a.quantity) }))
      .sort((a, b) => a.medicine.order - b.medicine.order || a.medicine.name.localeCompare(b.medicine.name));
    res.json({ from, to, categories, items });
  }),
);

/**
 * Patient usage report: what each patient received in the period.
 */
router.get(
  '/patient-usage',
  authorize('reports', 'read'),
  asyncHandler(async (req, res) => {
    const { from, to, start, end } = parseRange(req.query, 400);
    const categories = parseCategories(req.query.categories);
    const meds = await medicinesFor(categories);
    const match = { type: 'USAGE', date: { $gte: start, $lt: end }, medicine: { $in: meds.map((m) => m._id) } };
    if (req.query.patient) match.patient = oid(req.query.patient);

    const rows = await StockOut.aggregate([
      { $match: match },
      {
        $group: {
          _id: { p: '$patient', m: '$medicine' },
          q: { $sum: '$quantity' },
          days: { $addToSet: dayExpr('$date') },
        },
      },
    ]);
    const patients = await Patient.find({ _id: { $in: [...new Set(rows.map((r) => String(r._id.p)))] } }).lean();
    const pMap = new Map(patients.map((p) => [String(p._id), p]));
    const medMap = new Map(meds.map((m) => [String(m._id), m]));

    const byPatient = new Map();
    for (const r of rows) {
      const pid = String(r._id.p);
      if (!byPatient.has(pid)) byPatient.set(pid, { patient: pMap.get(pid) || { _id: pid, name: '—' }, items: [], total: 0 });
      const e = byPatient.get(pid);
      const m = medMap.get(String(r._id.m));
      e.items.push({ medicine: m, quantity: r.q, days: r.days.length });
      e.total += r.q;
    }
    const items = [...byPatient.values()]
      .map((e) => ({
        ...e,
        items: e.items.sort((a, b) => a.medicine.category.localeCompare(b.medicine.category) || a.medicine.order - b.medicine.order),
      }))
      .sort((a, b) => a.patient.name.localeCompare(b.patient.name));
    res.json({ from, to, categories, items });
  }),
);

export default router;
