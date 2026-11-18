import mongoose from 'mongoose';
import StockBatch from '../models/StockBatch.js';
import { addDays, dayStart, todayStr } from '../utils/date.js';
import { HttpError } from '../utils/http.js';

export const expiryWarnDays = () => Number(process.env.EXPIRY_WARN_DAYS) || 90;

const toId = (v) => (v instanceof mongoose.Types.ObjectId ? v : new mongoose.Types.ObjectId(String(v)));

/**
 * Current stock per medicine, computed from the remaining quantity of batches.
 * Returns Map<medicineId, { balance, expiredQty, expiringQty, nearestExpiry, batches }>
 */
export async function stockInfoMap(medicineIds) {
  const today = dayStart(todayStr());
  const soon = addDays(today, expiryWarnDays());
  const match = { remaining: { $gt: 0 } };
  if (medicineIds) match.medicine = { $in: medicineIds.map(toId) };

  const rows = await StockBatch.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$medicine',
        balance: { $sum: '$remaining' },
        batches: { $sum: 1 },
        expiredQty: { $sum: { $cond: [{ $lt: ['$expiryDate', today] }, '$remaining', 0] } },
        expiringQty: {
          $sum: {
            $cond: [{ $and: [{ $gte: ['$expiryDate', today] }, { $lt: ['$expiryDate', soon] }] }, '$remaining', 0],
          },
        },
        // earliest expiry among batches that are not expired yet
        nearestExpiry: { $min: { $cond: [{ $gte: ['$expiryDate', today] }, '$expiryDate', null] } },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
}

export function stockStatus(medicine, info) {
  const balance = info?.balance || 0;
  const usable = balance - (info?.expiredQty || 0);
  let status = 'OK';
  if (usable <= 0) status = 'OUT';
  else if (usable <= (medicine.minStock || 0)) status = 'LOW';
  return {
    balance,
    usable,
    status,
    expiredQty: info?.expiredQty || 0,
    expiringQty: info?.expiringQty || 0,
    nearestExpiry: info?.nearestExpiry || null,
    batches: info?.batches || 0,
  };
}

export async function release(allocations = []) {
  for (const a of allocations) {
    await StockBatch.updateOne({ _id: a.batch }, { $inc: { remaining: a.quantity } });
  }
}

/**
 * Takes `quantity` units out of the medicine's batches, earliest expiry first.
 * Expired batches are skipped unless allowExpired (used for write-offs).
 * Batches received after `asOf` (the usage day) are not used.
 */
export async function allocate(medicineId, quantity, { batchId, allowExpired = false, asOf, label = 'medicine' } = {}) {
  const today = dayStart(todayStr());
  const filter = { medicine: toId(medicineId), remaining: { $gt: 0 } };
  if (batchId) filter._id = toId(batchId);
  if (!allowExpired) filter.expiryDate = { $gte: today };
  if (asOf) filter.receivedDate = { $lte: asOf };

  const batches = await StockBatch.find(filter).sort({ expiryDate: 1, receivedDate: 1, _id: 1 });
  const available = batches.reduce((sum, b) => sum + b.remaining, 0);

  if (available < quantity) {
    let message = `Not enough stock for ${label}: requested ${quantity}, available ${available}`;
    if (!allowExpired && !batchId) {
      const expired = await StockBatch.aggregate([
        { $match: { medicine: toId(medicineId), remaining: { $gt: 0 }, expiryDate: { $lt: today } } },
        { $group: { _id: null, q: { $sum: '$remaining' } } },
      ]);
      if (expired[0]?.q) message += ` (${expired[0].q} more are expired and cannot be used)`;
    }
    throw new HttpError(400, message, { code: 'INSUFFICIENT_STOCK', available });
  }

  const allocations = [];
  let need = quantity;
  try {
    for (const b of batches) {
      if (need <= 0) break;
      const take = Math.min(b.remaining, need);
      // conditional update protects against two users dispensing the same units
      const r = await StockBatch.updateOne({ _id: b._id, remaining: { $gte: take } }, { $inc: { remaining: -take } });
      if (!r.modifiedCount) throw new HttpError(409, 'Stock was changed by another user, please try again');
      allocations.push({ batch: b._id, quantity: take });
      need -= take;
    }
  } catch (err) {
    await release(allocations);
    throw err;
  }
  return allocations;
}
