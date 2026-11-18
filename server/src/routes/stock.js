import { Router } from 'express';
import { authorize } from '../middleware/auth.js';
import Medicine from '../models/Medicine.js';
import StockBatch from '../models/StockBatch.js';
import StockOut from '../models/StockOut.js';
import { allocate, expiryWarnDays, release } from '../services/stock.js';
import { addDays, dayStart, parseDay, todayStr } from '../utils/date.js';
import { asyncHandler, HttpError, parsePaging, toPositiveInt } from '../utils/http.js';

const router = Router();

// ---- Batches (stock in / ចំណូល) -------------------------------------------

router.get(
  '/batches',
  authorize('stock', 'read'),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePaging(req.query, 50, 500);
    const today = dayStart(todayStr());
    const filter = {};
    if (req.query.medicine) filter.medicine = req.query.medicine;
    const status = req.query.status; // all | available | expiring | expired
    if (status === 'available') filter.remaining = { $gt: 0 };
    if (status === 'expiring') {
      const days = Number(req.query.days) || expiryWarnDays();
      filter.remaining = { $gt: 0 };
      filter.expiryDate = { $gte: today, $lt: addDays(today, days) };
    }
    if (status === 'expired') {
      filter.remaining = { $gt: 0 };
      filter.expiryDate = { $lt: today };
    }
    const sort = status === 'expiring' || status === 'expired' ? { expiryDate: 1 } : { receivedDate: -1, createdAt: -1 };
    const [items, total] = await Promise.all([
      StockBatch.find(filter)
        .populate('medicine', 'name form strength category')
        .populate('createdBy', 'fullName')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      StockBatch.countDocuments(filter),
    ]);
    res.json({ items, total, page, limit });
  }),
);

// Insert new stock: { items: [{ medicine, quantity, receivedDate, expiryDate, batchNo, source, note }] }
router.post(
  '/batches',
  authorize('stock', 'create'),
  asyncHandler(async (req, res) => {
    const items = Array.isArray(req.body?.items) ? req.body.items : [req.body];
    if (!items.length) throw new HttpError(400, 'No items');

    const ids = [...new Set(items.map((i) => String(i.medicine)))];
    const meds = await Medicine.find({ _id: { $in: ids } }).lean();
    const medMap = new Map(meds.map((m) => [String(m._id), m]));

    const docs = items.map((it, idx) => {
      const row = `Row ${idx + 1}`;
      if (!medMap.has(String(it.medicine))) throw new HttpError(400, `${row}: please select a medicine`);
      const quantity = toPositiveInt(it.quantity, `${row}: quantity`);
      if (!it.expiryDate) throw new HttpError(400, `${row}: expiry date is required`);
      const receivedDate = parseDay(it.receivedDate || todayStr(), 'input date');
      const expiryDate = parseDay(it.expiryDate, 'expiry date');
      if (expiryDate <= receivedDate) throw new HttpError(400, `${row}: expiry date must be after the input date`);
      return {
        medicine: it.medicine,
        quantity,
        remaining: quantity,
        receivedDate,
        expiryDate,
        batchNo: it.batchNo || '',
        source: it.source || '',
        note: it.note || '',
        createdBy: req.user._id,
      };
    });

    const created = await StockBatch.insertMany(docs);
    res.status(201).json({ items: created });
  }),
);

router.put(
  '/batches/:id',
  authorize('stock', 'update'),
  asyncHandler(async (req, res) => {
    const batch = await StockBatch.findById(req.params.id);
    if (!batch) throw new HttpError(404, 'Batch not found');
    const { quantity, receivedDate, expiryDate, batchNo, source, note } = req.body || {};
    const used = batch.quantity - batch.remaining;

    if (quantity !== undefined) {
      const q = toPositiveInt(quantity, 'quantity');
      if (q < used) throw new HttpError(400, `Quantity cannot be less than what was already used (${used})`);
      batch.remaining = q - used;
      batch.quantity = q;
    }
    if (receivedDate) batch.receivedDate = parseDay(receivedDate, 'input date');
    if (expiryDate) batch.expiryDate = parseDay(expiryDate, 'expiry date');
    if (batch.expiryDate <= batch.receivedDate) throw new HttpError(400, 'Expiry date must be after the input date');
    if (batchNo !== undefined) batch.batchNo = batchNo;
    if (source !== undefined) batch.source = source;
    if (note !== undefined) batch.note = note;
    await batch.save();
    res.json(batch);
  }),
);

router.delete(
  '/batches/:id',
  authorize('stock', 'delete'),
  asyncHandler(async (req, res) => {
    const batch = await StockBatch.findById(req.params.id);
    if (!batch) throw new HttpError(404, 'Batch not found');
    const used = await StockOut.countDocuments({ 'allocations.batch': batch._id });
    if (used || batch.remaining !== batch.quantity) {
      throw new HttpError(409, 'This batch has already been used. Edit the quantity or write off the remaining stock instead.');
    }
    await batch.deleteOne();
    res.json({ ok: true });
  }),
);

// ---- Write-off (expired / damaged / count adjustment) ---------------------

router.post(
  '/writeoff',
  authorize('stock', 'update'),
  asyncHandler(async (req, res) => {
    const { batch: batchId, quantity, type = 'EXPIRED', date, note } = req.body || {};
    if (!['EXPIRED', 'DAMAGED', 'ADJUSTMENT'].includes(type)) throw new HttpError(400, 'Invalid write-off type');
    const batch = await StockBatch.findById(batchId).populate('medicine', 'name');
    if (!batch) throw new HttpError(404, 'Batch not found');
    const qty = toPositiveInt(quantity, 'quantity');
    const allocations = await allocate(batch.medicine._id, qty, {
      batchId: batch._id,
      allowExpired: true,
      label: batch.medicine.name,
    });
    try {
      const out = await StockOut.create({
        type,
        medicine: batch.medicine._id,
        date: parseDay(date || todayStr()),
        quantity: qty,
        note: note || '',
        allocations,
        createdBy: req.user._id,
      });
      res.status(201).json(out);
    } catch (err) {
      await release(allocations);
      throw err;
    }
  }),
);

// ---- Movement history of one medicine (in + out) ---------------------------

router.get(
  '/movements',
  authorize('stock', 'read'),
  asyncHandler(async (req, res) => {
    if (!req.query.medicine) throw new HttpError(400, 'medicine is required');
    const limit = Math.min(500, Number(req.query.limit) || 100);
    const [ins, outs] = await Promise.all([
      StockBatch.find({ medicine: req.query.medicine }).populate('createdBy', 'fullName').sort({ receivedDate: -1 }).limit(limit).lean(),
      StockOut.find({ medicine: req.query.medicine })
        .populate('patient', 'name')
        .populate('createdBy', 'fullName')
        .sort({ date: -1, createdAt: -1 })
        .limit(limit)
        .lean(),
    ]);
    const movements = [
      ...ins.map((b) => ({
        _id: b._id,
        kind: 'IN',
        date: b.receivedDate,
        quantity: b.quantity,
        detail: [b.batchNo && `Batch ${b.batchNo}`, b.source].filter(Boolean).join(' · '),
        by: b.createdBy?.fullName,
        createdAt: b.createdAt,
      })),
      ...outs.map((o) => ({
        _id: o._id,
        kind: o.type,
        date: o.date,
        quantity: -o.quantity,
        detail: o.patient?.name || o.note || '',
        by: o.createdBy?.fullName,
        createdAt: o.createdAt,
      })),
    ].sort((a, b) => b.date - a.date || b.createdAt - a.createdAt);
    res.json({ items: movements.slice(0, limit) });
  }),
);

export default router;
