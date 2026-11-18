import mongoose from 'mongoose';

// One received lot of a medicine (ចំណូល). `remaining` is decreased when the
// medicine is dispensed (first-expiry-first-out) or written off.
const stockBatchSchema = new mongoose.Schema(
  {
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true, index: true },
    quantity: { type: Number, required: true, min: 1 },
    remaining: { type: Number, required: true, min: 0 },
    receivedDate: { type: Date, required: true, index: true },
    expiryDate: { type: Date, required: true, index: true },
    batchNo: { type: String, trim: true, default: '' },
    source: { type: String, trim: true, default: '' }, // supplier / pharmacy
    note: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

stockBatchSchema.index({ medicine: 1, expiryDate: 1 });

export default mongoose.model('StockBatch', stockBatchSchema);
