import mongoose from 'mongoose';

// Requested / provided quantities (ចំនួនស្នើសុំ / ចំនួនផ្ដល់) attached to a
// weekly report, saved per category set and date range.
const itemSchema = new mongoose.Schema(
  {
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true },
    requested: { type: Number, min: 0, default: 0 },
    provided: { type: Number, min: 0, default: 0 },
  },
  { _id: false },
);

const requisitionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // e.g. "INJECTION,NARCOTIC"
    from: { type: Date, required: true },
    to: { type: Date, required: true },
    items: [itemSchema],
    note: { type: String, trim: true, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

requisitionSchema.index({ key: 1, from: 1, to: 1 }, { unique: true });

export default mongoose.model('Requisition', requisitionSchema);
