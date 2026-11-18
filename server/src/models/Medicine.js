import mongoose from 'mongoose';

// INJECTION = ថ្នាំចាក់, PILL = ថ្នាំគ្រាប់, NARCOTIC = ថ្នាំបំបាត់ការឈឺចាប់មានសារធាតុញៀន
export const CATEGORIES = ['INJECTION', 'PILL', 'NARCOTIC'];

const medicineSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    form: { type: String, trim: true, default: '' }, // Amp, FL, Tab, Gel...
    strength: { type: String, trim: true, default: '' }, // 1mg, 500ml...
    category: { type: String, enum: CATEGORIES, required: true, index: true },
    // Row number (ល.រ) used to keep the same ordering as the paper reports
    order: { type: Number, default: 0 },
    // Below or equal to this balance the medicine is flagged as low stock
    minStock: { type: Number, default: 10, min: 0 },
    isActive: { type: Boolean, default: true },
    note: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);

medicineSchema.index({ name: 1, form: 1, strength: 1, category: 1 }, { unique: true });

export default mongoose.model('Medicine', medicineSchema);
