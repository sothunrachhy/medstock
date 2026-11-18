import mongoose from 'mongoose';

const loginHistorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  username: { type: String, trim: true },
  status: { type: String, enum: ['SUCCESS', 'FAILED'], required: true },
  reason: String,
  ip: String,
  userAgent: String,
  loginAt: { type: Date, default: Date.now, index: true },
  logoutAt: Date,
});

export default mongoose.model('LoginHistory', loginHistorySchema);
