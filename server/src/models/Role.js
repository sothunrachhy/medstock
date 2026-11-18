import mongoose from 'mongoose';
import { ACTIONS, MODULES } from '../config/permissions.js';

const permissionSchema = new mongoose.Schema(
  {
    module: { type: String, enum: MODULES, required: true },
    actions: [{ type: String, enum: ACTIONS }],
  },
  { _id: false },
);

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, trim: true, default: '' },
    permissions: [permissionSchema],
    // System roles (Admin) have full access and cannot be edited or deleted.
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export default mongoose.model('Role', roleSchema);
