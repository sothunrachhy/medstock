import mongoose from 'mongoose';

// Key/value store for system settings. One document per settings group (e.g. "auth").
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, minimize: false },
);

export default mongoose.model('Setting', settingSchema);
