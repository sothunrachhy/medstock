import mongoose from 'mongoose';

const loginHistorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  username: { type: String, trim: true },
  status: { type: String, enum: ['SUCCESS', 'FAILED'], required: true },
  reason: String,
  ip: String,
  userAgent: String,
  loginAt: { type: Date, default: Date.now },
  logoutAt: Date,
});

// Login history is kept for 2 years, then MongoDB deletes it automatically (TTL index).
// Existing databases: run `npm run db:sync-indexes` once to convert the old loginAt index.
export const LOGIN_HISTORY_RETENTION_DAYS = 730;
loginHistorySchema.index({ loginAt: -1 }, { expireAfterSeconds: LOGIN_HISTORY_RETENTION_DAYS * 24 * 3600 });

export default mongoose.model('LoginHistory', loginHistorySchema);
