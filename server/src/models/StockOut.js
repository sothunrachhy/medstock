import mongoose from 'mongoose';

// USAGE = given to a patient (ចំណាយ). The other types are write-offs.
export const OUT_TYPES = ['USAGE', 'EXPIRED', 'DAMAGED', 'ADJUSTMENT'];

const allocationSchema = new mongoose.Schema(
  {
    batch: { type: mongoose.Schema.Types.ObjectId, ref: 'StockBatch', required: true },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const stockOutSchema = new mongoose.Schema(
  {
    type: { type: String, enum: OUT_TYPES, default: 'USAGE', index: true },
    medicine: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: true, index: true },
    patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', index: true },
    date: { type: Date, required: true, index: true }, // Cambodia day start
    quantity: { type: Number, required: true, min: 1 },
    shift: { type: String, enum: ['DAY', 'NIGHT', ''], default: '' },
    doctor: { type: String, trim: true, default: '' },
    note: { type: String, trim: true, default: '' },
    allocations: [allocationSchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

stockOutSchema.index({ medicine: 1, date: 1 });
stockOutSchema.index({ patient: 1, date: 1 });

export default mongoose.model('StockOut', stockOutSchema);
