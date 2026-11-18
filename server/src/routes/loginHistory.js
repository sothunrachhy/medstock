import { Router } from 'express';
import { authorize } from '../middleware/auth.js';
import LoginHistory from '../models/LoginHistory.js';
import { dayEnd, parseDay } from '../utils/date.js';
import { asyncHandler, escapeRegex, parsePaging } from '../utils/http.js';

const router = Router();

router.get(
  '/',
  authorize('loginHistory', 'read'),
  asyncHandler(async (req, res) => {
    const { page, limit, skip } = parsePaging(req.query, 30);
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.user) filter.user = req.query.user;
    if (req.query.search) filter.username = new RegExp(escapeRegex(req.query.search), 'i');
    if (req.query.from || req.query.to) {
      filter.loginAt = {};
      if (req.query.from) filter.loginAt.$gte = parseDay(req.query.from, 'from');
      if (req.query.to) filter.loginAt.$lt = dayEnd(req.query.to);
    }
    const [items, total] = await Promise.all([
      LoginHistory.find(filter).populate('user', 'username fullName').sort({ loginAt: -1 }).skip(skip).limit(limit).lean(),
      LoginHistory.countDocuments(filter),
    ]);
    res.json({ items, total, page, limit });
  }),
);

export default router;
