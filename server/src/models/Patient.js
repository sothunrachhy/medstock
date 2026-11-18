import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true, default: '' }, // hospital ID (optional)
    name: { type: String, required: true, trim: true },
    sex: { type: String, enum: ['M', 'F'], required: true },
    age: { type: Number, min: 0, max: 150 },
    diagnosis: { type: String, trim: true, default: '' },
    province: { type: String, trim: true, default: '' }, // address / place of birth
    dateIn: { type: Date, required: true, index: true },
    dateOut: Date,
    status: { type: String, enum: ['ADMITTED', 'DISCHARGED'], default: 'ADMITTED', index: true },
    note: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

patientSchema.index({ name: 1 });

export default mongoose.model('Patient', patientSchema);
