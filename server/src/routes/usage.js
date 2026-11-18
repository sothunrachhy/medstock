import { Router } from 'express';
import { authorize } from '../middleware/auth.js';
import Medicine from '../models/Medicine.js';
import Patient from '../models/Patient.js';
import StockOut from '../models/StockOut.js';
import { allocate, release } from '../services/stock.js';
import { parseDay, parseRange, todayStr } from '../utils/date.js';
import { asyncHandler, HttpError, parsePaging, toPositiveInt } from '../utils/http.js';
import { parseCategories } from './medicines.js';

const router = Router();

// List usage (dispensing) records.
router.get(
  '/',
  authorize('usage', 'read'),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePaging(req.query, 50, 1000);
    const filter = { type: req.query.type || 'USAGE' };
    if (req.query.from || req.query.to) {
      const { start, end } = parseRange(req.query, 400);
      filter.date = { $gte: start, $lt: end };
    }
    if (req.query.patient) filter.patient = req.query.patient;
    if (req.query.medicine) filter.medicine = req.query.medicine;
    if (req.query.categories) {
      const meds = await Medicine.find({ category: { $in: parseCategories(req.query.categories) } }, '_id').lean();
      filter.medicine = filter.medicine || { $in: meds.map((m) => m._id) };
    }
    const [items, total] = await Promise.all([
      StockOut.find(filter)
        .populate('medicine', 'name form strength category')
        .populate('patient', 'name sex age')
        .populate('createdBy', 'fullName')
        .sort({ date: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      StockOut.countDocuments(filter),
    ]);
    res.json({ items, total, page, limit });
  }),
);

// Record medicines given to one patient:
// { patient, date, shift, doctor, note, items: [{ medicine, quantity }] }
router.post(
  '/',
  authorize('usage', 'create'),
  asyncHandler(async (req, res) => {
    const { patient: patientId, date, shift = '', doctor = '', note = '', items } = req.body || {};
    if (!patientId) throw new HttpError(400, 'Please select a patient');
    const patient = await Patient.findById(patientId).lean();
    if (!patient) throw new HttpError(404, 'Patient not found');
    if (!Array.isArray(items) || !items.length) throw new HttpError(400, 'Add at least one medicine');

    const day = parseDay(date || todayStr());
    if (day < parseDay(patient.dateIn)) throw new HttpError(400, 'Usage date is before the patient was admitted');

    // merge duplicate lines of the same medicine
    const merged = new Map();
    items.forEach((it, idx) => {
      if (!it.medicine) throw new HttpError(400, `Row ${idx + 1}: please select a medicine`);
      const q = toPositiveInt(it.quantity, `Row ${idx + 1}: quantity`);
      merged.set(String(it.medicine), (merged.get(String(it.medicine)) || 0) + q);
    });

    const meds = await Medicine.find({ _id: { $in: [...merged.keys()] } }).lean();
    const medMap = new Map(meds.map((m) => [String(m._id), m]));
    for (const id of merged.keys()) {
      const med = medMap.get(id);
      if (!med) throw new HttpError(400, 'Medicine not found');
      if (med.category === 'NARCOTIC' && !String(doctor).trim()) {
        throw new HttpError(400, `Doctor name is required for narcotic medicine (${med.name})`);
      }
    }

    const created = [];
    try {
      for (const [id, quantity] of merged) {
        const med = medMap.get(id);
        const allocations = await allocate(id, quantity, { asOf: day, label: `${med.name} ${med.strength}`.trim() });
        try {
          created.push(
            await StockOut.create({
              type: 'USAGE',
              medicine: id,
              patient: patient._id,
              date: day,
              quantity,
              shift,
              doctor,
              note,
              allocations,
              createdBy: req.user._id,
            }),
          );
        } catch (err) {
          await release(allocations);
          throw err;
        }
      }
    } catch (err) {
      // undo the lines already saved so the whole entry is all-or-nothing
      for (const doc of created) {
        await release(doc.allocations);
        await doc.deleteOne();
      }
      throw err;
    }
    res.status(201).json({ items: created });
  }),
);

// Delete a usage or write-off record and put the quantity back into its batches.
router.delete(
  '/:id',
  authorize('usage', 'delete'),
  asyncHandler(async (req, res) => {
    const doc = await StockOut.findById(req.params.id);
    if (!doc) throw new HttpError(404, 'Record not found');
    await release(doc.allocations);
    await doc.deleteOne();
    res.json({ ok: true });
  }),
);

export default router;
