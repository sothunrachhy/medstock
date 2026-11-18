import { Router } from 'express';
import { authorize } from '../middleware/auth.js';
import Patient from '../models/Patient.js';
import StockOut from '../models/StockOut.js';
import { dayEnd, parseDay, todayStr } from '../utils/date.js';
import { asyncHandler, escapeRegex, HttpError, parsePaging } from '../utils/http.js';

const router = Router();

const FIELDS = ['code', 'name', 'sex', 'age', 'diagnosis', 'province', 'dateIn', 'dateOut', 'status', 'note'];

function pick(body) {
  const data = Object.fromEntries(FIELDS.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));
  if (data.dateIn) data.dateIn = parseDay(data.dateIn, 'date in');
  if (data.dateOut === '' || data.dateOut === null) data.dateOut = undefined;
  else if (data.dateOut) data.dateOut = parseDay(data.dateOut, 'date out');
  if (data.age === '' || data.age === null) data.age = undefined;
  if (data.dateOut && data.status === undefined) data.status = 'DISCHARGED';
  return data;
}

router.get(
  '/',
  authorize('patients', 'read'),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePaging(req.query, 20, 500);
    const filter = {};
    if (req.query.search) {
      const re = new RegExp(escapeRegex(req.query.search.trim()), 'i');
      filter.$or = [{ name: re }, { code: re }, { diagnosis: re }];
    }
    if (req.query.status) filter.status = req.query.status;
    if (req.query.from || req.query.to) {
      filter.dateIn = {};
      if (req.query.from) filter.dateIn.$gte = parseDay(req.query.from, 'from');
      if (req.query.to) filter.dateIn.$lt = dayEnd(req.query.to);
    }
    const [items, total] = await Promise.all([
      Patient.find(filter).sort({ dateIn: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      Patient.countDocuments(filter),
    ]);
    res.json({ items, total, page, limit });
  }),
);

router.get(
  '/:id',
  authorize('patients', 'read'),
  asyncHandler(async (req, res) => {
    const patient = await Patient.findById(req.params.id).lean();
    if (!patient) throw new HttpError(404, 'Patient not found');
    res.json(patient);
  }),
);

router.post(
  '/',
  authorize('patients', 'create'),
  asyncHandler(async (req, res) => {
    const data = pick(req.body || {});
    if (!data.dateIn) data.dateIn = parseDay(todayStr());
    const patient = await Patient.create({ ...data, createdBy: req.user._id });
    res.status(201).json(patient);
  }),
);

router.put(
  '/:id',
  authorize('patients', 'update'),
  asyncHandler(async (req, res) => {
    const patient = await Patient.findById(req.params.id);
    if (!patient) throw new HttpError(404, 'Patient not found');
    const data = pick(req.body || {});
    if (data.status === 'ADMITTED') data.dateOut = undefined;
    patient.set(data);
    if (data.status === 'ADMITTED') patient.dateOut = undefined;
    await patient.save();
    res.json(patient);
  }),
);

router.delete(
  '/:id',
  authorize('patients', 'delete'),
  asyncHandler(async (req, res) => {
    const used = await StockOut.countDocuments({ patient: req.params.id });
    if (used) {
      throw new HttpError(409, `This patient has ${used} medicine usage record(s). Delete those records first.`);
    }
    const r = await Patient.deleteOne({ _id: req.params.id });
    if (!r.deletedCount) throw new HttpError(404, 'Patient not found');
    res.json({ ok: true });
  }),
);

export default router;
