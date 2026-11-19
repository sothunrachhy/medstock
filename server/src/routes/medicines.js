import { Router } from 'express';
import { authorize } from '../middleware/auth.js';
import Medicine, { CATEGORIES } from '../models/Medicine.js';
import StockBatch from '../models/StockBatch.js';
import StockOut from '../models/StockOut.js';
import { stockInfoMap, stockStatus } from '../services/stock.js';
import { asyncHandler, escapeRegex, HttpError } from '../utils/http.js';
import { idParams, medicineListQuery, medicineSchema, medicineUpdateSchema } from '../../../shared/schemas/index.js';
import { validate } from '../middleware/validate.js';


const router = Router();

export function parseCategories(value) {
  const list = String(value || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((c) => CATEGORIES.includes(c));
  return list.length ? list : CATEGORIES;
}

const FIELDS = ['name', 'form', 'strength', 'category', 'order', 'minStock', 'isActive', 'note'];
const pick = (body) => Object.fromEntries(FIELDS.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));

// List medicines. ?withStock=1 adds current balance / expiry info.
// Readable by anyone who can see stock, usage or reports (they all need the list).
router.get(
  '/',
  validate({ query: medicineListQuery }),
  asyncHandler(async (req, res) => {
    const filter = { category: { $in: parseCategories(req.query.category || req.query.categories) } };
    if (req.query.active !== 'all') filter.isActive = req.query.active === 'false' ? false : true;
    if (req.query.search) filter.name = new RegExp(escapeRegex(req.query.search), 'i');

    const meds = await Medicine.find(filter).sort({ category: 1, order: 1, name: 1 }).lean();
    if (req.query.withStock) {
      const info = await stockInfoMap(meds.map((m) => m._id));
      for (const m of meds) Object.assign(m, stockStatus(m, info.get(String(m._id))));
    }
    res.json({ items: meds });
  }),
);

router.post(
  '/',
  authorize('medicines', 'create'),
  validate({ body: medicineSchema }),
  asyncHandler(async (req, res) => {
    const data = pick(req.body || {});
    if (data.order === undefined) {
      const last = await Medicine.findOne({ category: data.category }).sort({ order: -1 }).lean();
      data.order = (last?.order || 0) + 1;
    }
    const med = await Medicine.create(data);
    res.status(201).json(med);
  }),
);

router.put(
  '/:id',
  authorize('medicines', 'update'),
  validate({ params: idParams, body: medicineUpdateSchema }),
  asyncHandler(async (req, res) => {
    const med = await Medicine.findById(req.params.id);
    if (!med) throw new HttpError(404, 'Medicine not found');
    Object.assign(med, pick(req.body || {}));
    await med.save();
    res.json(med);
  }),
);

// Deletes a medicine that was never used; otherwise just deactivates it so
// historical reports stay correct.
router.delete(
  '/:id',
  authorize('medicines', 'delete'),
  validate({ params: idParams }),
  asyncHandler(async (req, res) => {
    const med = await Medicine.findById(req.params.id);
    if (!med) throw new HttpError(404, 'Medicine not found');
    const [batches, outs] = await Promise.all([
      StockBatch.countDocuments({ medicine: med._id }),
      StockOut.countDocuments({ medicine: med._id }),
    ]);
    if (batches || outs) {
      med.isActive = false;
      await med.save();
      return res.json({ ok: true, deactivated: true });
    }
    await med.deleteOne();
    res.json({ ok: true, deleted: true });
  }),
);

export default router;
