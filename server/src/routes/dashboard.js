import { Router } from 'express';
import { authorize } from '../middleware/auth.js';
import Medicine from '../models/Medicine.js';
import Patient from '../models/Patient.js';
import StockBatch from '../models/StockBatch.js';
import StockOut from '../models/StockOut.js';
import { expiryWarnDays, stockInfoMap, stockStatus } from '../services/stock.js';
import { addDays, dayStart, listDays, toDayStr, todayStr, TZ } from '../utils/date.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();

router.get(
  '/',
  authorize('dashboard', 'read'),
  asyncHandler(async (_req, res) => {
    const todayS = todayStr();
    const today = dayStart(todayS);
    const tomorrow = addDays(today, 1);
    const warnDays = expiryWarnDays();
    const soon = addDays(today, warnDays);
    const trendStart = addDays(today, -13);
    const monthStart = dayStart(`${todayS.slice(0, 7)}-01`);

    const meds = await Medicine.find({ isActive: true }).lean();
    const medMap = new Map(meds.map((m) => [String(m._id), m]));
    const info = await stockInfoMap();

    const [admitted, admittedToday, usageToday, expiring, expiringCount, expiredCount, trendRows, topRows, admissions] =
      await Promise.all([
        Patient.countDocuments({ status: 'ADMITTED' }),
        Patient.countDocuments({ dateIn: { $gte: today, $lt: tomorrow } }),
        StockOut.aggregate([
          { $match: { type: 'USAGE', date: { $gte: today, $lt: tomorrow } } },
          { $group: { _id: null, q: { $sum: '$quantity' }, n: { $sum: 1 }, patients: { $addToSet: '$patient' } } },
        ]),
        StockBatch.find({ remaining: { $gt: 0 }, expiryDate: { $lt: soon } })
          .populate('medicine', 'name form strength category')
          .sort({ expiryDate: 1 })
          .limit(15)
          .lean(),
        StockBatch.countDocuments({ remaining: { $gt: 0 }, expiryDate: { $gte: today, $lt: soon } }),
        StockBatch.countDocuments({ remaining: { $gt: 0 }, expiryDate: { $lt: today } }),
        StockOut.aggregate([
          { $match: { type: 'USAGE', date: { $gte: trendStart, $lt: tomorrow } } },
          { $lookup: { from: 'medicines', localField: 'medicine', foreignField: '_id', as: 'm' } },
          { $unwind: '$m' },
          {
            $group: {
              _id: { d: { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: TZ } }, c: '$m.category' },
              q: { $sum: '$quantity' },
            },
          },
        ]),
        StockOut.aggregate([
          { $match: { type: 'USAGE', date: { $gte: monthStart, $lt: tomorrow } } },
          { $group: { _id: '$medicine', q: { $sum: '$quantity' } } },
          { $sort: { q: -1 } },
          { $limit: 10 },
        ]),
        Patient.aggregate([
          { $match: { dateIn: { $gte: trendStart, $lt: tomorrow } } },
          { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$dateIn', timezone: TZ } }, n: { $sum: 1 } } },
        ]),
      ]);

    // stock status per medicine
    const byCategory = {};
    const lowStock = [];
    let lowCount = 0;
    let outCount = 0;
    for (const m of meds) {
      const s = stockStatus(m, info.get(String(m._id)));
      byCategory[m.category] ||= { category: m.category, OK: 0, LOW: 0, OUT: 0, total: 0 };
      byCategory[m.category][s.status] += 1;
      byCategory[m.category].total += 1;
      if (s.status === 'LOW') lowCount += 1;
      if (s.status === 'OUT') outCount += 1;
      // "out" items that were never stocked are noise on the dashboard list
      if (s.status === 'LOW' || (s.status === 'OUT' && s.batches > 0)) {
        lowStock.push({ _id: m._id, name: m.name, form: m.form, strength: m.strength, category: m.category, minStock: m.minStock, ...s });
      }
    }
    lowStock.sort((a, b) => a.usable - b.usable);

    const days = listDays(toDayStr(trendStart), todayS);
    const trend = days.map((d) => ({ date: d, INJECTION: 0, PILL: 0, NARCOTIC: 0, admissions: 0 }));
    const tIdx = new Map(trend.map((t, i) => [t.date, i]));
    for (const r of trendRows) if (tIdx.has(r._id.d)) trend[tIdx.get(r._id.d)][r._id.c] = r.q;
    for (const r of admissions) if (tIdx.has(r._id)) trend[tIdx.get(r._id)].admissions = r.n;

    res.json({
      today: todayS,
      expiryWarnDays: warnDays,
      kpis: {
        medicines: meds.length,
        admitted,
        admittedToday,
        usageToday: usageToday[0]?.q || 0,
        usageEntriesToday: usageToday[0]?.n || 0,
        patientsTreatedToday: usageToday[0]?.patients?.length || 0,
        lowStock: lowCount,
        outOfStock: outCount,
        expiringBatches: expiringCount,
        expiredBatches: expiredCount,
      },
      stockByCategory: ['INJECTION', 'PILL', 'NARCOTIC'].map((c) => byCategory[c] || { category: c, OK: 0, LOW: 0, OUT: 0, total: 0 }),
      lowStock: lowStock.slice(0, 15),
      expiring,
      trend,
      topUsed: topRows
        .map((r) => ({ medicine: medMap.get(String(r._id)), quantity: r.q }))
        .filter((r) => r.medicine)
        .map((r) => ({ name: `${r.medicine.name} ${r.medicine.strength}`.trim(), category: r.medicine.category, quantity: r.quantity })),
    });
  }),
);

export default router;
